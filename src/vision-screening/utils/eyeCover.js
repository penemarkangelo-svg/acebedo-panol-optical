const EYE_CONTOUR_INDICES = {
  // MediaPipe Face Landmarker anatomical left/right eye contours.
  left: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  right: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
};

function getEyeRegion(faceLandmarks, eye) {
  const indices = EYE_CONTOUR_INDICES[eye];
  if (!indices || !faceLandmarks || indices.some((index) => !faceLandmarks[index])) return null;

  const points = indices.map((index) => faceLandmarks[index]);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = maxX - minX;
  const height = maxY - minY;

  if (width <= 0 || height <= 0) return null;

  // Add a margin around the eyelid contour to account for palm/finger coverage.
  return {
    minX: minX - width * 0.35,
    maxX: maxX + width * 0.35,
    minY: minY - width * 0.2,
    maxY: maxY + width * 0.2,
  };
}

function getConvexHull(points) {
  if (points.length < 3) return [];

  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (origin, a, b) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const lower = [];
  const upper = [];

  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }

  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function clipPolygonToRect(polygon, rect) {
  const edges = [
    { inside: (point) => point.x >= rect.minX, intersect: (a, b) => ({ x: rect.minX, y: a.y + ((b.y - a.y) * (rect.minX - a.x)) / (b.x - a.x) }) },
    { inside: (point) => point.x <= rect.maxX, intersect: (a, b) => ({ x: rect.maxX, y: a.y + ((b.y - a.y) * (rect.maxX - a.x)) / (b.x - a.x) }) },
    { inside: (point) => point.y >= rect.minY, intersect: (a, b) => ({ x: a.x + ((b.x - a.x) * (rect.minY - a.y)) / (b.y - a.y), y: rect.minY }) },
    { inside: (point) => point.y <= rect.maxY, intersect: (a, b) => ({ x: a.x + ((b.x - a.x) * (rect.maxY - a.y)) / (b.y - a.y), y: rect.maxY }) },
  ];

  let output = polygon;
  for (const edge of edges) {
    const input = output;
    output = [];
    if (!input.length) break;

    let previous = input.at(-1);
    for (const current of input) {
      const previousInside = edge.inside(previous);
      const currentInside = edge.inside(current);
      if (currentInside) {
        if (!previousInside) output.push(edge.intersect(previous, current));
        output.push(current);
      } else if (previousInside) {
        output.push(edge.intersect(previous, current));
      }
      previous = current;
    }
  }
  return output;
}

function polygonArea(polygon) {
  if (polygon.length < 3) return 0;
  return Math.abs(polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

/** Returns the largest fraction of an eye region overlapped by a detected hand. */
export function getHandEyeOverlap(faceLandmarks, handLandmarks, eye) {
  const eyeRegion = getEyeRegion(faceLandmarks, eye);
  if (!eyeRegion || !Array.isArray(handLandmarks)) return 0;

  const eyeArea = (eyeRegion.maxX - eyeRegion.minX) * (eyeRegion.maxY - eyeRegion.minY);
  if (eyeArea <= 0) return 0;

  return handLandmarks.reduce((largestOverlap, hand) => {
    if (!Array.isArray(hand) || hand.length < 3) return largestOverlap;
    const points = hand.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
    const hull = getConvexHull(points);
    const overlap = polygonArea(clipPolygonToRect(hull, eyeRegion)) / eyeArea;
    return Math.max(largestOverlap, overlap);
  }, 0);
}

export function isEyeCoveredByHand(faceLandmarks, handLandmarks, eye, minimumOverlap = 0.14) {
  return getHandEyeOverlap(faceLandmarks, handLandmarks, eye) >= minimumOverlap;
}

export function updateHandCoverConfidence(score, overlapDetected, maxScore = 3, missDecay = 0.5) {
  return overlapDetected
    ? Math.min(score + 1, maxScore)
    : Math.max(score - missDecay, 0);
}
