export const PRODUCT_TYPES = [
  { value: "eyeglasses", label: "Eyeglasses" },
  { value: "sunglasses", label: "Sunglasses" },
  { value: "accessory", label: "Accessories" },
  { value: "eyedrops", label: "Eyedrops" },
];

const legacyEyedropIds = new Set([23, 24, 25]);

export function getProductCategory(product) {
  if (!product) return "";
  if (product.type === "frame") return "eyeglasses";
  if (product.type === "accessory") {
    return legacyEyedropIds.has(Number(product.id)) ? "eyedrops" : "accessory";
  }
  return product.type || "";
}

export function isEyewearType(type) {
  return ["frame", "eyeglasses", "sunglasses"].includes(type);
}

export function requiresLensPackage(type) {
  return type === "frame" || type === "eyeglasses";
}

export function usesVariantStock(type) {
  return isEyewearType(type);
}

export function finalProductType(type, productId) {
  if (type === "frame") return "eyeglasses";
  if (type === "accessory" && legacyEyedropIds.has(Number(productId))) return "eyedrops";
  return type === "accessory" ? "accessory" : type;
}

export function preserveLegacyProductType(finalType, originalType, productId) {
  if (!originalType || !["frame", "accessory"].includes(originalType)) return finalType;
  return finalProductType(originalType, productId) === finalType ? originalType : finalType;
}
