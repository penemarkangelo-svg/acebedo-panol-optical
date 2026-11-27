import { supabase } from "./supabaseClient";

export const PRESCRIPTION_FILE_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);
export const PRESCRIPTION_FILE_LIMIT = 5 * 1024 * 1024;

export function indexCurrentPrescriptionUploads(uploads) {
  const currentByOrder = new Map();
  for (const upload of uploads) {
    const current = currentByOrder.get(upload.order_id);
    if (!current || BigInt(upload.id) > BigInt(current.id)) {
      currentByOrder.set(upload.order_id, upload);
    }
  }
  return currentByOrder;
}

export async function readOrderPrescriptionReviews(orderIds) {
  if (!orderIds.length) return { data: [], error: null };
  const result = await supabase.rpc("get_order_prescription_reviews", { p_order_ids: orderIds });
  if (!["PGRST202", "42883"].includes(result.error?.code)) return result;

  // Existing clients can still view their current status before the backend update.
  const { data, error } = await supabase.from("order_prescription_uploads")
    .select("order_id, id, status")
    .in("order_id", orderIds)
    .order("id", { ascending: false });
  return { data: Array.from(indexCurrentPrescriptionUploads(data || []).values()), error };
}

export async function submitOrderPrescriptionReplacement({ orderId, userId, previousUploadId, selectedFile }) {
  const { file, fileId, extension } = selectedFile;
  const storagePath = `${userId}/orders/${orderId}/${fileId}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("prescription-uploads")
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError && !["Duplicate", "KeyAlreadyExists", "409"].includes(String(uploadError.statusCode))) {
    throw uploadError;
  }

  const { error } = await supabase.rpc("submit_order_prescription_replacement", {
    p_order_id: orderId,
    p_previous_upload_id: previousUploadId,
    p_storage_path: storagePath,
    p_filename: file.name,
    p_mime_type: file.type,
  });
  if (error) throw error;
}
