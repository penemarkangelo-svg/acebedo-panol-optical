// Optical alignment points on the StarLight evaluation image, in canvas fractions.
// Keep this calibration specific to the asset; other products retain their fit.
const STARLIGHT_PATH = "/ar/starlight-aviator-black-demo.png";
const STARLIGHT_ANCHORS = { left: { x: 0.242, y: 0.44 }, right: { x: 0.758, y: 0.44 } };
// Visual demo calibration, not a physical frame-size measurement. Apply equally
// to width and height so round lenses and the original bridge proportions remain.
const STARLIGHT_SCALE = 1.12;
const PARIS_PATH = "/ar/paris-sample-rose-gold-demo.png";
const PARIS_ANCHORS = { left: { x: 0.24, y: 0.44 }, right: { x: 0.76, y: 0.44 } };
const PARIS_SCALE = 1.12;
const FRAME_PROFILES = {
  [STARLIGHT_PATH]: { anchors: STARLIGHT_ANCHORS, scale: STARLIGHT_SCALE },
  [PARIS_PATH]: { anchors: PARIS_ANCHORS, scale: PARIS_SCALE },
  "/ar/557-cat-eye-elegance-blue-demo.png": {
    anchors: { left: { x: 0.24, y: 0.44 }, right: { x: 0.76, y: 0.44 } },
    scale: 1.12,
  },
  "/ar/gentleman-black-demo.png": {
    anchors: { left: { x: 0.24, y: 0.44 }, right: { x: 0.76, y: 0.44 } },
    scale: 1.12,
  },
  "/ar/gentleman-gray-demo.png": {
    anchors: { left: { x: 0.24, y: 0.44 }, right: { x: 0.76, y: 0.44 } },
    scale: 1.12,
  },
  "/ar/model-violet-demo.png": {
    anchors: { left: { x: 0.24, y: 0.44 }, right: { x: 0.76, y: 0.44 } },
    scale: 1.12,
  },
  "/ar/nike-square-minimal-black-demo.png": {
    anchors: { left: { x: 0.24, y: 0.44 }, right: { x: 0.76, y: 0.44 } },
    scale: 1.12,
  },
  "/ar/nike-square-minimal-blue-demo.png": {
    anchors: { left: { x: 0.24, y: 0.44 }, right: { x: 0.76, y: 0.44 } },
    scale: 1.12,
  },
};

export function framePlacement({ path, points, map, imageWidth, imageHeight }) {
  if (!points?.[33] || !points?.[263] || !imageWidth || !imageHeight) return null;
  const anchors = FRAME_PROFILES[path]?.anchors;
  const fitScale = FRAME_PROFILES[path]?.scale ?? 1;
  if (anchors && points[468] && points[473]) {
    // Iris landmarks are more stable fitting references than eyelid corners.
    const eyes = [map(points[468]), map(points[473])].sort((a, b) => a.x - b.x);
    const [left, right] = eyes;
    const distance = Math.hypot(right.x - left.x, right.y - left.y);
    if (!Number.isFinite(distance) || distance < 1) return null;
    const width = distance / (anchors.right.x - anchors.left.x) * fitScale;
    const height = width * imageHeight / imageWidth;
    return {
      x: (left.x + right.x) / 2,
      y: (left.y + right.y) / 2,
      angle: Math.atan2(right.y - left.y, right.x - left.x),
      width, height,
      offsetX: -width * (anchors.left.x + anchors.right.x) / 2,
      offsetY: -height * anchors.left.y,
    };
  }
  const left = map(points[33]), right = map(points[263]);
  const width = Math.hypot(right.x - left.x, right.y - left.y) * 1.45 * fitScale;
  const height = width * imageHeight / imageWidth;
  return {
    x: (left.x + right.x) / 2, y: (left.y + right.y) / 2,
    angle: Math.atan2(right.y - left.y, right.x - left.x),
    width, height, offsetX: -width / 2, offsetY: -height * 0.46,
  };
}
