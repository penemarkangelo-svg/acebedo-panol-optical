const landmarkDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function estimateFaceShape(landmarks) {
  if (!landmarks || landmarks.length < 455) return null;
  const faceHeight = landmarkDistance(landmarks[10], landmarks[152]);
  const cheekWidth = landmarkDistance(landmarks[234], landmarks[454]);
  const jawWidth = landmarkDistance(landmarks[172], landmarks[397]);
  const foreheadWidth = landmarkDistance(landmarks[103], landmarks[332]);
  if (!faceHeight || !cheekWidth) return null;

  const lengthRatio = faceHeight / cheekWidth;
  const jawRatio = jawWidth / cheekWidth;
  const foreheadRatio = foreheadWidth / cheekWidth;
  if (lengthRatio > 1.48) return { name: "Oblong", confidence: "style estimate" };
  if (foreheadRatio > jawRatio * 1.14 && lengthRatio > 1.22) return { name: "Heart", confidence: "style estimate" };
  if (lengthRatio < 1.27 && jawRatio > 0.82) return { name: "Square", confidence: "style estimate" };
  if (lengthRatio < 1.27) return { name: "Round", confidence: "style estimate" };
  return { name: "Oval", confidence: "style estimate" };
}

export function suggestedFrameShapes(faceShape) {
  const suggestions = {
    Round: ["square", "rectangle", "rectangular", "geometric"],
    Square: ["round", "oval", "aviator"],
    Heart: ["oval", "round", "cat-eye"],
    Oblong: ["round", "oval", "oversized", "wayfarer"],
    Oval: ["aviator", "round", "square", "rectangle", "cat-eye", "cateye"],
  };
  return suggestions[faceShape] || [];
}

export function getFrameRecommendations(products, faceShape) {
  const names = suggestedFrameShapes(faceShape);
  return (products || []).filter((product) => {
    const shape = String(product.frame_shape?.name || "").trim().toLowerCase().replace(/[^a-z]/g, "");
    return shape && names.some((name) => shape.includes(name.replace(/[^a-z]/g, ""))) && hasStock(product);
  });
}

export function hasStock(product) {
  const colors = product.product_colors || [];
  return colors.length ? colors.some((color) => Number(color.stock || 0) > 0) : Number(product.stock || 0) > 0;
}
