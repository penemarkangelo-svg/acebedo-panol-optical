import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { PRODUCT_TYPES, finalProductType, isEyewearType, preserveLegacyProductType, usesVariantStock } from "../../utils/productTypes";
import toast from "react-hot-toast";
import "../../styles/AdminProductForm.css";
import { PRODUCT_LABEL_OPTIONS } from "../../utils/productLabels";
import ProductImageGallery from "../../components/ProductImageGallery";
import ARAssetEditor from "../../components/ARAssetEditor";
import { saveProductGallery } from "../../lib/saveProductGallery";

function parseOptionalThreshold(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

export default function AdminProductForm({ fromMedia = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [savedProductId, setSavedProductId] = useState(id ? parseInt(id, 10) : null);
  const returnPath = fromMedia ? "/admin/product-media" : "/admin/products";
  const [step, setStep] = useState(fromMedia || location.state?.step === 2 ? 2 : 1);

  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const savedStateUpdate = useRef(true);

  // Product fields
  const [type, setType] = useState("eyeglasses");
  const [storedType, setStoredType] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [brandId, setBrandId] = useState("");
  const [frameShapeId, setFrameShapeId] = useState("");
  const [frameMaterialId, setFrameMaterialId] = useState("");
  const [stock, setStock] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [productLabels, setProductLabels] = useState([]);
  const [rating, setRating] = useState("");

  const [colors, setColors] = useState([]);
  const [originalColorIds, setOriginalColorIds] = useState([]);
  const [images, setImages] = useState([]);
  const [removedProductImageIds, setRemovedProductImageIds] = useState([]);
  const [mediaDirty, setMediaDirty] = useState(false);
  const [expandedColorIndex, setExpandedColorIndex] = useState(null);
  const [removedGalleryImageIds, setRemovedGalleryImageIds] = useState([]);

  const [brands, setBrands] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [materials, setMaterials] = useState([]);

  // Track unsaved changes
  useEffect(() => {
    if (loading) return;
    if (savedStateUpdate.current) {
      savedStateUpdate.current = false;
      setHasUnsavedChanges(false);
      return;
    }
    setHasUnsavedChanges(true);
  }, [
    type,
    name,
    description,
    price,
    oldPrice,
    brandId,
    frameShapeId,
    frameMaterialId,
    stock,
    lowStockThreshold,
    isNew,
    productLabels,
    rating,
    colors,
    images,
    removedGalleryImageIds,
    removedProductImageIds,
  ]);

  useEffect(() => {
    if (fromMedia) return;
    const fetchReferenceData = async () => {
      const [brandsRes, attributesRes] = await Promise.all([
        supabase.from("brands").select("id, name").order("name"),
        supabase.from("frame_attributes").select("id, name, attribute_type").order("name"),
      ]);
      if (brandsRes.error) toast.error("Failed to load brands");
      else setBrands(brandsRes.data || []);
      if (attributesRes.error) {
        toast.error("Failed to load frame specifications");
      } else {
        const attributes = attributesRes.data || [];
        setShapes(attributes.filter((attribute) => attribute.attribute_type === "shape"));
        setMaterials(attributes.filter((attribute) => attribute.attribute_type === "material"));
      }
    };
    fetchReferenceData();
  }, [fromMedia]);

  useEffect(() => {
    if (!id) return;
    let current = true;
    const fetchProduct = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*, product_colors(*, product_color_images(product_image_id, sort_order, is_primary, product_images!product_color_images_image_product_fkey(id, image_url, is_primary, sort_order))), product_images(*)")
        .eq("id", id)
        .single();
      if (!current) return;
      if (error) {
        toast.error("Failed to load product.");
        navigate(returnPath, { replace: true });
      } else {
        savedStateUpdate.current = true;
        setMediaDirty(false);
        setRemovedProductImageIds([]);
        setSavedProductId(data.id);
        setStoredType(data.type || "frame");
        setType(finalProductType(data.type || "frame", data.id));
        setName(data.name || "");
        setDescription(data.description || "");
        setPrice(data.price?.toString() || "");
        setOldPrice(data.old_price?.toString() || "");
        setStock(data.stock?.toString() || "");
        setLowStockThreshold(data.low_stock_threshold?.toString() || "");
        setIsNew(data.is_new || false);
        setProductLabels(data.product_labels || []);
        setRating(data.rating?.toString() || "");
        const productImages = data.product_images || [];
        setColors((data.product_colors || []).map((color) => {
          const linkedPhotos = [...(color.product_color_images || [])]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((link) => ({
              ...link.product_images,
              sort_order: link.sort_order,
              is_primary: Boolean(link.is_primary),
            }))
            .filter((image) => image.id);
          const legacyPhoto = productImages.find((image) => Number(image.id) === Number(color.image_id));
          const galleryImages = linkedPhotos.length ? linkedPhotos : legacyPhoto ? [{ ...legacyPhoto, is_primary: true }] : [];
          return { ...color, gallery_images: galleryImages, pending_gallery_files: [], removed_gallery_ids: [] };
        }));
        setOriginalColorIds((data.product_colors || []).map((color) => color.id));
        if (fromMedia) setExpandedColorIndex(data.product_colors?.length ? 0 : null);
        setImages(productImages);
        setBrandId(data.brand_id?.toString() || "");
        setFrameShapeId(data.frame_shape_id?.toString() || "");
        setFrameMaterialId(data.frame_material_id?.toString() || "");
      }
      setLoading(false);
      setHasUnsavedChanges(false);
    };
    fetchProduct();
    return () => { current = false; };
  }, [fromMedia, id, navigate, returnPath]);

  const addColor = () => {
    setMediaDirty(true);
    setColors([...colors, { color_name: "", color_code: "#000000", stock: 0, low_stock_threshold: null, image_id: null, sort_order: colors.length, gallery_images: [], pending_gallery_files: [], removed_gallery_ids: [] }]);
    setExpandedColorIndex(colors.length);
  };
  const updateColor = (index, field, value) => {
    setMediaDirty(true);
    const updated = [...colors];
    updated[index][field] = value;
    setColors(updated);
  };
  const removeColor = (index) => {
    setMediaDirty(true);
    setColors(colors.filter((_, i) => i !== index));
    setExpandedColorIndex((selected) => selected === index ? null : selected > index ? selected - 1 : selected);
  };

  const addColorPhotos = (colorIndex, fileList, makePrimary = false, targetSlot = null) => {
    const selectedFiles = Array.from(fileList || []);
    if (!selectedFiles.length) return;
    setMediaDirty(true);
    setColors((previous) => previous.map((color, index) => {
      if (index !== colorIndex) return color;
      const allPhotos = [...(color.gallery_images || []), ...(color.pending_gallery_files || [])]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const existing = allPhotos.filter((photo) => !photo.file);
      const pending = allPhotos.filter((photo) => photo.file);
      const shouldUsePrimary = makePrimary || (existing.length === 0 && pending.length === 0);
      const newPending = selectedFiles.map((file, fileIndex) => ({
        file,
        preview: URL.createObjectURL(file),
        is_primary: shouldUsePrimary && fileIndex === 0,
        sort_order: targetSlot === null ? allPhotos.length + fileIndex : targetSlot + 1 + fileIndex,
        draft_key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }));
      let nextPhotos = [...allPhotos];
      if (targetSlot !== null) {
        const replaced = nextPhotos.find((photo) => Number(photo.sort_order) === targetSlot + 1);
        if (replaced?.id) setRemovedGalleryImageIds((removed) => [...new Set([...removed, replaced.id])]);
        if (replaced?.preview) URL.revokeObjectURL(replaced.preview);
        nextPhotos = nextPhotos.filter((photo) => Number(photo.sort_order) !== targetSlot + 1);
        nextPhotos = [...nextPhotos, ...newPending];
      } else {
        nextPhotos = [...nextPhotos, ...newPending];
      }
      if (shouldUsePrimary) {
        nextPhotos = [newPending[0], ...nextPhotos.filter((photo) => photo !== newPending[0])]
          .map((photo, photoIndex) => ({ ...photo, is_primary: photoIndex === 0, sort_order: photoIndex }));
      }
      return {
        ...color,
        gallery_images: nextPhotos.filter((photo) => !photo.file),
        pending_gallery_files: nextPhotos.filter((photo) => photo.file),
      };
    }));
  };

  const replaceColorPhoto = (colorIndex, photo, fileList) => {
    const selectedFile = Array.from(fileList || [])[0];
    if (!selectedFile) return;
    setMediaDirty(true);
    const replacedKey = photo.id ? String(photo.id) : photo.draft_key;
    setColors((previous) => previous.map((color, index) => {
      if (index !== colorIndex) return color;
      const allPhotos = [...(color.gallery_images || []), ...(color.pending_gallery_files || [])]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const replaced = allPhotos.find((image) => image.id ? String(image.id) === replacedKey : image.draft_key === replacedKey);
      if (!replaced) return color;
      if (replaced.id) {
        setRemovedGalleryImageIds((removed) => [...new Set([...removed, replaced.id])]);
      }
      if (replaced.preview) URL.revokeObjectURL(replaced.preview);
      const replacement = {
        file: selectedFile,
        preview: URL.createObjectURL(selectedFile),
        is_primary: Boolean(replaced.is_primary),
        sort_order: replaced.sort_order,
        draft_key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
      const nextPhotos = allPhotos.map((image) => image === replaced ? replacement : image);
      return {
        ...color,
        gallery_images: nextPhotos.filter((image) => !image.file),
        pending_gallery_files: nextPhotos.filter((image) => image.file),
        removed_gallery_ids: replaced.id ? [...new Set([...(color.removed_gallery_ids || []), replaced.id])] : (color.removed_gallery_ids || []),
      };
    }));
  };

  const setColorPhotoPrimary = (colorIndex, photoKey) => {
    setMediaDirty(true);
    setColors((previous) => previous.map((color, index) => {
      if (index !== colorIndex) return color;
      const allPhotos = [...(color.gallery_images || []), ...(color.pending_gallery_files || [])]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const primary = allPhotos.find((image) => image.id ? String(image.id) === String(photoKey) : image.draft_key === photoKey);
      const oldPrimary = allPhotos.find((image) => image.is_primary) || allPhotos[0];
      const oldPrimarySlot = primary?.sort_order;
      const orderedPhotos = allPhotos.map((image) => ({
        ...image,
        is_primary: image === primary,
        sort_order: image === primary ? 0 : image === oldPrimary ? oldPrimarySlot : image.sort_order,
      }));
      return {
        ...color,
        gallery_images: orderedPhotos.filter((image) => !image.file),
        pending_gallery_files: orderedPhotos.filter((image) => image.file),
      };
    }));
  };

  const removeColorPhoto = (colorIndex, photo) => {
    setMediaDirty(true);
    setColors((previous) => previous.map((color, index) => {
      if (index !== colorIndex) return color;
      const allPhotos = [...(color.gallery_images || []), ...(color.pending_gallery_files || [])]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const wasPrimary = Boolean(photo.is_primary);
      const remaining = allPhotos.filter((image) => image.id ? image.id !== photo.id : image.draft_key !== photo.draft_key);
      const nextPrimary = wasPrimary ? remaining[0] : remaining.find((image) => image.is_primary);
      const orderedPhotos = remaining.map((image) => ({
        ...image,
        is_primary: image === nextPrimary,
        sort_order: image === nextPrimary ? 0 : image.sort_order,
      }));
      return {
        ...color,
        gallery_images: orderedPhotos.filter((image) => !image.file),
        pending_gallery_files: orderedPhotos.filter((image) => image.file),
        removed_gallery_ids: photo.id ? [...new Set([...(color.removed_gallery_ids || []), photo.id])] : (color.removed_gallery_ids || []),
        image_id: Number(color.image_id) === Number(photo.id) ? null : color.image_id,
      };
    }));
    if (photo.id) setRemovedGalleryImageIds((previous) => [...new Set([...previous, photo.id])]);
    if (photo.preview) URL.revokeObjectURL(photo.preview);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowCancelModal(true);
    } else {
      navigate(returnPath);
    }
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    navigate(returnPath);
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!name || !price) {
      toast.error("Name and price are required.");
      return;
    }
    if (isEyewearType(type) && !brandId) {
      toast.error("Choose a brand for this product.");
      return;
    }
    if (isEyewearType(type) && (!frameShapeId || !frameMaterialId)) {
      toast.error("Choose a frame shape and material for eyewear.");
      return;
    }
    if (!usesVariantStock(type) && colors.some((color) => color.id)) {
      toast.error("This product still has saved colors. Remove them while its eyewear category is selected before changing category.");
      return;
    }
    if (!usesVariantStock(type) && (!Number.isInteger(Number(stock || 0)) || Number(stock || 0) < 0)) {
      toast.error("Stock must be a whole number of zero or more.");
      return;
    }
    const parsedThreshold = parseOptionalThreshold(lowStockThreshold);
    if (Number.isNaN(parsedThreshold)) {
      toast.error("Enter a whole-number low-stock threshold of zero or more, or leave it blank.");
      return;
    }

    const productPayload = {
      name,
      description,
      price: parseFloat(price),
      old_price: oldPrice ? parseFloat(oldPrice) : null,
      is_new: isNew,
      product_labels: productLabels,
      rating: rating ? parseFloat(rating) : 0,
      low_stock_threshold: parsedThreshold,
      type: preserveLegacyProductType(type, storedType, savedProductId),
      updated_at: new Date().toISOString(),
    };

    productPayload.brand_id = brandId ? parseInt(brandId, 10) : null;
    if (!usesVariantStock(type)) productPayload.stock = Number(stock || 0);
    if (isEyewearType(type)) {
      productPayload.frame_shape_id = parseInt(frameShapeId);
      productPayload.frame_material_id = parseInt(frameMaterialId);
    } else {
      productPayload.frame_shape_id = null;
      productPayload.frame_material_id = null;
    }

    setSaving(true);
    try {
      let productId = savedProductId;
      if (productId) {
        const { error } = await supabase
          .from("products")
          .update(productPayload)
          .eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert([{ ...productPayload, created_at: new Date().toISOString() }])
          .select()
          .single();
        if (error) throw error;
        productId = data.id;
        setSavedProductId(productId);
      }

      if (!id) navigate(`/admin/products/${productId}/edit`, { replace: true, state: { step: 2 } });
      setStoredType(productPayload.type);
      setHasUnsavedChanges(mediaDirty);
      toast.success(usesVariantStock(type) ? "Product details saved. Continue with colors and images." : "Product details saved. Continue with images.");
      setStep(2);
    } catch (err) {
      console.error(err);
      if (err.code === "23514" || String(err.message || "").includes("products_type_check")) {
        toast.error("The product category was rejected by the database. Refresh the page and try again.");
      } else {
        toast.error("Error saving product details: " + err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVariants = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!savedProductId) {
      toast.error("Save product details before adding colors and images.");
      setStep(1);
      return;
    }
    const activeColors = usesVariantStock(type) ? colors : [];
    const hasInvalidVariantThreshold = activeColors.some((color) => Number.isNaN(parseOptionalThreshold(color.low_stock_threshold)));
    if (hasInvalidVariantThreshold) {
      toast.error("Enter a whole-number threshold of zero or more for each color, or leave it blank to inherit the product threshold.");
      return;
    }

    setSaving(true);
    try {
      const productId = savedProductId;
      const savedColors = [];
      for (const [index, color] of activeColors.entries()) {
        const primaryPhoto = (color.gallery_images || []).find((image) => image.is_primary);
        const colorPayload = {
          product_id: productId,
          color_name: color.color_name.trim(),
          color_code: color.color_code || null,
          stock: Math.max(0, parseInt(color.stock, 10) || 0),
          low_stock_threshold: parseOptionalThreshold(color.low_stock_threshold),
          image_id: primaryPhoto?.id ? Number(primaryPhoto.id) : null,
          sort_order: index,
        };
        if (!colorPayload.color_name) throw new Error(`Enter a name for color ${index + 1}.`);
        if (color.id) {
          const { data, error } = await supabase.from("product_colors").update(colorPayload).eq("id", color.id).eq("product_id", productId).select().single();
          if (error) throw error;
          savedColors.push({ ...data, gallery_images: color.gallery_images || [], pending_gallery_files: color.pending_gallery_files || [], removed_gallery_ids: color.removed_gallery_ids || [] });
        } else {
          const { data, error } = await supabase.from("product_colors").insert(colorPayload).select().single();
          if (error) throw error;
          savedColors.push({ ...data, gallery_images: color.gallery_images || [], pending_gallery_files: color.pending_gallery_files || [], removed_gallery_ids: color.removed_gallery_ids || [] });
        }
      }

      const retainedColorIds = new Set(savedColors.map((color) => color.id));
      const removedColorIds = originalColorIds.filter((colorId) => !retainedColorIds.has(colorId));
      if (removedColorIds.length) {
        const { error } = await supabase.from("product_colors").delete().eq("product_id", productId).in("id", removedColorIds);
        if (error) throw error;
      }

      const removedImageIds = [...new Set([
        ...removedGalleryImageIds,
        ...savedColors.flatMap((color) => color.removed_gallery_ids || []),
      ])];

      for (const color of savedColors) {
        const currentPhotos = (color.gallery_images || []).filter((photo) => photo.id && !removedImageIds.includes(photo.id));
        const uploadedPhotos = [];
        for (const pending of color.pending_gallery_files || []) {
          const fileExt = pending.file.name.split(".").pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
          const filePath = `${productId}/${fileName}`;
          const { error: uploadError } = await supabase.storage.from("product-images").upload(filePath, pending.file);
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath);
          const { data, error } = await supabase.from("product_images").insert({
            product_id: productId,
            image_url: urlData.publicUrl,
            is_primary: false,
            sort_order: Number(pending.sort_order) || currentPhotos.length + uploadedPhotos.length,
          }).select().single();
          if (error) throw error;
          uploadedPhotos.push({ ...data, is_primary: Boolean(pending.is_primary), sort_order: pending.sort_order });
          URL.revokeObjectURL(pending.preview);
        }

        const photos = [...currentPhotos, ...uploadedPhotos]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((photo, index) => ({
          ...photo,
          is_primary: Boolean(photo.is_primary),
            sort_order: Number.isFinite(Number(photo.sort_order)) ? Number(photo.sort_order) : index,
          }));
        const primaryPhoto = photos.find((photo) => photo.is_primary) || photos[0] || null;
        const { error: clearLinksError } = await supabase.from("product_color_images").delete().eq("product_color_id", color.id);
        if (clearLinksError) throw clearLinksError;
        if (photos.length) {
          const { error: linkError } = await supabase.from("product_color_images").insert(photos.map((photo, index) => ({
            product_id: productId,
            product_color_id: color.id,
            product_image_id: photo.id,
            sort_order: photo.sort_order,
            is_primary: photo.id === primaryPhoto?.id,
          })));
          if (linkError) throw linkError;
        }
        if (Number(color.image_id || 0) !== Number(primaryPhoto?.id || 0)) {
          const { error: primaryError } = await supabase.from("product_colors").update({ image_id: primaryPhoto?.id || null }).eq("id", color.id).eq("product_id", productId);
          if (primaryError) throw primaryError;
        }
        color.gallery_images = photos;
        color.image_id = primaryPhoto?.id || null;
        color.pending_gallery_files = [];
        color.removed_gallery_ids = [];
      }

      const { error: clearProductPrimaryError } = await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
      if (clearProductPrimaryError) throw clearProductPrimaryError;
      const firstColorWithImage = savedColors.find((color) => color.image_id);
      const productPrimary = firstColorWithImage?.gallery_images?.find((photo) => Number(photo.id) === Number(firstColorWithImage.image_id));
      if (productPrimary) {
        const { error: setProductPrimaryError } = await supabase.from("product_images").update({ is_primary: true }).eq("id", productPrimary.id).eq("product_id", productId);
        if (setProductPrimaryError) throw setProductPrimaryError;
      }

      if (removedImageIds.length) {
        const { data: linkedRows, error: linkedError } = await supabase.from("product_color_images").select("product_image_id").in("product_image_id", removedImageIds);
        if (linkedError) throw linkedError;
        const stillLinked = new Set((linkedRows || []).map((row) => Number(row.product_image_id)));
        const safeToRemove = removedImageIds.filter((imageId) => !stillLinked.has(Number(imageId)));
        if (safeToRemove.length) {
          const { data: removeRows, error: removeReadError } = await supabase.from("product_images").select("id, image_url").eq("product_id", productId).in("id", safeToRemove);
          if (removeReadError) throw removeReadError;
          const { error: removeError } = await supabase.from("product_images").delete().eq("product_id", productId).in("id", safeToRemove);
          if (removeError) throw removeError;
          const storagePaths = (removeRows || []).map((image) => {
            const marker = "/storage/v1/object/public/product-images/";
            const markerIndex = String(image.image_url || "").indexOf(marker);
            return markerIndex < 0 ? null : decodeURIComponent(image.image_url.slice(markerIndex + marker.length));
          }).filter(Boolean);
          if (storagePaths.length) {
            const { error: storageError } = await supabase.storage.from("product-images").remove(storagePaths);
            if (storageError) console.warn("Some removed product files could not be deleted from storage.", storageError);
          }
        }
      }

      const { data: refreshedImages, error: refreshImagesError } = await supabase.from("product_images").select("*").eq("product_id", productId).order("sort_order");
      if (refreshImagesError) throw refreshImagesError;

      savedStateUpdate.current = true;
      setImages(refreshedImages || []);
      setColors(savedColors);
      setOriginalColorIds(savedColors.map((color) => color.id));
      setRemovedGalleryImageIds([]);
      setHasUnsavedChanges(false);
      setMediaDirty(false);
      toast.success("Color images saved. Each color now has its own photo gallery.");
    } catch (err) {
      console.error(err);
      toast.error("Error saving colors and images: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProductImages = async (event) => {
    event.preventDefault();
    if (saving || !savedProductId) return;
    if (colors.some((color) => color.id)) {
      toast.error("This product still has saved colors. Resolve those colors before saving a product gallery.");
      return;
    }
    setSaving(true);
    try {
      const savedImages = await saveProductGallery({ productId: savedProductId, images, removedIds: removedProductImageIds, onProgress: setImages });
      savedStateUpdate.current = true;
      setImages(savedImages);
      setRemovedProductImageIds([]);
      setMediaDirty(false);
      setHasUnsavedChanges(false);
      toast.success("Product images saved.");
    } catch (error) {
      setHasUnsavedChanges(true);
      toast.error("Images could not be saved: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading product data...</div>;
  }

  const selectedLabelValues = [...(isNew ? ["new_arrival"] : []), ...productLabels];

  return (
    <div className="apo-dashboard apo-product-editor">
      <header className="mb-5 flex items-start justify-between gap-4 border-b border-[#d8d4ca] pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a92727]">{fromMedia ? "Product media" : "Product catalog"}</p>
          <h1 className="mt-1 font-serif text-2xl text-[#26241f]">{step === 2 ? usesVariantStock(type) ? "Colors & images" : "Product images" : id ? "Edit product" : "Add new product"}</h1>
          {!fromMedia && <p className="mt-1 text-sm text-[#625f58]">{usesVariantStock(type) ? "Add product details, then manage colors and their photos." : "Add product details, then upload its photos."}</p>}
        </div>
        <button type="button" disabled={saving} onClick={handleCancel} aria-label="Close product editor" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg text-[#625f58] hover:bg-white hover:text-[#26241f]">×</button>
      </header>

      {!fromMedia && <div className="mb-4 flex w-full items-center gap-2 text-xs text-[#625f58]">
        <span className={`rounded-full px-3 py-1 ${step === 1 ? "bg-[#26241f] text-white" : "bg-white"}`}>1&nbsp; Product details</span>
        <span className="h-px flex-1 bg-[#d8d4ca]" />
        <button type="button" disabled={saving || !savedProductId || (step === 1 && hasUnsavedChanges)} onClick={() => setStep(2)} title={hasUnsavedChanges ? "Save product details before continuing" : undefined} className={`rounded-full px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50 ${step === 2 ? "bg-[#26241f] text-white" : "bg-white hover:bg-white/70"}`}>2&nbsp; {usesVariantStock(type) ? "Colors & images" : "Images"}</button>
      </div>}

      <form
        onSubmit={step === 1 ? handleSaveDetails : usesVariantStock(type) ? handleSaveVariants : handleSaveProductImages}
        className="apo-dashboard-panel apo-product-editor-form"
      >
        {step === 1 && <>
        <section className="space-y-4">
          <div className="border-b border-[#e2ded6] pb-2"><h2 className="text-base font-semibold text-[#26241f]">Basic details</h2><p className="mt-1 text-xs text-[#625f58]">Product identity and catalog placement.</p></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="sm:col-span-2 xl:col-span-1"><label className="mb-1 block text-xs font-medium text-[#625f58]">Product name *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-[#d8d4ca] bg-white px-3 py-2.5 text-sm text-[#26241f] outline-none focus:border-[#77736d]" required placeholder="Enter product name" /></div>
            <div><label className="mb-1 block text-xs font-medium text-[#625f58]" htmlFor="apo-product-brand">{isEyewearType(type) ? "Brand *" : "Brand (optional)"}</label><select id="apo-product-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)} className="w-full rounded-md border border-[#d8d4ca] bg-white px-3 py-2.5 text-sm text-[#26241f]" required={isEyewearType(type)}><option value="">{isEyewearType(type) ? "Select brand" : "No brand"}</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-medium text-[#625f58]">Product type *</label><select value={type} onChange={(e) => { setType(e.target.value); if (!isEyewearType(e.target.value)) { setFrameShapeId(""); setFrameMaterialId(""); } }} className="w-full rounded-md border border-[#d8d4ca] bg-white px-3 py-2.5 text-sm text-[#26241f]" required>{PRODUCT_TYPES.map((productType) => <option key={productType.value} value={productType.value}>{productType.label}</option>)}</select></div>
            <div className="sm:col-span-2 xl:col-span-3"><label className="mb-1 block text-xs font-medium text-[#625f58]">Product description</label><textarea rows="3" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full resize-y rounded-md border border-[#d8d4ca] bg-white px-3 py-2.5 text-sm text-[#26241f] outline-none focus:border-[#77736d]" placeholder="Add product details for the catalog" /></div>
          </div>
        </section>

        {usesVariantStock(type) && (
          <section className="space-y-4">
            <div className="border-b border-[#e2ded6] pb-2"><h2 className="text-base font-semibold text-[#26241f]">Frame specifications</h2><p className="mt-1 text-xs text-[#625f58]">Only the specifications used to describe eyewear.</p></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#625f58]">Frame shape *</label>
                <select
                  value={frameShapeId}
                  onChange={(e) => setFrameShapeId(e.target.value)}
                  className="w-full rounded-md border border-[#d8d4ca] bg-white px-3 py-2.5 text-sm text-[#26241f]"
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
                <label className="mb-1 block text-xs font-medium text-[#625f58]">Frame material *</label>
                <select
                  value={frameMaterialId}
                  onChange={(e) => setFrameMaterialId(e.target.value)}
                  className="w-full rounded-md border border-[#d8d4ca] bg-white px-3 py-2.5 text-sm text-[#26241f]"
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
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div className="border-b border-[#e2ded6] pb-2"><h2 className="text-base font-semibold text-[#26241f]">Product pricing</h2><p className="mt-1 text-xs text-[#625f58]">Set the selling price and, if needed, the original price.</p></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="mb-1 block text-xs font-medium text-[#625f58]">Base product price (₱) *</label><input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-md border border-[#d8d4ca] bg-white px-3 py-2.5 text-sm text-[#26241f]" required placeholder="0.00" /></div>
            <div><label className="mb-1 block text-xs font-medium text-[#625f58]">Original price (₱)</label><input type="number" min="0" step="0.01" value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} className="w-full rounded-md border border-[#d8d4ca] bg-white px-3 py-2.5 text-sm text-[#26241f]" placeholder="Optional" /></div>
            {!usesVariantStock(type) && <div><label className="mb-1 block text-xs font-medium text-[#625f58]">Stock on hand</label><input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full rounded-md border border-[#d8d4ca] bg-white px-3 py-2.5 text-sm text-[#26241f]" /><p className="mt-1 text-xs text-[#625f58]">Availability follows the quantity entered here.</p></div>}
            {!usesVariantStock(type) && <div><label htmlFor="apo-product-low-stock" className="mb-1 block text-xs font-medium text-[#625f58]">Low stock</label><input id="apo-product-low-stock" type="number" min="0" step="1" value={lowStockThreshold} onChange={(event) => setLowStockThreshold(event.target.value)} placeholder="Unset" className="w-full rounded-md border border-[#d8d4ca] bg-white px-3 py-2.5 text-sm text-[#26241f]" /></div>}
          </div>
        </section>

        <section className="apo-editor-labels">
          <div className="apo-panel-heading"><h2 id="apo-product-label-title">Product label</h2></div>
          <select className="apo-editor-label-select" aria-labelledby="apo-product-label-title" value={selectedLabelValues.join("|")} onChange={(event) => { const value = event.target.value; setIsNew(value === "new_arrival"); setProductLabels(value && value !== "new_arrival" ? [value] : []); }}>
            <option value="">No label</option>
            <option value="new_arrival">New Arrival</option>
            {PRODUCT_LABEL_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            {selectedLabelValues.length > 1 && <option value={selectedLabelValues.join("|")}>{selectedLabelValues.map((value) => value === "new_arrival" ? "New Arrival" : PRODUCT_LABEL_OPTIONS.find((option) => option.value === value)?.label || value).join(" + ")}</option>}
          </select>
        </section>

        <div className="apo-product-editor-footer">
          <button type="button" disabled={saving} onClick={handleCancel} className="apo-editor-secondary">Back</button>
          <button type="submit" disabled={saving} className="rounded-md bg-[#26241f] px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50">
            {saving ? "Saving…" : "Next"}
          </button>
        </div>

        </>}

        {step === 2 && <>
        <div className="mb-1 border-b border-[#e2ded6] pb-3"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a92727]">Product content</p><h2 className="mt-1 text-base font-semibold text-[#26241f]">{name || "Product"}</h2><p className="mt-1 text-sm text-[#625f58]">ID #{savedProductId} · {usesVariantStock(type) ? "Manage colors and their photos." : "Manage product photos."}</p></div>
        {!usesVariantStock(type) && <ProductImageGallery images={images} disabled={saving} onChange={(nextImages) => { setImages(nextImages); setMediaDirty(true); }} onRemove={(image) => { if (image.id) setRemovedProductImageIds((current) => [...new Set([...current, image.id])]); if (image.preview) URL.revokeObjectURL(image.preview); }} />}
        {usesVariantStock(type) && <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div><h3 className="text-sm font-semibold text-[#26241f]">Product colors</h3><p className="mt-1 text-xs text-[#625f58]">Select a photo preview to manage images below the table.</p></div>
            <button type="button" onClick={addColor} className="rounded-md bg-[#26241f] px-3 py-2 text-sm font-medium text-white hover:bg-black">+ Add color</button>
          </div>
          <div className="apo-editor-color-table-wrap">
            <table className="apo-editor-color-table">
              <thead><tr><th scope="col">Color</th><th scope="col">Stock</th><th scope="col">Low stock</th><th scope="col">Photos</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {colors.map((color, idx) => {
                  const previewPhotos = [...(color.gallery_images || []), ...(color.pending_gallery_files || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).slice(0, 4);
                  const selected = expandedColorIndex === idx;
                  return <tr key={color.id || `new-${idx}`} className={selected ? "is-selected" : ""}>
                    <td data-label="Color"><div className="apo-editor-color-name"><input type="color" aria-label={`Color ${idx + 1} swatch`} value={color.color_code || "#000000"} onChange={(event) => updateColor(idx, "color_code", event.target.value)} /><input type="text" aria-label={`Color ${idx + 1} name`} placeholder="Color name" value={color.color_name} onChange={(event) => updateColor(idx, "color_name", event.target.value)} /></div></td>
                    <td data-label="Stock"><input type="number" min="0" step="1" aria-label={`${color.color_name || `Color ${idx + 1}`} stock`} value={color.stock ?? 0} onChange={(event) => updateColor(idx, "stock", event.target.value)} /></td>
                    <td data-label="Low stock"><input type="number" min="0" step="1" aria-label={`${color.color_name || `Color ${idx + 1}`} low-stock threshold`} placeholder="Unset" value={color.low_stock_threshold ?? ""} onChange={(event) => updateColor(idx, "low_stock_threshold", event.target.value)} /><small>{lowStockThreshold !== "" ? `Blank inherits ${lowStockThreshold} units` : "Optional warning level"}</small></td>
                    <td data-label="Photos"><button type="button" className="apo-editor-photo-preview" aria-label={`${selected ? "Hide" : "Manage"} photos for ${color.color_name || `Color ${idx + 1}`}`} aria-expanded={selected} aria-controls={selected ? "apo-selected-color-gallery" : undefined} onClick={() => setExpandedColorIndex(selected ? null : idx)}>{previewPhotos.length ? previewPhotos.map((photo) => <img key={photo.id || photo.draft_key} src={photo.preview || photo.image_url} alt="" />) : <span>Add images</span>}</button></td>
                    <td data-label="Actions"><div className="apo-editor-color-actions"><button type="button" className="is-danger" onClick={() => removeColor(idx)}>Remove</button></div></td>
                  </tr>;
                })}
                {colors.length === 0 && <tr><td colSpan="5" className="apo-editor-color-empty">No colors yet. Add a color to set stock and upload photos.</td></tr>}
              </tbody>
            </table>
          </div>
          {colors.map((color, idx) => {
            if (idx !== expandedColorIndex) return null;
            const photos = [...(color.gallery_images || []), ...(color.pending_gallery_files || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
            const primaryPhoto = photos.find((photo) => photo.is_primary) || photos[0];
            const additionalPhotos = photos.filter((photo) => photo !== primaryPhoto);
            const additionalLabels = ["Temple / Side View", "45° Angled View", "Other View"];
            return <section id="apo-selected-color-gallery" className="apo-selected-color-gallery" key={color.id || `gallery-${idx}`} aria-label={`${color.color_name || `Color ${idx + 1}`} photos`}>
<div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div><h4 className="text-sm font-semibold text-[#26241f]">{color.color_name || `Color ${idx + 1}`} images</h4><p className="mt-1 text-xs text-[#625f58]">Add the front view, then up to three matching views for this color.</p></div>
                      </div>
                      <div className="apo-color-gallery-layout">
                        <div>
                          {primaryPhoto ? <article className="overflow-hidden rounded-md border border-[#d8d4ca] bg-white">
                            <img src={primaryPhoto.preview || primaryPhoto.image_url} alt={`${color.color_name || "Color"} primary preview`} className="aspect-[4/3] w-full bg-[#f2f0ec] object-contain" />
                            <p className="px-3 pt-2 text-sm font-medium text-[#26241f]">Front View (Primary)</p>
                            <div className="flex flex-wrap items-center justify-between gap-2 p-3"><span className="text-xs text-[#625f58]">Main photo for this color</span><div className="flex gap-3"><label className="cursor-pointer text-xs font-medium text-[#625f58] hover:text-[#26241f]">Replace<input type="file" accept="image/*" onChange={(event) => { replaceColorPhoto(idx, primaryPhoto, event.target.files); event.target.value = ""; }} className="sr-only" /></label><button type="button" onClick={() => removeColorPhoto(idx, primaryPhoto)} className="text-xs text-[#9f2929] hover:underline">Remove</button></div></div>
                          </article> : <label className="grid aspect-[4/3] cursor-pointer place-items-center rounded-md border border-dashed border-[#bdb7aa] bg-white text-center hover:bg-[#f7f5f1]"><span className="flex flex-col items-center text-[#625f58]"><span className="mb-2 grid h-10 w-10 place-items-center rounded-full border border-[#d8d4ca] text-2xl leading-none">+</span><strong className="text-sm font-medium text-[#26241f]">Add primary image</strong><span className="mt-1 text-xs">Choose the main photo for this color</span></span><input type="file" accept="image/*" onChange={(event) => { addColorPhotos(idx, event.target.files, true); event.target.value = ""; }} className="sr-only" /></label>}
                        </div>
                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#625f58]">Additional Views</p>
                          <div className="apo-color-gallery-additional">
                            {additionalLabels.map((labelText, slotIndex) => {
                              const photo = additionalPhotos.find((image) => Number(image.sort_order) === slotIndex + 1);
                              return <div key={labelText} className="min-w-0">
                                {photo ? <article className="overflow-hidden rounded-md border border-[#e1ddd4] bg-white">
                                  <img src={photo.preview || photo.image_url} alt={`${color.color_name || "Color"} — ${labelText}`} className="aspect-square w-full bg-[#f2f0ec] object-contain" />
                                  <p className="px-2 pt-2 text-xs font-medium text-[#26241f]">{labelText}</p>
                                  <div className="flex flex-wrap items-center justify-between gap-2 p-2"><button type="button" onClick={() => setColorPhotoPrimary(idx, photo.id ? String(photo.id) : photo.draft_key)} className="text-[11px] font-medium text-[#426550] hover:underline">Set primary</button><label className="cursor-pointer text-[11px] text-[#625f58] hover:text-[#26241f]">Replace<input type="file" accept="image/*" onChange={(event) => { replaceColorPhoto(idx, photo, event.target.files); event.target.value = ""; }} className="sr-only" /></label><button type="button" onClick={() => removeColorPhoto(idx, photo)} className="text-[11px] text-[#9f2929] hover:underline">Remove</button></div>
                                </article> : primaryPhoto ? <label className="grid aspect-square cursor-pointer place-items-center rounded-md border border-dashed border-[#c8c2b6] bg-white text-center text-xs text-[#625f58] hover:bg-[#f7f5f1]"><span><span className="mb-2 block text-2xl leading-none">+</span><strong className="block font-medium text-[#26241f]">Add image</strong><span className="mt-1 block">{labelText}</span></span><input type="file" accept="image/*" onChange={(event) => { addColorPhotos(idx, event.target.files, false, slotIndex); event.target.value = ""; }} className="sr-only" /></label> : <div className="grid aspect-square place-items-center rounded-md border border-dashed border-[#d8d4ca] bg-[#f7f5f1] px-3 text-center text-xs text-[#77736d]"><span>{labelText}<span className="mt-1 block">Add the front view first</span></span></div>}
                              </div>;
                            })}
                          </div>
                        </div>
                      </div>
            </section>;
          })}
        </section>}

        {usesVariantStock(type) && <ARAssetEditor productId={savedProductId} name={name} colors={colors} disabled={saving} onSaved={(colorId, path) => setColors((previous) => previous.map((color) => color.id === colorId ? { ...color, ar_overlay_path: path } : color))} />}

        <div className="apo-product-editor-footer">
          <button
            type="button"
            onClick={fromMedia ? handleCancel : () => setStep(1)}
            disabled={saving}
            className="rounded-md border border-[#d8d4ca] bg-white px-4 py-2.5 text-sm text-[#26241f] hover:bg-[#f7f5f1]"
          >
            {fromMedia ? "Back to product media" : "Back"}
          </button>
          <div className="apo-editor-footer-actions">{!fromMedia && <button type="button" disabled={saving} onClick={handleCancel} className="apo-editor-secondary">Close</button>}<button
            type="submit"
            disabled={saving}
            className="rounded-md bg-[#26241f] px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button></div>

        </div>
        </>}
      </form>

      {/* Unsaved changes confirmation modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#dfdbd2] bg-[#fcfbf9] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#1A1816] mb-2">
              Unsaved Changes
            </h3>
            <p className="text-gray-600 mb-6">
              You have unsaved changes. Are you sure you want to leave? Your
              changes will be lost.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Continue Editing
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
