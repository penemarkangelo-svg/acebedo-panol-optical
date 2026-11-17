import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { CloseIcon } from "@solar-icons/react/linear";
import { supabase } from "../lib/supabaseClient";
import { estimateFaceShape, getFrameRecommendations, suggestedFrameShapes } from "../ar/faceShapeRecommendations";
import { MEDIAPIPE } from "../vision-screening/constants/screeningConfig";
import "../styles/TryOnModal.css";
import "../styles/TryOn3D.css";
import FrameOverlay from "./FrameOverlay";
const StarLight3DOverlay = lazy(() => import("./StarLight3DOverlay"));
const STARLIGHT_3D_PATH = "/ar/starlight-black-demo.glb";

function primaryImage(product) {
  return product.product_images?.find((image) => image.is_primary)?.image_url || product.product_images?.[0]?.image_url || "";
}

function colorImages(product) {
  const images = product.product_images || [];
  const byId = new Map(images.map((image) => [String(image.id), image.image_url]));
  return (product.product_colors || []).map((color) => ({
    ...color,
    image_url: color.image_url || byId.get(String(color.image_id)) || primaryImage(product),
  }));
}

function pdEstimate(landmarks) {
  if (!landmarks || landmarks.length < 478) return null;
  const xyDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // Iris diameter is used only as a rough visual scale reference.
  const irisDiameter = (left, right) => xyDistance(landmarks[left], landmarks[right]);
  const irisScale = (irisDiameter(469, 471) + irisDiameter(474, 476)) / 2;
  const irisCenters = xyDistance(landmarks[468], landmarks[473]);
  if (!irisScale || !irisCenters) return null;
  return Math.round((irisCenters / irisScale) * 11.7);
}

export default function TryOnModal({ product, selectedColor: initialColor, onClose, onSelectLenses, previewOnly = false }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const animationRef = useRef(0);
  const lastDetectionRef = useRef(0);
  const [cameraState, setCameraState] = useState("starting");
  const [faceShape, setFaceShape] = useState(null);
  const [pd, setPd] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [catalogState, setCatalogState] = useState("loading");
  const [activeProduct, setActiveProduct] = useState(product);
  const [activeColor, setActiveColor] = useState(initialColor || null);
  const [points, setPoints] = useState(null);
  const [overlayLookup, setOverlayLookup] = useState({ productId: null, status: "loading", paths: {} });
  const [overlayImageState, setOverlayImageState] = useState({ path: null, status: "idle" });
  const [renderMode, setRenderMode] = useState("2d");

  useEffect(() => {
    let active = true;
    const productId = activeProduct.id;
    setOverlayLookup({ productId, status: "loading", paths: {} });
    async function loadAssets() {
      try {
        const { data, error } = await supabase.from("product_colors").select("id, ar_overlay_path").eq("product_id", productId);
        if (error) throw error;
        if (active) setOverlayLookup({ productId, status: "ready", paths: Object.fromEntries((data || []).map((color) => [color.id, color.ar_overlay_path])) });
      } catch {
        if (active) setOverlayLookup({ productId, status: "error", paths: {} });
      }
    }
    loadAssets();
    return () => { active = false; };
  }, [activeProduct.id]);

  const colors = useMemo(() => colorImages(activeProduct), [activeProduct]);
  const overlayColor = activeColor || colors.find((color) => Number(color.stock || 0) > 0) || colors[0];
  const overlayLookupStatus = overlayLookup.productId === activeProduct.id ? overlayLookup.status : "loading";
  const overlayPath = overlayLookupStatus === "ready" ? overlayLookup.paths[overlayColor?.id] : null;
  const supports3D = Number(activeProduct.id) === 2 && Number(overlayColor?.id) === 70 && overlayPath === "/ar/starlight-aviator-black-demo.png";
  const use3D = supports3D && renderMode === "3d";
  const assetPath = use3D ? STARLIGHT_3D_PATH : overlayPath;
  const recommendations = useMemo(() => getFrameRecommendations(catalog, faceShape?.name), [catalog, faceShape?.name]);
  const suggestedShapes = useMemo(() => suggestedFrameShapes(faceShape?.name).map((shape) => shape.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("-")).join(" · "), [faceShape?.name]);

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not supported in this browser.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE.wasmUrl);
        let landmarker;
        try {
          landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MEDIAPIPE.modelUrl, delegate: "GPU" },
            runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false,
          });
        } catch {
          landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MEDIAPIPE.modelUrl, delegate: "CPU" },
            runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false,
          });
        }
        if (cancelled) { landmarker.close(); return; }
        landmarkerRef.current = landmarker;
        setCameraState("ready");
      } catch (error) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        if (!cancelled) setCameraState(error?.name === "NotAllowedError" ? "denied" : "error");
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationRef.current);
      landmarkerRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (cameraState !== "ready") return undefined;
    let active = true;
    const detect = (now) => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!active) return;
      if (video && landmarker && video.readyState >= 2 && now - lastDetectionRef.current > 120) {
        lastDetectionRef.current = now;
        const result = landmarker.detectForVideo(video, now);
        const points = result.faceLandmarks?.[0];
        setPoints(points || null);
        if (points) {
          const shape = estimateFaceShape(points);
          setFaceShape(shape);
          setPd(pdEstimate(points));
        } else {
          setFaceShape(null); setPd(null);
        }
      }
      animationRef.current = requestAnimationFrame(detect);
    };
    animationRef.current = requestAnimationFrame(detect);
    return () => { active = false; cancelAnimationFrame(animationRef.current); };
  }, [cameraState]);

  useEffect(() => {
    let active = true;
    async function loadCatalog() {
      const { data, error } = await supabase.from("products").select(`id, name, price, stock, type, frame_shape:frame_attributes!products_frame_shape_id_fkey(name), product_images(id, image_url, is_primary, sort_order), product_colors(id, color_name, color_code, image_id, stock, ar_overlay_path)`).not("frame_shape_id", "is", null).order("name", { ascending: true });
      if (!active) return;
      if (error) setCatalogState("error");
      else { setCatalog(data || []); setCatalogState("ready"); }
    }
    loadCatalog();
    return () => { active = false; };
  }, []);

  const chooseRecommendation = (recommended) => {
    setActiveProduct(recommended);
    const availableColor = colorImages(recommended).find((color) => Number(color.stock || 0) > 0);
    setActiveColor(availableColor || null);
  };

  const viewDetails = () => { onClose(); navigate(`/product/${activeProduct.id}`); };
  const lensAction = () => { onClose(); onSelectLenses?.(); };
  const cameraMessage = cameraState === "starting" ? "Starting your camera…" : cameraState === "denied" ? "Allow camera access to try on frames." : cameraState === "error" ? "Camera preview is unavailable. Check your camera and try again." : "Center your face in the frame to see recommendations.";

  // The preview owns one status message; startup and camera errors take priority.
  const previewMessage = cameraState !== "ready" ? cameraMessage
    : overlayLookupStatus === "loading" ? "Loading frame asset."
    : overlayLookupStatus === "error" ? "The frame asset could not be checked. Close and reopen try-on to retry."
    : !overlayPath ? "No AR asset saved for this color yet."
    : overlayImageState.path === assetPath && overlayImageState.status === "error" ? (use3D ? "3D preview unavailable. Switch to 2D to continue." : "The frame image could not be loaded.")
    : overlayImageState.path !== assetPath || overlayImageState.status !== "ready" ? (use3D ? "Loading 3D sample." : "Loading frame image.")
    : !faceShape ? cameraMessage : null;

  return <div className="tryon-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="tryon-modal" role="dialog" aria-modal="true" aria-label={`${product.name} virtual try-on`}>
      <div className="tryon-preview">
        <video ref={videoRef} className="tryon-video" autoPlay muted playsInline aria-label="Live camera preview" />
        {use3D ? <Suspense fallback={null}><StarLight3DOverlay points={points} videoRef={videoRef} onAssetStateChange={setOverlayImageState} /></Suspense> : <FrameOverlay path={overlayPath} points={points} videoRef={videoRef} onAssetStateChange={setOverlayImageState} />}
        <div className="tryon-preview-top"><span className="tryon-live-indicator"><i /> LIVE TRY-ON</span><span className="tryon-pd">{pd ? `PD ~ ${pd} mm` : "PD —"}</span><button className="tryon-close tryon-close--mobile" type="button" onClick={onClose} aria-label="Close try-on"><CloseIcon size={18} strokeWidth={1.8} aria-hidden="true" /></button></div>
        {previewMessage && <p className="tryon-camera-message" role="status">{previewMessage}</p>}
          {supports3D && <section className="tryon-mode-section" aria-label="Try-on mode"><div className="tryon-mode-options"><button type="button" aria-pressed={!use3D} onClick={() => setRenderMode("2d")}>2D</button><button type="button" aria-pressed={use3D} onClick={() => setRenderMode("3d")}>3D sample</button></div>{use3D && <p>Experimental photo-based model. Shape, size and side-arm fit are approximate.</p>}</section>}
        <p className="tryon-preview-disclaimer">Estimated PD is for visual try-on only, not lens fitting.</p>
      </div>
      <div className="tryon-panel">
        <header className="tryon-panel-header"><div><p className="tryon-eyebrow">VIRTUAL TRY-ON</p><h2>{activeProduct.name}</h2><p className="tryon-price">₱{Number(activeProduct.price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p></div><button className="tryon-close" type="button" onClick={onClose} aria-label="Close try-on"><CloseIcon size={20} strokeWidth={1.8} aria-hidden="true" /></button></header>
        <div className="tryon-panel-content">
          {colors.filter((color) => Number(color.stock || 0) > 0).length > 0 && <section className="tryon-colors-section"><div className="tryon-section-heading"><h3>Frame color</h3><span>{activeColor?.color_name || "Choose a color"}</span></div><div className="tryon-color-options">{colors.filter((color) => Number(color.stock || 0) > 0).map((color) => <button key={color.id} type="button" title={color.color_name} aria-label={`Try ${color.color_name} frame`} aria-pressed={activeColor?.id === color.id} className={`tryon-color-option${activeColor?.id === color.id ? " is-selected" : ""}`} onClick={() => setActiveColor(color)}><span style={{ backgroundColor: color.color_code || "#d9d6cf" }} /></button>)}</div></section>}
          {!previewOnly && <section className="tryon-shape-section"><div className="tryon-section-heading"><h3>Face shape &amp; frame guide</h3><span>{faceShape ? "Estimate" : "Waiting"}</span></div>
            {faceShape ? <><p className="tryon-detected-shape">Estimated face shape <strong>{faceShape.name}</strong></p><h4 className="tryon-available-heading">Available frames for {suggestedShapes}</h4>
              {catalogState === "loading" ? <p className="tryon-empty-note">Finding available frames…</p> : catalogState === "error" ? <p className="tryon-empty-note">Available frames couldn’t be loaded.</p> : recommendations.length ? <div className="tryon-recommendations">{recommendations.map((item) => {
                const colorsForItem = colorImages(item);
                const thumbnail = colorsForItem.find((color) => Number(color.stock || 0) > 0)?.image_url || primaryImage(item);
                return <button type="button" key={item.id} className={`tryon-recommendation${activeProduct.id === item.id ? " is-selected" : ""}`} onClick={() => chooseRecommendation(item)}><img src={thumbnail || "https://placehold.co/96x72?text=Frame"} alt="" /><span><strong>{item.name}</strong><small>{item.frame_shape?.name} · {colorsForItem.filter((color) => Number(color.stock || 0) > 0).length || (Number(item.stock) > 0 ? "In stock" : "Out of stock")}</small></span><b>₱{Number(item.price || 0).toLocaleString("en-PH")}</b></button>;
              })}</div> : <p className="tryon-empty-note">No in-stock frames match this style suggestion right now.</p>}
            </> : <p className="tryon-empty-note">{cameraMessage}</p>}
          </section>}
        </div>
        {!previewOnly && <footer className="tryon-actions"><button className="tryon-action-primary" type="button" onClick={lensAction}>Select lenses <span>→</span></button><button className="tryon-action-secondary" type="button" onClick={viewDetails}>View details</button></footer>}
      </div>
    </section>
  </div>;
}
