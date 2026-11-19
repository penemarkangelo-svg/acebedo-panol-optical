import { supabase } from "./supabaseClient";

export function overlayUrl(path) {
  if (path === "/ar/starlight-aviator-black-demo.png") return `${path}?v=fit2`;
  // Bundled evaluation assets are served by Vite; admin uploads use Storage paths.
  if (typeof path === "string" && /^\/ar\/[a-zA-Z0-9_-]+\.png$/.test(path)) return path;
  return path ? supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl : "";
}

// Normalize transparent PNGs to the visible frame bounds for consistent fitting.
export async function normalizeOverlay(file) {
  if (file.type !== "image/png" || file.size > 5 * 1024 * 1024) throw new Error("Choose a transparent PNG under 5 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width > 4096 || bitmap.height > 4096) throw new Error("Image dimensions must be at most 4096 pixels.");
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, top = canvas.height, right = -1, bottom = -1, transparent = false;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const alpha = pixels[(y * canvas.width + x) * 4 + 3];
      if (alpha < 10) transparent = true;
      if (alpha > 20) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
    }
    if (!transparent || right < left) throw new Error("Use a visible frame with a transparent background and clear lens openings.");
    const output = document.createElement("canvas");
    output.width = right - left + 1; output.height = bottom - top + 1;
    output.getContext("2d").drawImage(canvas, left, top, output.width, output.height, 0, 0, output.width, output.height);
    return await new Promise((resolve, reject) => output.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare image.")), "image/png"));
  } finally { bitmap.close(); }
}
