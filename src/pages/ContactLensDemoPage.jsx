import { useState } from "react";
import { Link } from "react-router-dom";
import PhotoTryOn from "../components/PhotoTryOn";
import "../styles/TryOnModal.css";
import "../styles/ContactLensDemo.css";

const shades = [
  { name: "Original" },
  { name: "Honey Brown", rgb: [139, 100, 72], strength: 0.72, lift: 0 },
  { name: "Olive Green", rgb: [90, 125, 73], strength: 0.87, lift: 36 },
  { name: "Slate Gray", rgb: [102, 106, 112], strength: 0.90, lift: 50 },
];

const eyes = [
  {
    iris: [468, 469, 470, 471, 472],
    contour: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  },
  {
    iris: [473, 474, 475, 476, 477],
    contour: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  },
];

function luminance(red, green, blue) {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function smoothStep(start, end, value) {
  const progress = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return progress * progress * (3 - 2 * progress);
}

function drawContactLenses(context, landmarks, shade) {
  if (!shade.rgb) return;
  const pointOnPhoto = ({ x, y }) => [x * context.canvas.width, y * context.canvas.height];
  const shadeLuminance = luminance(...shade.rgb);
  const [redTint, greenTint, blueTint] = shade.rgb.map((channel) => channel - shadeLuminance);
  const patch = document.createElement("canvas");
  const patchContext = patch.getContext("2d");
  if (!patchContext) return;

  for (const { iris, contour } of eyes) {
    const irisPoints = iris.map((index) => landmarks[index]);
    const eyelidPoints = contour.map((index) => landmarks[index]);
    if (irisPoints.some((point) => !point) || eyelidPoints.some((point) => !point)) continue;

    const [[centerX, centerY], side, top, oppositeSide, bottom] = irisPoints.map(pointOnPhoto);
    const dx = side[0] - oppositeSide[0];
    const dy = side[1] - oppositeSide[1];
    const radiusX = Math.hypot(dx, dy) / 2;
    const radiusY = Math.hypot(top[0] - bottom[0], top[1] - bottom[1]) / 2;
    if (![centerX, centerY, radiusX, radiusY].every(Number.isFinite) || radiusX < 2 || radiusY < 2) continue;

    const extent = Math.max(radiusX, radiusY);
    const left = Math.max(0, Math.floor(centerX - extent));
    const topEdge = Math.max(0, Math.floor(centerY - extent));
    const right = Math.min(context.canvas.width, Math.ceil(centerX + extent));
    const bottomEdge = Math.min(context.canvas.height, Math.ceil(centerY + extent));
    const width = right - left;
    const height = bottomEdge - topEdge;
    if (width <= 0 || height <= 0) continue;

    const pixels = context.getImageData(left, topEdge, width, height);
    const cosine = dx / (2 * radiusX);
    const sine = dy / (2 * radiusX);
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const x = left + column + 0.5 - centerX;
        const y = topEdge + row + 0.5 - centerY;
        const radius = Math.hypot((x * cosine + y * sine) / radiusX, (y * cosine - x * sine) / radiusY);
        const mask = smoothStep(0.34, 0.60, radius) * (1 - smoothStep(0.72, 0.98, radius));
        const offset = (row * width + column) * 4;
        if (mask === 0) {
          pixels.data[offset + 3] = 0;
          continue;
        }

        const red = pixels.data[offset];
        const green = pixels.data[offset + 1];
        const blue = pixels.data[offset + 2];
        const light = luminance(red, green, blue);
        // Lift dark iris tones while retaining local shading, deep shadows, and reflections.
        const blend = shade.strength * mask * smoothStep(12, 42, light) * (1 - smoothStep(125, 230, Math.max(red, green, blue)));
        const tintedLight = light + shade.lift * (1 - smoothStep(55, 140, light));
        const tintScale = Math.min(1, tintedLight / 75);
        pixels.data[offset] = tintedLight + redTint * tintScale;
        pixels.data[offset + 1] = tintedLight + greenTint * tintScale;
        pixels.data[offset + 2] = tintedLight + blueTint * tintScale;
        pixels.data[offset + 3] = blend * 255;
      }
    }

    patch.width = width;
    patch.height = height;
    patchContext.putImageData(pixels, 0, 0);

    // Composite the recolored patch through the eyelid contour with antialiased edges.
    context.save();
    context.beginPath();
    const [first, ...rest] = eyelidPoints.map(pointOnPhoto);
    context.moveTo(...first);
    for (const point of rest) context.lineTo(...point);
    context.closePath();
    context.clip();

    context.globalCompositeOperation = "source-atop";
    context.drawImage(patch, left, topEdge);
    context.restore();
  }
}

function cropAroundEyes(context, [first, second]) {
  const { canvas } = context;
  const eyeDistance = Math.hypot((first.x - second.x) * canvas.width, (first.y - second.y) * canvas.height);
  if (!Number.isFinite(eyeDistance) || eyeDistance < 2) return;

  const width = Math.min(canvas.width, Math.round(eyeDistance * 2.4));
  const height = Math.min(canvas.height, Math.round(eyeDistance * 1.35));
  const centerX = (first.x + second.x) * canvas.width / 2;
  const centerY = (first.y + second.y) * canvas.height / 2;
  const left = Math.round(Math.max(0, Math.min(canvas.width - width, centerX - width / 2)));
  const top = Math.round(Math.max(0, Math.min(canvas.height - height, centerY - height / 2)));
  const closeUp = context.getImageData(left, top, width, height);
  canvas.width = width;
  canvas.height = height;
  context.putImageData(closeUp, 0, 0);
}

export default function ContactLensDemoPage() {
  const [shade, setShade] = useState(shades[1]);
  const [showCloseUp, setShowCloseUp] = useState(false);
  const [landmarks, setLandmarks] = useState(null);
  const canZoom = eyes.every(({ iris }) => landmarks?.[iris[0]]);

  return (
    <main className="contact-lens-demo">
      <Link to="/shop" className="contact-lens-demo__back">Back to shop</Link>
      <h1>Contact lens try-on demo</h1>
      <p>Choose a clear, front-facing photo with both eyes open.</p>

      <div className="contact-lens-demo__layout">
        <div className="contact-lens-demo__preview">
          <PhotoTryOn
            uploadOnly
            onFaceDetected={setLandmarks}
            renderOverlay={(context, points) => {
              drawContactLenses(context, points, shade);
              const centers = eyes.map(({ iris }) => points[iris[0]]);
              if (showCloseUp && centers.every(Boolean)) cropAroundEyes(context, centers);
            }}
          />
        </div>
        <section className="contact-lens-demo__controls" aria-labelledby="contact-lens-shades">
          <h2 id="contact-lens-shades">Lens color</h2>
          <div className="contact-lens-demo__shades" role="group" aria-labelledby="contact-lens-shades">
            {shades.map((option) => (
              <button key={option.name} type="button" aria-pressed={shade === option} onClick={() => setShade(option)}>
                {option.rgb && <span aria-hidden="true" style={{ backgroundColor: `rgb(${option.rgb.join(" ")})` }} />}
                {option.name}
              </button>
            ))}
          </div>
          <button
            className="contact-lens-demo__close-up"
            type="button"
            aria-pressed={canZoom && showCloseUp}
            disabled={!canZoom}
            onClick={() => setShowCloseUp((current) => !current)}
          >
            Eye close-up
          </button>
          <p>Sample shades are for appearance preview only. Your photo stays in your browser.</p>
        </section>
      </div>
    </main>
  );
}
