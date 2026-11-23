import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { CloseIcon } from "@solar-icons/react/linear";
import { ChevronRight, ImagePlus, ScanFace } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { estimateFaceShape, getFrameRecommendations, suggestedFrameShapes } from "../ar/faceShapeRecommendations";
import { MEDIAPIPE } from "../vision-screening/constants/screeningConfig";
import "../styles/TryOnModal.css";
import "../styles/TryOn3D.css";
import FrameOverlay from "./FrameOverlay";
import PhotoTryOn from "./PhotoTryOn";
const StarLight3DOverlay = lazy(() => import("./StarLight3DOverlay"));
const STARLIGHT_3D_PATH = "/ar/starlight-black-demo.glb";
// Keep WASM compatible with the installed MediaPipe JS runtime.
const TRYON_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";

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
  const delegateRef = useRef("CPU");
  const [forceCPU, setForceCPU] = useState(false);
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
  const [inputMode, setInputMode] = useState("live");
  const [pdInfoOpen, setPdInfoOpen] = useState(false);
  const pdDialogRef = useRef(null);
  useEffect(() => {
    const dialog = pdDialogRef.current;
    if (pdInfoOpen && !dialog.open) dialog.showModal();
    else if (!pdInfoOpen && dialog.open) dialog.close();
  }, [pdInfoOpen]);
  const photoFaceDetected = useCallback((landmarks) => {
    setFaceShape(landmarks ? estimateFaceShape(landmarks) : null);
    setPd(landmarks ? pdEstimate(landmarks) : null);
  }, []);

  const switchInputMode = (mode) => {
    setPoints(null); setFaceShape(null); setPd(null);
    setInputMode(mode);
  };

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
  const use3D = inputMode === "live" && supports3D && renderMode === "3d";
  const assetPath = use3D ? STARLIGHT_3D_PATH : overlayPath;
  const recommendations = useMemo(() => getFrameRecommendations(catalog, faceShape?.name), [catalog, faceShape?.name]);
  const suggestedShapes = useMemo(() => suggestedFrameShapes(faceShape?.name).map((shape) => shape.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("-")).join(" · "), [faceShape?.name]);

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape") { if (pdInfoOpen) setPdInfoOpen(false); else onClose(); } };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [onClose, pdInfoOpen]);

  useEffect(() => {
    if (inputMode !== "live") { setCameraState("idle"); return undefined; }
    let cancelled = false;
    let ownedStream;
    let ownedLandmarker;
    setCameraState("starting");
    setPoints(null);
    lastDetectionRef.current = 0;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not supported in this browser.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        ownedStream = stream;
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const vision = await FilesetResolver.forVisionTasks(TRYON_WASM_URL);
        if (cancelled) return;
        const preferredDelegate = forceCPU || window.matchMedia?.("(pointer: coarse)")?.matches ? "CPU" : "GPU";
        let landmarker;
        try {
          landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MEDIAPIPE.modelUrl, delegate: preferredDelegate },
            runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false,
          });
          delegateRef.current = preferredDelegate;
        } catch {
          if (cancelled) return;
          delegateRef.current = "CPU";
          landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MEDIAPIPE.modelUrl, delegate: "CPU" },
            runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false,
          });
        }
        if (cancelled) { landmarker.close(); return; }
        ownedLandmarker = landmarker;
        landmarkerRef.current = landmarker;
        setCameraState("ready");
      } catch (error) {
        ownedStream?.getTracks().forEach((track) => track.stop());
        if (!cancelled) setCameraState(error?.name === "NotAllowedError" ? "denied" : "error");
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationRef.current);
      ownedLandmarker?.close();
      ownedStream?.getTracks().forEach((track) => track.stop());
      if (landmarkerRef.current === ownedLandmarker) landmarkerRef.current = null;
      if (streamRef.current === ownedStream) streamRef.current = null;
    };
  }, [forceCPU, inputMode]);

  useEffect(() => {
    if (inputMode !== "live" || cameraState !== "ready") return undefined;
    let active = true;
    let lastVideoTime = -1;
    const input = document.createElement("canvas");
    const inputContext = input.getContext("2d");
    const detect = (now) => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!active) return;
      if (video && landmarker && inputContext && !video.paused && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && video.currentTime !== lastVideoTime && now - lastDetectionRef.current > 120) {
        lastDetectionRef.current = now;
        lastVideoTime = video.currentTime;
        try {
          // Bounded input reduces mobile processing and avoids direct video uploads.
          // Preserve aspect ratio so normalized landmarks match the preview.
          const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
          const width = Math.max(1, Math.round(video.videoWidth * scale));
          const height = Math.max(1, Math.round(video.videoHeight * scale));
          if (input.width !== width || input.height !== height) { input.width = width; input.height = height; }
          inputContext.drawImage(video, 0, 0, width, height);
          const result = landmarker.detectForVideo(input, now);
          const points = result.faceLandmarks?.[0];
          setPoints(points || null);
          if (points) {
            const shape = estimateFaceShape(points);
            setFaceShape(shape);
            setPd(pdEstimate(points));
          } else {
            setFaceShape(null); setPd(null);
          }
        } catch (error) {
          console.error("Try-on face tracking failed:", error);
          setPoints(null); setFaceShape(null); setPd(null);
          if (delegateRef.current === "GPU") setForceCPU(true);
          else setCameraState("tracking-error");
          return;
        }
      }
      animationRef.current = requestAnimationFrame(detect);
    };
    animationRef.current = requestAnimationFrame(detect);
    return () => { active = false; cancelAnimationFrame(animationRef.current); };
  }, [cameraState, inputMode]);

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
  const cameraMessage = cameraState === "starting" ? "Starting your camera…" : cameraState === "denied" ? "Allow camera access to try on frames." : cameraState === "error" ? "Camera preview is unavailable. Check your camera and try again." : cameraState === "tracking-error" ? "Face tracking could not run. Close try-on and reopen it in Chrome or Safari." : "Center your face in the frame to see recommendations.";

  // The preview owns one status message; startup and camera errors take priority.
  const previewMessage = cameraState !== "ready" ? cameraMessage
    : overlayLookupStatus === "loading" ? "Loading frame asset."
    : overlayLookupStatus === "error" ? "The frame asset could not be checked. Close and reopen try-on to retry."
    : !overlayPath ? "No AR asset saved for this color yet."
    : overlayImageState.path === assetPath && overlayImageState.status === "error" ? (use3D ? "3D preview unavailable. Switch to 2D to continue." : "The frame image could not be loaded.")
    : overlayImageState.path !== assetPath || overlayImageState.status !== "ready" ? (use3D ? "Loading 3D sample." : "Loading frame image.")
    : !faceShape ? cameraMessage : null;

  return <div className={previewOnly ? "tryon-overlay" : "tryon-overlay tryon-overlay--customer"} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="tryon-modal" role="dialog" aria-modal="true" aria-label={`${product.name} virtual try-on`}>
      <div className="tryon-preview">
        <video ref={videoRef} className="tryon-video" style={inputMode === "photo" ? { display: "none" } : undefined} autoPlay muted playsInline aria-label="Live camera preview" />
        {inputMode === "photo" ? <PhotoTryOn path={overlayPath} onFaceDetected={photoFaceDetected} /> : use3D ? <Suspense fallback={null}><StarLight3DOverlay points={points} videoRef={videoRef} onAssetStateChange={setOverlayImageState} /></Suspense> : <FrameOverlay path={overlayPath} points={points} videoRef={videoRef} onAssetStateChange={setOverlayImageState} />}
        <div className="tryon-preview-top"><div className="tryon-input-options" role="group" aria-label="Try-on mode"><button type="button" aria-pressed={inputMode === "live"} onClick={() => { if (inputMode !== "live") switchInputMode("live"); }}><ScanFace size={14} aria-hidden="true" /> AR Try-On</button><button type="button" aria-pressed={inputMode === "photo"} onClick={() => { if (inputMode !== "photo") switchInputMode("photo"); }}><ImagePlus size={14} aria-hidden="true" /> Photo Try-On</button></div><button className="tryon-pd" type="button" aria-haspopup="dialog" aria-controls="tryon-pd-dialog" aria-expanded={pdInfoOpen} aria-label="Learn about pupillary distance" onClick={() => setPdInfoOpen(true)}>{pd ? `PD ~ ${pd} mm` : "PD —"}<ChevronRight size={14} aria-hidden="true" /></button><button className="tryon-close tryon-close--mobile" type="button" onClick={onClose} aria-label="Close try-on"><CloseIcon size={18} strokeWidth={1.8} aria-hidden="true" /></button></div>
        {inputMode === "live" && previewMessage && <p className="tryon-camera-message" role="status">{previewMessage}</p>}
          {inputMode === "live" && supports3D && <section className="tryon-mode-section" aria-label="Try-on mode"><div className="tryon-mode-options"><button type="button" aria-pressed={!use3D} onClick={() => setRenderMode("2d")}>2D</button><button type="button" aria-pressed={use3D} onClick={() => setRenderMode("3d")}>3D sample</button></div>{use3D && <p>Experimental photo-based model. Shape, size and side-arm fit are approximate.</p>}</section>}
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
            </> : <p className="tryon-empty-note">{inputMode === "photo" ? "Take or choose a photo to see frame suggestions." : cameraMessage}</p>}
          </section>}
        </div>
        {!previewOnly && <footer className="tryon-actions"><button className="tryon-action-primary" type="button" onClick={lensAction}>Select lenses</button><button className="tryon-action-secondary" type="button" onClick={viewDetails}>View details</button></footer>}
      </div>
      <dialog ref={pdDialogRef} id="tryon-pd-dialog" className="tryon-pd-dialog" aria-labelledby="tryon-pd-title" onCancel={(event) => { event.preventDefault(); setPdInfoOpen(false); }} onClose={() => setPdInfoOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setPdInfoOpen(false); }}>
        <div className="tryon-pd-info">
          <button type="button" className="tryon-close" aria-label="Close PD information" onClick={() => setPdInfoOpen(false)}><CloseIcon size={20} aria-hidden="true" /></button>
          <p className="tryon-eyebrow">FRAME TRY-ON GUIDE</p>
          <h2 id="tryon-pd-title">What does PD mean?</h2>
          <p>PD (pupillary distance) is the distance between your pupils, measured in millimeters.</p>
          <div className="tryon-pd-reading"><span>Current visual estimate</span><strong>{pd ? `About ${pd} mm` : "Not available yet"}</strong></div>
          <p className="tryon-pd-info-note">This camera or photo estimate is only for the on-screen preview. Have your PD measured at the clinic before using it for prescription lenses.</p>
          <button type="button" className="tryon-pd-dismiss" onClick={() => setPdInfoOpen(false)}>Got it</button>
        </div>
      </dialog>
    </section>
  </div>;
}
