import { useEffect, useRef, useState } from "react";
import { overlayUrl } from "../lib/arOverlay";
import { framePlacement } from "../ar/framePlacement";

export default function FrameOverlay({ path, points, videoRef, onAssetStateChange }) {
  const canvasRef = useRef(null);
  const [image, setImage] = useState(null);
  useEffect(() => {
    setImage(null);
    onAssetStateChange?.({ path, status: path ? "loading" : "idle" });
    if (!path) return undefined;
    let active = true;
    const next = new Image();
    next.onload = () => { if (active) { setImage(next); onAssetStateChange?.({ path, status: "ready" }); } };
    next.onerror = () => { if (active) onAssetStateChange?.({ path, status: "error" }); };
    next.src = overlayUrl(path);
    return () => { active = false; };
  }, [path, onAssetStateChange]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * devicePixelRatio);
      canvas.height = Math.round(height * devicePixelRatio);
      const ctx = canvas.getContext("2d");
      ctx.scale(devicePixelRatio, devicePixelRatio);
      if (!points || !image || !video?.videoWidth) return;
      // Match the video's object-fit: cover crop, then mirror both layers together.
      const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
      const offsetX = (width - video.videoWidth * scale) / 2;
      const offsetY = (height - video.videoHeight * scale) / 2;
      const map = (p) => ({ x: p.x * video.videoWidth * scale + offsetX, y: p.y * video.videoHeight * scale + offsetY });
      const fit = framePlacement({ path, points, map, imageWidth: image.naturalWidth, imageHeight: image.naturalHeight });
      if (!fit) return;
      ctx.translate(fit.x, fit.y);
      ctx.rotate(fit.angle);
      ctx.drawImage(image, fit.offsetX, fit.offsetY, fit.width, fit.height);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [image, points, videoRef, path]);
  return <canvas ref={canvasRef} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "scaleX(-1)", pointerEvents: "none" }} />;
}
