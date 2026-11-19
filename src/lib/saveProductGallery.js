import { supabase } from "./supabaseClient";

// Use the existing product_images and Storage relations, without color links.
// Checkpoint successful uploads so retrying does not upload them a second time.
export async function saveProductGallery({ productId, images, removedIds, onProgress }) {
  let working = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const primaryIndex = Math.max(0, working.findIndex((image) => image.is_primary));
  working = working.map((image, index) => ({ ...image, is_primary: index === primaryIndex, sort_order: index }));
  const uniqueRemoved = [...new Set(removedIds)];
  if (uniqueRemoved.length) {
    const { data: links, error } = await supabase.from("product_color_images").select("product_image_id").in("product_image_id", uniqueRemoved);
    if (error) throw error;
    if (links.length) throw new Error("A selected photo is still linked to a color. Remove that color link before deleting it.");
  }

  for (let index = 0; index < working.length; index++) {
    const draft = working[index];
    if (!draft.file) continue;
    const extension = draft.file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "image";
    const path = `${productId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("product-images").upload(path, draft.file);
    if (uploadError) throw uploadError;
    const { data: url } = supabase.storage.from("product-images").getPublicUrl(path);
    const { data: row, error: insertError } = await supabase.from("product_images").insert({ product_id: productId, image_url: url.publicUrl, sort_order: index, is_primary: false }).select().single();
    if (insertError) {
      await supabase.storage.from("product-images").remove([path]);
      throw insertError;
    }
    working[index] = { ...row, is_primary: index === primaryIndex, sort_order: index };
    onProgress([...working]);
    URL.revokeObjectURL(draft.preview);
  }

  const { error: clearError } = await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
  if (clearError) throw clearError;
  for (const image of working) {
    const { error } = await supabase.from("product_images").update({ is_primary: image.is_primary, sort_order: image.sort_order }).eq("product_id", productId).eq("id", image.id).select("id").single();
    if (error) throw error;
  }

  if (uniqueRemoved.length) {
    const { data: removed, error } = await supabase.from("product_images").delete().eq("product_id", productId).in("id", uniqueRemoved).select("image_url");
    if (error) throw error;
    const marker = "/storage/v1/object/public/product-images/";
    const paths = removed.map(({ image_url }) => {
      const position = String(image_url).indexOf(marker);
      if (position < 0) return null;
      const path = decodeURIComponent(image_url.slice(position + marker.length));
      return path.startsWith(`${productId}/`) ? path : null;
    }).filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("product-images").remove(paths);
      if (storageError) console.warn("Some removed product files could not be deleted from storage.");
    }
  }
  return working;
}
