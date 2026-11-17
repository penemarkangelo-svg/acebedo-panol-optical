import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { normalizeOverlay, overlayUrl } from "../lib/arOverlay";
import TryOnModal from "./TryOnModal";

export default function ARAssetEditor({ productId, name, colors, onSaved, disabled }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);
  async function upload(color, file) {
    if (!file || busy) return;
    setBusy(true); setMessage("");
    let path;
    try {
      const blob = await normalizeOverlay(file);
      path = `${productId}/ar/${color.id}/${crypto.randomUUID()}.png`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(path, blob, { contentType: "image/png", upsert: false });
      if (uploadError) throw uploadError;
      const { data, error } = await supabase.from("product_colors").update({ ar_overlay_path: path }).eq("product_id", productId).eq("id", color.id).select("id, ar_overlay_path").single();
      if (error) throw error;
      onSaved(color.id, data.ar_overlay_path);
      setMessage(`${color.color_name} AR asset saved.`);
    } catch (error) {
      // Keep the previous linked asset intact if the new link fails.
      if (path) await supabase.storage.from("product-images").remove([path]);
      setMessage(error.message || "Could not save AR asset.");
    } finally { setBusy(false); }
  }
  return <section className="border-t border-[#e2ded6] pt-5">
    <h3 className="text-sm font-semibold">AR try-on assets</h3>
    <p className="my-2 text-xs text-[#625f58]">Upload a straight-on transparent PNG with clear lens openings, under 5 MB. Upload saves immediately for this color. Save new colors first.</p>
    <fieldset disabled={disabled || busy} className="grid gap-3">
      {colors.map((color, index) => <div key={color.id || index} className="rounded border border-[#d8d4ca] p-3">
        <strong className="text-sm">{color.color_name || "Unnamed color"}</strong>
        {color.ar_overlay_path && <img className="my-2 h-28 w-full object-contain bg-[#eee]" src={overlayUrl(color.ar_overlay_path)} alt={`${color.color_name} AR asset`} />}
        {color.id ? <div className="mt-2 flex flex-wrap items-center gap-3"><input aria-label={`Upload ${color.color_name} AR PNG`} type="file" accept="image/png" onChange={(event) => { upload(color, event.target.files[0]); event.target.value = ""; }} /><button type="button" disabled={!color.ar_overlay_path} onClick={() => setPreview(color)} className="border px-3 py-2 text-xs disabled:opacity-40">AR preview</button></div> : <p className="text-xs">Save this color before uploading.</p>}
      </div>)}
    </fieldset>
    <p role="status" className="my-2 text-xs">{busy ? "Saving AR asset…" : message}</p>
    {preview && <TryOnModal product={{ id: productId, name, product_colors: colors }} selectedColor={preview} onClose={() => setPreview(null)} previewOnly />}
  </section>;
}
