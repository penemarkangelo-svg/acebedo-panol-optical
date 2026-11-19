import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/CartContext";
import { ArrowLeftIcon, ArrowRightIcon, GlassesIcon } from "@solar-icons/react/linear";
import toast from "react-hot-toast";
import Header from "../components/Header";
import Footer from "../components/Footer";
import TryOnModal from "../components/TryOnModal";
import { getProductCategory, isEyewearType, requiresLensPackage } from "../utils/productTypes";
import "../styles/ProductDetail.css";
import { getProductLabels } from "../utils/productLabels";

export default function ProductDetailPage() {
  const { addToCart } = useCart();
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionStart, setSuggestionStart] = useState(0);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(null);
  const [mainImage, setMainImage] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [tryOnOpen, setTryOnOpen] = useState(false);

  const [visionMode, setVisionMode] = useState("plano");
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [lensPackageOpen, setLensPackageOpen] = useState(true);
  const [lensPackages, setLensPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchProduct = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          brands (name),
          frame_shape:frame_attributes!products_frame_shape_id_fkey (name),
          frame_material:frame_attributes!products_frame_material_id_fkey (name),
          product_images (id, image_url, is_primary, sort_order),
          product_colors (id, color_name, color_code, image_id, sort_order, stock,
            product_color_images (product_image_id, sort_order, is_primary,
              product_images!product_color_images_image_product_fkey (id, image_url, sort_order)))
        `)
        .eq("id", id)
        .single();

      if (!isMounted) return;

      if (error) {
        console.error("Error fetching product details:", error);
        toast.error("Unable to load product details.");
        navigate("/shop");
      } else {
        const images = data.product_images || [];
        const imageById = new Map(
          images.map((image) => [String(image.id), image])
        );

        const colorsWithImages = (data.product_colors || []).map((color) => ({
          ...color,
          gallery_images: [...(color.product_color_images || [])]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((link) => ({ ...link.product_images, is_primary: Boolean(link.is_primary) }))
            .filter((image) => image.id),
          image_url: [...(color.product_color_images || [])]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .find((link) => link.is_primary)?.product_images?.image_url
            || imageById.get(String(color.image_id))?.image_url
            || null,
        }));

        colorsWithImages.forEach((color) => {
          if (!color.gallery_images.length && color.image_url) {
            color.gallery_images = [{ id: `legacy-${color.id}`, image_url: color.image_url, is_primary: true, sort_order: 0 }];
          }
        });

        const productWithColors = {
          ...data,
          category: getProductCategory(data),
          product_colors: colorsWithImages,
        };

        setProduct(productWithColors);

        const primary = images.find((img) => img.is_primary);
        const firstColor =
          colorsWithImages.find(
            (color) => Number(color.stock || 0) > 0
          ) || colorsWithImages[0] || null;

        const fallbackImage =
          primary?.image_url ||
          images[0]?.image_url ||
          "https://placehold.co/600x400?text=No+Image";

        setSelectedColor(firstColor);
        setActiveImageIndex(0);
        setMainImage(firstColor?.image_url || fallbackImage);
      }

      setLoading(false);
    };

    fetchProduct();

    return () => {
      isMounted = false;
    };
  }, [id, navigate]);

  useEffect(() => {
    let active = true;
    async function loadSuggestions() {
      if (!product || !isEyewearType(product.category || product.type)) {
        setSuggestedProducts([]);
        return;
      }
      setSuggestionsLoading(true);
      const { data, error } = await supabase.from("products").select(`
        id, name, price, stock, brand_id, frame_shape_id,
        brands (name),
        frame_shape:frame_attributes!products_frame_shape_id_fkey (name),
        product_images (id, image_url, is_primary, sort_order),
        product_colors (id, color_name, color_code, image_id, stock,
          product_color_images (product_image_id, sort_order, is_primary,
            product_images!product_color_images_image_product_fkey (id, image_url, sort_order)))
      `).in("type", ["frame", "eyeglasses", "sunglasses"]).order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        console.error("Unable to load related frames:", error);
        setSuggestedProducts([]);
      } else {
        const related = (data || [])
          .filter((candidate) => candidate.id !== product.id && (
            (product.frame_shape_id && candidate.frame_shape_id === product.frame_shape_id) ||
            (product.brand_id && candidate.brand_id === product.brand_id)
          ))
          .map((candidate) => {
            const images = candidate.product_images || [];
            const imageMap = new Map(images.map((image) => [String(image.id), image.image_url]));
            const colors = (candidate.product_colors || []).map((color) => ({
              ...color,
              gallery_images: [...(color.product_color_images || [])]
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((link) => link.product_images)
                .filter(Boolean),
              image_url: [...(color.product_color_images || [])]
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .find((link) => link.is_primary)?.product_images?.image_url
                || imageMap.get(String(color.image_id)) || null,
            }));
            const available = colors.length
              ? colors.some((color) => Number(color.stock || 0) > 0)
              : Number(candidate.stock || 0) > 0;
            return {
              ...candidate,
              product_images: images,
              product_colors: colors,
              suggestion_reason: product.frame_shape_id && candidate.frame_shape_id === product.frame_shape_id
                ? "Similar shape"
                : "More from this brand",
              is_available: available,
            };
          })
          .sort((a, b) => Number(b.is_available) - Number(a.is_available) || Number(b.suggestion_reason === "Similar shape") - Number(a.suggestion_reason === "Similar shape"));
        setSuggestedProducts(related);
        setSuggestionStart(0);
      }
      setSuggestionsLoading(false);
    }
    loadSuggestions();
    return () => { active = false; };
  }, [product]);

  useEffect(() => {
    let isMounted = true;

    const fetchLensData = async () => {
      setPackagesLoading(true);

      try {
        const [
          { data: types, error: typesError },
          { data: coatings, error: coatingsError },
          { data: pricing, error: pricingError },
        ] = await Promise.all([
          supabase.from("lens_types").select("*"),
          supabase.from("lens_coatings").select("*"),
          supabase.from("lens_pricing_matrix").select("*"),
        ]);

        if (typesError) throw typesError;
        if (coatingsError) throw coatingsError;
        if (pricingError) throw pricingError;

        const mappedPackages = (pricing || []).map((priceRow) => {
          const lensType = (types || []).find(
            (item) =>
              String(item.id).trim() ===
              String(priceRow.lens_type_id).trim()
          );

          const coating = (coatings || []).find(
            (item) =>
              String(item.id).trim() ===
              String(priceRow.coating_id).trim()
          );

          return {
            id: `${priceRow.lens_type_id}_${priceRow.coating_id}`,
            lensType: priceRow.lens_type_id,
            coatingId: priceRow.coating_id,
            displayName: `${lensType?.name || "Unknown Lens"} + ${
              coating?.name || "Unknown Coating"
            }`,
            description:
              coating?.description || "No description available.",
            price: Number(priceRow.price) || 0,
          };
        });

        if (isMounted) {
          setLensPackages(mappedPackages);
        }
      } catch (error) {
        console.error("Error building lens matrix:", error);
        toast.error("Unable to load lens packages.");
      } finally {
        if (isMounted) {
          setPackagesLoading(false);
        }
      }
    };

    fetchLensData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setSelectedPackageId(null);
    setLensPackageOpen(true);
  }, [visionMode, id]);

  const availablePackages = useMemo(() => {
    if (!product || !requiresLensPackage(product.category || product.type)) return [];

    if (visionMode === "plano") {
      return lensPackages.filter(
        (pkg) => String(pkg.lensType).toLowerCase() === "sv"
      );
    }

    return lensPackages;
  }, [product, visionMode, lensPackages]);

  const galleryImages = useMemo(() => {
    if (product && !isEyewearType(product.category || product.type)) {
      const productPhotos = [...(product.product_images || [])]
        .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((image) => image.image_url?.trim())
        .filter(Boolean);
      if (productPhotos.length) return productPhotos;
    }
    const colorImages = (selectedColor?.gallery_images || [])
      .map((image) => image?.image_url?.trim())
      .filter(Boolean);
    const fallbackImage = selectedColor?.image_url?.trim()
      || mainImage
      || "https://placehold.co/900x675?text=No+Image";
    return colorImages.length ? colorImages : [fallbackImage];
  }, [selectedColor, mainImage, product]);

  const handlePreviousImage = () => {
    setActiveImageIndex((current) =>
      current === 0 ? galleryImages.length - 1 : current - 1
    );
  };

  const handleNextImage = () => {
    setActiveImageIndex((current) =>
      current === galleryImages.length - 1 ? 0 : current + 1
    );
  };

  const selectGalleryImage = (index) => {
    setActiveImageIndex(index);
  };

  if (loading) {
    return (
      <div className="pdp-loading">
        <div className="pdp-loading__panel">
          <div className="pdp-loading__spinner" />
          <p>Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const isAddToCartEnabled = () => {
    if (!isEyewearType(product.category || product.type)) {
      return (
        Number(product.stock) > 0 &&
        quantity <= Number(product.stock)
      );
    }

    if (!selectedColor) return false;
    if (requiresLensPackage(product.category || product.type) && !selectedPackageId) return false;
    if (quantity > Number(selectedColor.stock || 0)) return false;

    return true;
  };

  const getFrameValidationMessage = () => {
    if (!selectedColor) return "Please select a frame color.";
    if (requiresLensPackage(product.category || product.type) && !selectedPackageId) return "Please select a lens package.";

    if (quantity > Number(selectedColor.stock || 0)) {
      return `Only ${selectedColor.stock} available for this color.`;
    }

    return "";
  };

  const handleAddToCart = () => {
    if (!isAddToCartEnabled()) return;

    if (!isEyewearType(product.category || product.type)) {
      if (quantity > Number(product.stock || 0)) {
        toast.error(`Only ${product.stock} available.`);
        return;
      }

      addToCart(
        {
          id: product.id,
          name: product.name,
          price: Number(product.price),
          image: mainImage,
          brand: product.brands?.name || "",
          shape: "",
          material: "",
          type: product.category || getProductCategory(product),
        },
        quantity,
        { type: product.category || getProductCategory(product) }
      );

      toast.success("Added to cart!");
      return;
    }

    const chosenPackage = requiresLensPackage(product.category || product.type)
      ? availablePackages.find((pkg) => pkg.id === selectedPackageId)
      : null;

    if (requiresLensPackage(product.category || product.type) && !chosenPackage) {
      toast.error("Please select a valid lens package.");
      return;
    }

    if (quantity > Number(selectedColor.stock || 0)) {
      toast.error("Not enough stock for this color.");
      return;
    }

    const lensExtra = Number(chosenPackage?.price) || 0;
    const finalPrice = Number(product.price) + lensExtra;

    const config = {
      type: product.category || getProductCategory(product),
      productColorId: selectedColor.id,
      color: selectedColor.color_name,
      colorHex: selectedColor.color_code,
      ...(chosenPackage ? {
        visionMode: visionMode === "plano" ? "Plano" : "Prescription Lens",
        lensPackage: chosenPackage.displayName,
        lensExtraCharge: lensExtra,
        lensType: chosenPackage.lensType,
        coatingId: chosenPackage.coatingId,
      } : {}),
    };

    addToCart(
      {
        id: product.id,
        name: product.name,
        price: finalPrice,
        image: mainImage,
        brand: product.brands?.name || "",
        shape: product.frame_shape?.name || "",
        material: product.frame_material?.name || "",
        type: product.category || getProductCategory(product),
      },
      quantity,
      config
    );

    toast.success("Added to cart!");
  };

  const stock = selectedColor
    ? Number(selectedColor.stock || 0)
    : Number(product.stock || 0);

  const selectedPackage = selectedPackageId
    ? availablePackages.find((pkg) => pkg.id === selectedPackageId)
    : null;

  const lensExtra = Number(selectedPackage?.price || 0);
  const finalPrice = Number(product.price) + lensExtra;
  const validationMessage = getFrameValidationMessage();
  const visibleSuggestedProducts = suggestedProducts.slice(suggestionStart, suggestionStart + 3);

  const handleColorToggle = (color) => {
    if (Number(color.stock || 0) <= 0) return;

    const fallbackImage =
      product.product_images?.find((image) => image.is_primary)?.image_url ||
      product.product_images?.[0]?.image_url ||
      "https://placehold.co/900x675?text=No+Image";

    const selectedColorImage = color.image_url || fallbackImage;

    setSelectedColor(color);
    setActiveImageIndex(0);
    setMainImage(selectedColorImage);
    setQuantity(1);
  };

  const handlePackageToggle = (packageId) => {
    setSelectedPackageId(
      selectedPackageId === packageId ? null : packageId
    );
  };

  const handleTryOn = () => {
    setTryOnOpen(true);
  };

  const focusLensSelection = () => {
    setLensPackageOpen(true);
    window.setTimeout(() => {
      document.getElementById("pdp-lens-selection")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  if (!isEyewearType(product.category || product.type)) {
    const accessoryStock = Number(product.stock || 0);
    const isEyedrops = (product.category || product.type) === "eyedrops";
    const categoryLabel = isEyedrops ? "Eyedrops" : "Accessories";

    return (
      <>
        <Header />

        <main className="pdp-page pdp-care-page">
          <div className="pdp-container">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="pdp-back"
              aria-label="Go back"
            >
              <ArrowLeftIcon size={18} strokeWidth={1.8} aria-hidden="true" />
            </button>

            <div className="pdp-care-layout">
              <section className="pdp-gallery pdp-care-gallery" aria-label={`${product.name} images`}>
                <div className="pdp-gallery__main pdp-care-image">
                  <img src={mainImage} alt={`${product.name} packaging`} className="pdp-gallery__image" />
                </div>
                <div className="pdp-care-image-caption">
                  <span className="pdp-care-image-index">01 / 01</span>
                  <p>{isEyedrops ? "Product packaging shown. Read the product label before use." : "Product image shown for reference."}</p>
                </div>
                <p className="pdp-care-image-category">Eye care / {categoryLabel}</p>
              </section>

              <section className="pdp-details pdp-care-details">
                <div className="pdp-product-heading">
                  <div>
                    <p className="pdp-kicker pdp-care-kicker">Eye care / {isEyedrops ? "Daily essentials" : "Accessories"}</p>
                    <h1 className="pdp-title">{product.name}</h1>
                    <p className="pdp-subtitle">{product.description || categoryLabel}</p>
                  </div>
                  <span className={`pdp-stock ${accessoryStock > 0 ? "pdp-stock--available" : "pdp-stock--unavailable"}`}>
                    {accessoryStock > 0 ? `In stock · ${accessoryStock} available` : "Out of stock"}
                  </span>
                </div>

                <div className="pdp-care-price">₱{Number(product.price).toFixed(2)}</div>

                <div className="pdp-care-checkout">
                  <div className="pdp-care-quantity-row">
                    <span className="pdp-label">Quantity</span>
                    <div className="pdp-quantity__control" aria-label="Quantity">
                      <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={quantity <= 1} aria-label="Decrease quantity">−</button>
                      <span aria-live="polite">{quantity}</span>
                      <button type="button" onClick={() => setQuantity((current) => Math.min(accessoryStock, current + 1))} disabled={quantity >= accessoryStock} aria-label="Increase quantity">+</button>
                    </div>
                  </div>
                  <button type="button" onClick={handleAddToCart} disabled={!accessoryStock || quantity > accessoryStock} className={`pdp-add-button ${accessoryStock > 0 && quantity <= accessoryStock ? "pdp-add-button--enabled" : "pdp-add-button--disabled"}`}>
                    Add to bag
                  </button>
                  <p className="pdp-care-checkout-note">Shipping cost is calculated at checkout.</p>
                </div>

                <details className="pdp-care-disclosure" open>
                  <summary>Product information</summary>
                  <p>{product.description || "Product details are not available."}</p>
                </details>
                {isEyedrops && <details className="pdp-care-disclosure">
                  <summary>Use and precautions</summary>
                  <p>Read the product label and use only as directed. Ask your eye-care professional if you have questions about this product.</p>
                </details>}
                <details className="pdp-care-disclosure">
                  <summary>Shipping information</summary>
                  <p>Shipping cost and available fulfillment options are shown during checkout.</p>
                </details>
              </section>
            </div>
          </div>
        </main>

        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="pdp-page">
        <div className="pdp-container">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="pdp-back"
            aria-label="Go back"
          >
            <ArrowLeftIcon size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>

          <div className="pdp-layout">
            <section className="pdp-gallery" aria-label="Product images">
              <div className="pdp-gallery__main">
                <button
                  type="button"
                  className="pdp-gallery__heart"
                  aria-label="Save product"
                >
                  ♡
                </button>

                <img
                  key={galleryImages[activeImageIndex]}
                  src={galleryImages[activeImageIndex]}
                  alt={`${product.name} - ${selectedColor?.color_name || "selected color"}`}
                  className="pdp-gallery__image"
                />

                <button
                  type="button"
                  className="pdp-gallery__arrow pdp-gallery__arrow--left"
                  onClick={handlePreviousImage}
                  aria-label="Previous product image"
                >
                  <ArrowLeftIcon size={18} strokeWidth={1.8} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="pdp-gallery__arrow pdp-gallery__arrow--right"
                  onClick={handleNextImage}
                  aria-label="Next product image"
                >
                  <ArrowRightIcon size={18} strokeWidth={1.8} aria-hidden="true" />
                </button>

                <div className="pdp-gallery__dots" aria-hidden="true">
                  {galleryImages.map((_, index) => (
                    <span
                      key={index}
                      className={`pdp-gallery__dot ${
                        activeImageIndex === index
                          ? "pdp-gallery__dot--active"
                          : ""
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="pdp-gallery__thumb-row">
                <div className="pdp-gallery__thumbs">
                  {galleryImages.map((image, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectGalleryImage(index)}
                      className={`pdp-gallery__thumb ${
                        activeImageIndex === index
                          ? "pdp-gallery__thumb--active"
                          : ""
                      }`}
                      aria-label={`View product image ${index + 1}`}
                    >
                      <img src={image} alt="" />
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="pdp-tryon"
                  onClick={handleTryOn}
                >
                  <GlassesIcon size={20} strokeWidth={1.8} aria-hidden="true" />
                  <span>Try-on</span>
                </button>
              </div>

              <div className="pdp-gallery__under-row">
                <span className="pdp-gallery__detail-label">
                  Front &amp; temple detail
                </span>
              </div>
            </section>

            <section className="pdp-details">
              <div className="pdp-product-heading">
                <div>
                  {getProductLabels(product).length > 0 && (
                    <p className="pdp-kicker pdp-kicker--new">{getProductLabels(product).join(" · ").toUpperCase()}</p>
                  )}

                  <p className="pdp-kicker">
                    {product.brands?.name || "Unbranded"}
                  </p>

                  <h1 className="pdp-title">{product.name}</h1>

                  {isEyewearType(product.category || product.type) && <p className="pdp-subtitle">
                    {product.frame_shape?.name || "Shape not specified"} ·{" "}
                    {product.frame_material?.name ||
                      "Material not specified"}
                  </p>}
                </div>

                <span
                  className={`pdp-stock ${
                    stock > 0
                      ? "pdp-stock--available"
                      : "pdp-stock--unavailable"
                  }`}
                >
                  {stock > 0
                    ? `In stock (${stock})`
                    : "Out of stock"}
                </span>
              </div>

              <div className="pdp-price-row">
                <span className="pdp-price">
                  ₱{finalPrice.toFixed(2)}
                </span>

                {lensExtra > 0 && (
                  <span className="pdp-price-note">
                    +₱{lensExtra.toFixed(2)} lens package
                  </span>
                )}
              </div>

              <div className="pdp-section">
                <div className="pdp-section__label-row">
                  <label className="pdp-label">
                    Color
                  </label>

                  {selectedColor && (
                    <span className="pdp-selected-color">
                      — {selectedColor.color_name}
                    </span>
                  )}
                </div>

                <div className="pdp-color-list" aria-label="Frame colors">
                  {product.product_colors?.map((color) => {
                    const isSelected = selectedColor?.id === color.id;
                    const outOfStock = Number(color.stock || 0) <= 0;

                    return (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => handleColorToggle(color)}
                        disabled={outOfStock}
                        className={`pdp-color-option ${
                          isSelected ? "pdp-color-option--selected" : ""
                        } ${
                          outOfStock ? "pdp-color-option--disabled" : ""
                        }`}
                        aria-label={`${color.color_name}${
                          outOfStock ? " (Out of stock)" : ""
                        }`}
                        aria-pressed={isSelected}
                        title={color.color_name}
                      >
                        <span
                          className="pdp-color-swatch"
                          style={{
                            backgroundColor: color.color_code || "#ccc",
                          }}
                        />

                      </button>
                    );
                  })}
                </div>


              </div>

              {requiresLensPackage(product.category || product.type) && <>
              <div className="pdp-section" id="pdp-lens-selection">
                <label className="pdp-label">Lens Type</label>

                <div className="pdp-mode-grid">
                  {["plano", "prescription"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setVisionMode(mode)}
                      className={`pdp-mode-button ${
                        visionMode === mode
                          ? "pdp-mode-button--selected"
                          : ""
                      }`}
                    >
                      {mode === "plano"
                        ? "Plano (Zero Grade)"
                        : "Prescription Lens"}
                    </button>
                  ))}
                </div>
              </div>

              <details
                className="pdp-care-disclosure pdp-lens-disclosure"
                open={lensPackageOpen}
                onToggle={(event) => setLensPackageOpen(event.currentTarget.open)}
              >
                <summary>
                  <span className="pdp-lens-disclosure__heading">
                  <span>
                    {visionMode === "plano"
                      ? "Lens Package (Plano)"
                      : "Lens Package (Prescription)"}
                  </span>
                  <span className="pdp-lens-disclosure__selection">
                    {selectedPackage
                      ? `${selectedPackage.displayName} · +₱${Number(selectedPackage.price).toFixed(2)}`
                      : "Select one"}
                  </span>
                  </span>
                </summary>

                <div className="pdp-package-list">
                  {packagesLoading ? (
                    <div className="pdp-package-loading">
                      <div className="pdp-loading__spinner" />
                      <span>Loading lens metadata...</span>
                    </div>
                  ) : availablePackages.length === 0 ? (
                    <p className="pdp-empty">
                      No lens packages are available for this selection.
                    </p>
                  ) : (
                    availablePackages.map((pkg) => {
                      const isSelected =
                        selectedPackageId === pkg.id;

                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() =>
                            handlePackageToggle(pkg.id)
                          }
                          className={`pdp-package ${
                            isSelected
                              ? "pdp-package--selected"
                              : ""
                          }`}
                        >
                          <span className="pdp-package__radio">
                            {isSelected && (
                              <span />
                            )}
                          </span>

                          <span className="pdp-package__copy">
                            <span className="pdp-package__name">
                              {pkg.displayName}
                            </span>

                            <span className="pdp-package__description">
                              {pkg.description}
                            </span>
                          </span>

                          <span className="pdp-package__price">
                            +₱{Number(pkg.price).toFixed(2)}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                {!selectedPackageId &&
                  !packagesLoading &&
                  availablePackages.length > 0 && (
                    <p className="pdp-validation">
                      Please select a lens package.
                    </p>
                  )}
              </details>
              </>}

              <details className="pdp-care-disclosure" key={product.id}>
                <summary>Product information</summary>
                <p>{product.description || "Product details are not available."}</p>
                {product.frame_shape?.name && (
                  <p><strong>Frame shape:</strong> {product.frame_shape.name}</p>
                )}
                {product.frame_material?.name && (
                  <p><strong>Frame material:</strong> {product.frame_material.name}</p>
                )}
              </details>

              <div className="pdp-checkout">
                <div className="pdp-checkout__row">
                  <div className="pdp-quantity">
                    <label className="pdp-label">Quantity</label>

                    <div className="pdp-quantity__control">
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity((current) =>
                            Math.max(1, current - 1)
                          )
                        }
                        disabled={quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>

                      <span>{quantity}</span>

                      <button
                        type="button"
                        onClick={() =>
                          setQuantity((current) =>
                            Math.min(
                              Math.min(stock, 99),
                              current + 1
                            )
                          )
                        }
                        disabled={
                          quantity >= Math.min(stock, 99)
                        }
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!isAddToCartEnabled()}
                    className={`pdp-add-button ${
                      isAddToCartEnabled()
                        ? "pdp-add-button--enabled"
                        : "pdp-add-button--disabled"
                    }`}
                  >
                    Add to Cart
                  </button>
                </div>

                {!isAddToCartEnabled() &&
                  validationMessage && (
                    <p className="pdp-validation pdp-validation--right">
                      {validationMessage}
                    </p>
                  )}
              </div>

            </section>
          </div>

          {(suggestionsLoading || suggestedProducts.length > 0) && <section className="pdp-related">
            <div className="pdp-related__heading">
              <div><p className="pdp-kicker">FRAME DISCOVERY</p><h2>You may also like</h2></div>
              {suggestedProducts.length > 3 && <div className="pdp-related__controls">
                <button type="button" onClick={() => setSuggestionStart((index) => Math.max(0, index - 1))} disabled={suggestionStart === 0} aria-label="Previous suggested frames"><ArrowLeftIcon size={17} /></button>
                <button type="button" onClick={() => setSuggestionStart((index) => Math.min(suggestedProducts.length - 3, index + 1))} disabled={suggestionStart >= suggestedProducts.length - 3} aria-label="Next suggested frames"><ArrowRightIcon size={17} /></button>
              </div>}
            </div>
            {suggestionsLoading ? <p className="pdp-related__message">Finding frames you may like…</p> : <div className="pdp-related__grid">
              {visibleSuggestedProducts.map((suggestion) => {
                const image = suggestion.product_colors.find((color) => Number(color.stock || 0) > 0 && color.image_url)?.image_url
                  || suggestion.product_images.find((item) => item.is_primary)?.image_url
                  || suggestion.product_images[0]?.image_url;
                const availableColors = suggestion.product_colors.filter((color) => Number(color.stock || 0) > 0).length;
                return <article className="pdp-related-card" key={suggestion.id}>
                  <button className="pdp-related-card__image-button" type="button" onClick={() => navigate(`/product/${suggestion.id}`)} aria-label={`View ${suggestion.name}`}>
                    {image ? <img src={image} alt={suggestion.name} loading="lazy" /> : <span className="pdp-related-card__no-image">Image unavailable</span>}
                    <span className="pdp-related-card__reason">{suggestion.suggestion_reason}</span>
                  </button>
                  <div className="pdp-related-card__details">
                    <span className="pdp-related-card__brand">{suggestion.brands?.name || "Acebedo Panol Optical"}</span>
                    <button className="pdp-related-card__name" type="button" onClick={() => navigate(`/product/${suggestion.id}`)}>{suggestion.name}</button>
                    <p>{suggestion.frame_shape?.name || "Optical frame"}{availableColors ? ` · ${availableColors} colors` : ""}</p>
                    <div className="pdp-related-card__bottom"><strong>₱{Number(suggestion.price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong><span>{suggestion.is_available ? "Available" : "Out of stock"}</span></div>
                  </div>
                </article>;
              })}
            </div>}
          </section>}
        </div>
      </main>

      <Footer />
      {tryOnOpen && isEyewearType(product.category || product.type) && <TryOnModal product={product} selectedColor={selectedColor} onClose={() => setTryOnOpen(false)} onSelectLenses={focusLensSelection} />}
    </>
  );
}
