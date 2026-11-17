import toast from "react-hot-toast";

export default function ProductImageGallery({ images, onChange, onRemove, disabled }) {
  const ordered = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const primary = ordered.find((image) => image.is_primary) || ordered[0];
  const keyOf = (image) => image.id ? `saved-${image.id}` : image.draft_key;

  const chooseFiles = (files, replacing = null) => {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    if (selected.some((file) => !file.type.startsWith("image/"))) {
      toast.error("Choose image files only.");
      return;
    }
    const drafts = selected.map((file, index) => ({ file, preview: URL.createObjectURL(file), draft_key: crypto.randomUUID(), is_primary: replacing ? replacing === primary : !ordered.length && index === 0, sort_order: replacing ? replacing.sort_order : ordered.length + index }));
    if (replacing) {
      onRemove(replacing);
      onChange(ordered.map((image) => image === replacing ? drafts[0] : image));
    } else {
      onChange([...ordered, ...drafts]);
    }
  };

  const remove = (photo) => {
    onRemove(photo);
    const remaining = ordered.filter((image) => keyOf(image) !== keyOf(photo));
    const nextPrimary = remaining.find((image) => image !== photo && image === primary) || remaining[0];
    onChange(remaining.map((image, index) => ({ ...image, sort_order: index, is_primary: image === nextPrimary })));
  };

  return (
    <section className="apo-product-gallery" aria-labelledby="apo-product-gallery-title">
      <div className="apo-panel-heading"><div><h2 id="apo-product-gallery-title">Product photos</h2><p>Choose one primary photo for the catalog.</p></div><label className="apo-editor-secondary apo-product-gallery-upload">Add images<input className="sr-only" type="file" accept="image/*" multiple disabled={disabled} onChange={(event) => { chooseFiles(event.target.files); event.target.value = ""; }} /></label></div>
      {!ordered.length ? <p className="apo-editor-gallery-hint">No photos yet. Add images to start the gallery.</p> : <div className="apo-product-gallery-grid">{ordered.map((photo, index) => (
        <article className="apo-product-gallery-card" key={keyOf(photo)}>
          <img src={photo.preview || photo.image_url} alt={`Product photo ${index + 1}`} />
          <div className="apo-product-gallery-card-content"><strong>{photo === primary ? "Primary photo" : `Photo ${index + 1}`}</strong><div className="apo-product-gallery-card-actions">
            {photo !== primary && <button type="button" disabled={disabled} onClick={() => onChange(ordered.map((image) => ({ ...image, is_primary: image === photo })))}>Set primary</button>}
            <label className="apo-product-gallery-upload">Replace<input className="sr-only" type="file" accept="image/*" disabled={disabled} onChange={(event) => { chooseFiles(event.target.files, photo); event.target.value = ""; }} /></label>
            <button type="button" disabled={disabled} className="is-danger" onClick={() => remove(photo)}>Remove</button>
          </div></div>
        </article>
      ))}</div>}
    </section>
  );
}
