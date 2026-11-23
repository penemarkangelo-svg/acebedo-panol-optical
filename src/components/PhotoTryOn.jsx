import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { Camera, ImagePlus, RotateCcw } from "lucide-react";
import { MEDIAPIPE } from "../vision-screening/constants/screeningConfig";
import { overlayUrl } from "../lib/arOverlay";
import { framePlacement } from "../ar/framePlacement";

// All image bytes and face landmarks stay in browser memory.
export default function PhotoTryOn({ path, onFaceDetected, uploadOnly = false, renderOverlay }) {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const fileInput = useRef(null);
  const [cameraState, setCameraState] = useState("starting");
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [source, setSource] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [points, setPoints] = useState(null);
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [frameError, setFrameError] = useState(false);

  useEffect(() => {
    if (source || uploadOnly) return undefined;
    let active = true;
    let stream;
    setCameraState("starting");
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera requires HTTPS and a supported browser.");
        const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (!active) { next.getTracks().forEach((track) => track.stop()); return; }
        stream = next;
        const video = videoRef.current;
        if (!video) throw new Error("Camera preview is unavailable.");
        video.srcObject = next;
        await video.play();
        if (active) setCameraState("ready");
      } catch (failure) {
        stream?.getTracks().forEach((track) => track.stop());
        if (active) { setCameraState("error"); setError(failure.name === "NotAllowedError" ? "Allow camera access to take a photo." : "Camera could not start. Check camera access and retry."); }
      }
    }
    start();
    return () => { active = false; stream?.getTracks().forEach((track) => track.stop()); };
  }, [source, cameraAttempt, uploadOnly]);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight || video.readyState < 2) return;
    try {
      const capture = document.createElement("canvas");
      const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
      capture.width = Math.max(1, Math.round(video.videoWidth * scale));
      capture.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = capture.getContext("2d");
      if (!ctx) throw new Error("Photo capture unavailable.");
      ctx.translate(capture.width, 0); ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, capture.width, capture.height);
      setSource(capture.toDataURL("image/jpeg", 0.92));
    } catch { setError("Could not capture the photo. Please try again."); }
  }

  function retake() {
    setError(""); setPhoto(null); setPoints(null); setStatus("idle");
    onFaceDetected?.(null);
    setSource(null);
  }

  useEffect(() => {
    return () => { if (source?.startsWith("blob:")) URL.revokeObjectURL(source); };
  }, [source]);

  useEffect(() => {
    if (!source) return undefined;
    let active = true;
    let detector;
    setStatus("processing");
    setError("");
    setPhoto(null);
    setPoints(null);
    onFaceDetected?.(null);
    async function process() {
      try {
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error("This photo could not be opened. Choose a JPG, PNG or WebP photo."));
          image.src = source;
        });
        if (!active) return;
        const input = document.createElement("canvas");
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        input.width = Math.max(1, Math.round(image.naturalWidth * scale));
        input.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = input.getContext("2d");
        if (!context) throw new Error("Photo preview is unavailable in this browser.");
        context.drawImage(image, 0, 0, input.width, input.height);
        setPhoto(input);
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm");
        if (!active) return;
        const next = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MEDIAPIPE.modelUrl, delegate: "CPU" },
          runningMode: "IMAGE", numFaces: 2,
          outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false,
        });
        if (!active) { next.close(); return; }
        detector = next;
        const faces = detector.detect(input).faceLandmarks || [];
        if (faces.length !== 1) throw new Error(faces.length ? "Use a photo with only one person." : "No face found. Take a clear front-facing photo with your whole face visible.");
        setPoints(faces[0]);
        onFaceDetected?.(faces[0]);
        setStatus("ready");
      } catch (failure) {
        if (active) { setError(failure.message || "Could not process this photo. Please try another."); setStatus("error"); }
      } finally {
        detector?.close();
        detector = null;
      }
    }
    process();
    return () => { active = false; detector?.close(); detector = null; };
  }, [source, onFaceDetected]);

  useEffect(() => {
    let active = true;
    setFrame(null);
    setFrameError(false);
    if (!path) return undefined;
    const image = new Image();
    image.onload = () => { if (active) setFrame(image); };
    image.onerror = () => { if (active) setFrameError(true); };
    image.src = overlayUrl(path);
    return () => { active = false; };
  }, [path]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photo) return;
    canvas.width = photo.width;
    canvas.height = photo.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(photo, 0, 0);
    if (!points) return;
    if (renderOverlay) {
      renderOverlay(ctx, points);
      return;
    }
    if (!frame) return;
    const fit = framePlacement({ path, points, map: (p) => ({ x: p.x * canvas.width, y: p.y * canvas.height }), imageWidth: frame.naturalWidth, imageHeight: frame.naturalHeight });
    if (!fit) return;
    ctx.save();
    ctx.translate(fit.x, fit.y);
    ctx.rotate(fit.angle);
    ctx.drawImage(frame, fit.offsetX, fit.offsetY, fit.width, fit.height);
    ctx.restore();
  }, [photo, points, frame, path, renderOverlay]);

  function choosePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
      setError("Choose an image under 15 MB.");
      return;
    }
    setSource(URL.createObjectURL(file));
  }

  const frameMessage = frameError ? "The frame image could not be loaded. Try another frame or color." : !path ? "No AR asset saved for this color yet." : !frame ? "Loading frame image..." : null;
  let message = error;
  if (!message && !source && !uploadOnly && cameraState === "starting") message = "Starting your camera...";
  if (!message && status === "processing") message = "Finding your face in the photo...";
  if (!message && status === "ready" && !renderOverlay) message = frameMessage;

  return <div className="tryon-photo">
    {!source && !uploadOnly && <video ref={videoRef} className="tryon-video" autoPlay muted playsInline aria-label="Camera preview for taking your photo" />}
    {photo && <canvas ref={canvasRef} className="tryon-photo-canvas" aria-label={renderOverlay ? "Your contact lens color preview" : "Your photo with the selected eyewear frame"} />}
    {message && <p className="tryon-photo-message" role="status">{message}</p>}
    <div className="tryon-photo-controls">
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={choosePhoto} aria-label="Choose a photo" />
      {uploadOnly ? <button className="tryon-upload-photo" type="button" onClick={() => fileInput.current.click()} disabled={status === "processing"}><span><ImagePlus size={19} aria-hidden="true" /></span>{source ? "Choose another photo" : "Choose photo"}</button> : source ? <>
        <button className="tryon-upload-photo" type="button" onClick={() => fileInput.current.click()} disabled={status === "processing"} title="Your photo is processed only in your browser"><span><ImagePlus size={19} aria-hidden="true" /></span>Upload photo</button>
        <button className="tryon-photo-secondary" type="button" onClick={retake} aria-label="Retake photo" title="Retake photo"><RotateCcw size={18} aria-hidden="true" /></button>
      </> : cameraState === "error" ? <button className="tryon-upload-photo" type="button" onClick={() => { setError(""); setCameraAttempt((value) => value + 1); }}><span><RotateCcw size={19} aria-hidden="true" /></span>Retry camera</button> : <button className="tryon-upload-photo tryon-take-photo" type="button" onClick={capturePhoto} disabled={cameraState !== "ready"} aria-label="Take photo"><span><Camera size={24} aria-hidden="true" /></span>Take photo</button>}
    </div>
  </div>;
}
