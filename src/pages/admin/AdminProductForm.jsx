import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function AdminProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Product fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [brandId, setBrandId] = useState("");
  const [frameShapeId, setFrameShapeId] = useState("");
  const [frameMaterialId, setFrameMaterialId] = useState("");
  const [stock, setStock] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [rating, setRating] = useState("");

  // Colors
  const [colors, setColors] = useState([]);
  // Images: each entry has { image_url, is_primary, sort_order, is_file? (optional) }
  const [images, setImages] = useState([]);

  // Pending file uploads (selected but not yet uploaded to Storage)
  const [pendingFiles, setPendingFiles] = useState([]);

  // Reference data
  const [brands, setBrands] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [materials, setMaterials] = useState([]);

  // Load reference data
  useEffect(() => {
    const fetchReferenceData = async () => {
      const [brandsRes, shapesRes, materialsRes] = await Promise.all([
        supabase.from("brands").select("id, name").order("name"),
        supabase.from("frame_shapes").select("id, name").order("name"),
        supabase.from("frame_materials").select("id, name").order("name"),
      ]);
      if (brandsRes.data) setBrands(brandsRes.data);
      if (shapesRes.data) setShapes(shapesRes.data);
      if (materialsRes.data) setMaterials(materialsRes.data);
    };
    fetchReferenceData();
  }, []);

  // If editing, load product data (including existing images)
  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*, product_colors(*), product_images(*)")
        .eq("id", id)
        .single();
      if (error) {
        console.error(error);
        alert("Failed to load product.");
        navigate("/admin/products");
      } else if (data) {
        setName(data.name || "");
        setDescription(data.description || "");
        setPrice(data.price?.toString() || "");
        setOldPrice(data.old_price?.toString() || "");
        setBrandId(data.brand_id?.toString() || "");
        setFrameShapeId(data.frame_shape_id?.toString() || "");
        setFrameMaterialId(data.frame_material_id?.toString() || "");
        setStock(data.stock?.toString() || "");
        setIsNew(data.is_new || false);
        setRating(data.rating?.toString() || "");
        setColors(data.product_colors || []);
        setImages(data.product_images || []);
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id, navigate]);

  // Color helpers
  const addColor = () => {
    setColors([...colors, { color_name: "", color_code: "#000000", stock: 0 }]);
  };
  const updateColor = (index, field, value) => {
    const updated = [...colors];
    updated[index][field] = value;
    setColors(updated);
  };
  const removeColor = (index) => {
    setColors(colors.filter((_, i) => i !== index));
  };

  // Image helpers for external URLs (kept from original)
  const addImageUrl = () => {
    setImages([
      ...images,
      { image_url: "", is_primary: false, sort_order: images.length },
    ]);
  };
  const updateImageUrl = (index, field, value) => {
    const updated = [...images];
    updated[index][field] = value;
    setImages(updated);
  };
  const removeImageUrl = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // File upload handling
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newPending = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      is_primary: false,
      sort_order: images.length + pendingFiles.length,
    }));
    setPendingFiles((prev) => [...prev, ...newPending]);
  };

  const updatePendingFile = (index, field, value) => {
    const updated = [...pendingFiles];
    updated[index][field] = value;
    setPendingFiles(updated);
  };
  const removePendingFile = (index) => {
    setPendingFiles(pendingFiles.filter((_, i) => i !== index));
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !price || !brandId || !frameShapeId || !frameMaterialId) {
      alert("Please fill in all required fields.");
      return;
    }

    setSaving(true);

    // Prepare product data
    const productPayload = {
      name,
      description,
      price: parseFloat(price),
      old_price: oldPrice ? parseFloat(oldPrice) : null,
      brand_id: parseInt(brandId),
      frame_shape_id: parseInt(frameShapeId),
      frame_material_id: parseInt(frameMaterialId),
      stock: stock ? parseInt(stock) : 0,
      is_new: isNew,
      rating: rating ? parseFloat(rating) : 0,
      updated_at: new Date().toISOString(),
    };

    let productId = id ? parseInt(id) : null;

    try {
      // 1. Save product (insert or update)
      if (productId) {
        const { error: updateError } = await supabase
          .from("products")
          .update(productPayload)
          .eq("id", productId);
        if (updateError) throw updateError;
      } else {
        const { data: newProduct, error: insertError } = await supabase
          .from("products")
          .insert([{ ...productPayload, created_at: new Date().toISOString() }])
          .select()
          .single();
        if (insertError) throw insertError;
        productId = newProduct.id;
      }

      // 2. Handle uploaded files (upload to Storage and collect URLs)
      const uploadedImageEntries = [];
      for (const p of pendingFiles) {
        const fileExt = p.file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)}.${fileExt}`;
        const filePath = `${productId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, p.file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(filePath);
        uploadedImageEntries.push({
          image_url: urlData.publicUrl,
          is_primary: p.is_primary,
          sort_order: p.sort_order,
        });
      }

      // 3. Combine existing URL images + newly uploaded images
      const allImages = [...images, ...uploadedImageEntries];

      // 4. Replace product_colors
      if (productId) {
        if (id) {
          await supabase
            .from("product_colors")
            .delete()
            .eq("product_id", productId);
        }
        if (colors.length) {
          const colorsToInsert = colors.map((c) => ({
            product_id: productId,
            color_name: c.color_name,
            color_code: c.color_code || null,
            stock: parseInt(c.stock) || 0,
          }));
          const { error: colorsError } = await supabase
            .from("product_colors")
            .insert(colorsToInsert);
          if (colorsError) console.error("Color insert error:", colorsError);
        }
      }

      // 5. Replace product_images
      if (productId) {
        if (id) {
          await supabase
            .from("product_images")
            .delete()
            .eq("product_id", productId);
        }
        if (allImages.length) {
          const imagesToInsert = allImages.map((img, idx) => ({
            product_id: productId,
            image_url: img.image_url,
            is_primary: img.is_primary || false,
            sort_order: img.sort_order !== undefined ? img.sort_order : idx,
          }));
          const { error: imagesError } = await supabase
            .from("product_images")
            .insert(imagesToInsert);
          if (imagesError) console.error("Image insert error:", imagesError);
        }
      }

      navigate("/admin/products");
    } catch (err) {
      console.error(err);
      alert("Error saving product: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading product data...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {id ? "Edit Product" : "Add New Product"}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white p-6 rounded-xl shadow"
      >
        {/* Basic Info (unchanged) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Price (₱) *
            </label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Old Price (₱)
            </label>
            <input
              type="number"
              step="0.01"
              value={oldPrice}
              onChange={(e) => setOldPrice(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Stock
            </label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Brand *
            </label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="">Select brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Frame Shape *
            </label>
            <select
              value={frameShapeId}
              onChange={(e) => setFrameShapeId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="">Select shape</option>
              {shapes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Frame Material *
            </label>
            <select
              value={frameMaterialId}
              onChange={(e) => setFrameMaterialId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="">Select material</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Rating (0‑5)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isNew}
              onChange={(e) => setIsNew(e.target.checked)}
            />
            <label className="text-sm font-medium text-gray-700">
              Mark as New Arrival
            </label>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            rows="4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {/* Colors (unchanged) */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Colors
            </label>
            <button
              type="button"
              onClick={addColor}
              className="text-sm text-[#D32F2F] hover:underline"
            >
              + Add Color
            </button>
          </div>
          {colors.map((color, idx) => (
            <div key={idx} className="flex gap-2 items-center mb-2">
              <input
                type="text"
                placeholder="Color name"
                value={color.color_name}
                onChange={(e) => updateColor(idx, "color_name", e.target.value)}
                className="flex-1 border rounded px-2 py-1"
              />
              <input
                type="color"
                value={color.color_code || "#000000"}
                onChange={(e) => updateColor(idx, "color_code", e.target.value)}
                className="w-10 h-10 border"
              />
              <input
                type="number"
                placeholder="Stock"
                value={color.stock}
                onChange={(e) => updateColor(idx, "stock", e.target.value)}
                className="w-24 border rounded px-2 py-1"
              />
              <button
                type="button"
                onClick={() => removeColor(idx)}
                className="text-red-500"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* ========== NEW: Upload Images from local files ========== */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Images
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#D32F2F] file:text-white hover:file:bg-[#B71C1C]"
          />
          <div className="mt-2 flex flex-wrap gap-3">
            {pendingFiles.map((p, idx) => (
              <div key={idx} className="relative w-24 border rounded p-1">
                <img
                  src={p.preview}
                  alt="preview"
                  className="w-full h-20 object-cover rounded"
                />
                <div className="text-xs mt-1 text-center">
                  <label className="flex items-center justify-center gap-1">
                    <input
                      type="checkbox"
                      checked={p.is_primary}
                      onChange={(e) =>
                        updatePendingFile(idx, "is_primary", e.target.checked)
                      }
                    />{" "}
                    Primary
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removePendingFile(idx)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            You can upload multiple images. First click "Save Product" to upload
            them.
          </p>
        </div>

        {/* ========== Existing images (URLs) – kept for manual entries ========== */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Images from URLs
            </label>
            <button
              type="button"
              onClick={addImageUrl}
              className="text-sm text-[#D32F2F] hover:underline"
            >
              + Add External URL
            </button>
          </div>
          {images.map((img, idx) => (
            <div key={idx} className="flex gap-2 items-center mb-2">
              <input
                type="url"
                placeholder="Image URL"
                value={img.image_url}
                onChange={(e) =>
                  updateImageUrl(idx, "image_url", e.target.value)
                }
                className="flex-1 border rounded px-2 py-1"
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={img.is_primary}
                  onChange={(e) =>
                    updateImageUrl(idx, "is_primary", e.target.checked)
                  }
                />{" "}
                Primary
              </label>
              <button
                type="button"
                onClick={() => removeImageUrl(idx)}
                className="text-red-500"
              >
                Remove
              </button>
            </div>
          ))}
          <p className="text-xs text-gray-500 mt-1">
            You can also paste external image URLs (e.g., from Unsplash).
          </p>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/products")}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-[#D32F2F] text-white rounded-lg hover:bg-[#B71C1C] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
