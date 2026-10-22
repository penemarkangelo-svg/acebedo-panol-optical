import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/CartContext";
import { ArrowLeftIcon, ArrowRightIcon, GlassesIcon } from "@solar-icons/react/linear";
import toast from "react-hot-toast";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/ProductDetail.css";

export default function ProductDetailPage() {
  const { addToCart } = useCart();
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(null);
  const [mainImage, setMainImage] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [visionMode, setVisionMode] = useState("plano");
  const [selectedPackageId, setSelectedPackageId] = useState(null);
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
          product_colors (id, color_name, color_code, image_id, sort_order, stock)
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

        // Resolve product_colors.image_id -> product_images.image_url.
        const colorsWithImages = (data.product_colors || []).map((color) => ({
          ...color,
          image_url:
            imageById.get(String(color.image_id))?.image_url || null,
        }));

        const productWithColors = {
          ...data,
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
  }, [visionMode]);

  const availablePackages = useMemo(() => {
    if (!product || product.type !== "frame") return [];

    if (visionMode === "plano") {
      return lensPackages.filter(
        (pkg) => String(pkg.lensType).toLowerCase() === "sv"
      );
    }

    return lensPackages;
  }, [product, visionMode, lensPackages]);

  /*
   * Each color is linked to its product image through image_id.
   * For this version we intentionally use that resolved image for all
   * three gallery positions so the gallery matches the approved UI.
   */
  const galleryImages = useMemo(() => {
    const colorImage = selectedColor?.image_url?.trim();
    const image =
      colorImage ||
      mainImage ||
      "https://placehold.co/900x675?text=No+Image";

    // Reuse the selected color's resolved image for all three approved
    // gallery positions.
    return [image, image, image];
  }, [selectedColor, mainImage]);

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
    if (product.type === "accessory") {
      return (
        Number(product.stock) > 0 &&
        quantity <= Number(product.stock)
      );
    }

    if (!selectedColor) return false;
    if (!selectedPackageId) return false;
    if (quantity > Number(selectedColor.stock || 0)) return false;

    return true;
  };

  const getFrameValidationMessage = () => {
    if (!selectedColor) return "Please select a frame color.";
    if (!selectedPackageId) return "Please select a lens package.";

    if (quantity > Number(selectedColor.stock || 0)) {
      return `Only ${selectedColor.stock} available for this color.`;
    }

    return "";
  };

  const handleAddToCart = () => {
    if (!isAddToCartEnabled()) return;

    if (product.type === "accessory") {
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
          brand: "Accessory",
          shape: "",
          material: "",
        },
        quantity,
        { type: "accessory" }
      );

      toast.success("Added to cart!");
      return;
    }

    const chosenPackage = availablePackages.find(
      (pkg) => pkg.id === selectedPackageId
    );

    if (!chosenPackage) {
      toast.error("Please select a valid lens package.");
      return;
    }

    if (quantity > Number(selectedColor.stock || 0)) {
      toast.error("Not enough stock for this color.");
      return;
    }

    const lensExtra = Number(chosenPackage.price) || 0;
    const finalPrice = Number(product.price) + lensExtra;

    const config = {
      productColorId: selectedColor.id,
      color: selectedColor.color_name,
      colorHex: selectedColor.color_code,
      visionMode:
        visionMode === "plano" ? "Plano" : "Prescription Lens",
      lensPackage: chosenPackage.displayName,
      lensExtraCharge: lensExtra,
      lensType: chosenPackage.lensType,
      coatingId: chosenPackage.coatingId,
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

  const handleColorToggle = (color) => {
    if (Number(color.stock || 0) <= 0) return;

    const fallbackImage =
      product.product_images?.find((image) => image.is_primary)?.image_url ||
      product.product_images?.[0]?.image_url ||
      "https://placehold.co/900x675?text=No+Image";

    // image_url was resolved from product_colors.image_id when the product loaded.
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
    /*
     * The existing codebase does not yet connect this page to the
     * Try-On modal. Keep the approved button in place without changing
     * the existing cart/product behavior.
     */
    toast("Try-On is ready to be connected to the Try-On experience.");
  };

  if (product.type === "accessory") {
    const accessoryStock = Number(product.stock || 0);

    return (
      <>
        <Header />

        <main className="bg-white py-12 px-6 md:px-12 lg:px-20">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => navigate(-1)}
              className="mb-6 text-gray-500 hover:text-[#D32F2F] transition flex items-center gap-1 text-sm"
              aria-label="Go back"
            >
              <FaArrowLeft className="w-6 h-6" />
            </button>

            <div className="grid md:grid-cols-2 gap-12">
              <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 shadow-md">
                <img
                  src={mainImage}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-[#212529]">
                  {product.name}
                </h1>

                <p className="text-gray-500 mt-2">
                  {product.description}
                </p>

                <div className="mt-4">
                  <span className="text-3xl font-black text-[#D32F2F]">
                    ₱{Number(product.price).toFixed(2)}
                  </span>
                </div>

                <div className="mt-3">
                  <span
                    className={`text-sm px-3 py-1 rounded-full ${
                      accessoryStock > 0
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {accessoryStock > 0
                      ? `In stock (${accessoryStock})`
                      : "Out of stock"}
                  </span>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-semibold text-[#212529] mb-2">
                    Quantity
                  </label>

                  <div className="flex items-center border border-gray-300 rounded-md w-fit">
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((current) =>
                          Math.max(1, current - 1)
                        )
                      }
                      className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                    >
                      -
                    </button>

                    <span className="px-4 py-1 min-w-[40px] text-center font-medium">
                      {quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((current) =>
                          Math.min(accessoryStock, current + 1)
                        )
                      }
                      disabled={quantity >= accessoryStock}
                      className="px-3 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={
                    !accessoryStock || quantity > accessoryStock
                  }
                  className={`mt-8 w-full py-3 rounded-lg font-semibold transition shadow-md ${
                    !accessoryStock || quantity > accessoryStock
                      ? "bg-gray-300 cursor-not-allowed text-gray-500"
                      : "bg-[#D32F2F] text-white hover:bg-[#B71C1C]"
                  }`}
                >
                  Add to Cart
                </button>
              </div>
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
                    <img
                      src={image}
                      alt=""
                    />
                  </button>
                ))}
              </div>

              <div className="pdp-gallery__under-row">
                <span className="pdp-gallery__detail-label">
                  Front &amp; temple detail
                </span>

                <button
                  type="button"
                  className="pdp-tryon"
                  onClick={handleTryOn}
                >
                  <GlassesIcon size={20} strokeWidth={1.8} aria-hidden="true" />
                  <span>Try-on</span>
                </button>
              </div>
            </section>

            <section className="pdp-details">
              <div className="pdp-product-heading">
                <div>
                  {product.is_new && (
                    <p className="pdp-kicker pdp-kicker--new">NEW ARRIVAL</p>
                  )}

                  <p className="pdp-kicker">
                    {product.brands?.name || "MODEL"}
                  </p>

                  <h1 className="pdp-title">{product.name}</h1>

                  <p className="pdp-subtitle">
                    {product.frame_shape?.name || "Shape not specified"} ·{" "}
                    {product.frame_material?.name ||
                      "Material not specified"}
                  </p>
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
                    Frame Color
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

              <div className="pdp-section">
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

              <div className="pdp-section">
                <div className="pdp-section__label-row">
                  <label className="pdp-label">
                    {visionMode === "plano"
                      ? "Lens Package (Plano)"
                      : "Lens Package (Prescription)"}
                  </label>

                  <span className="pdp-section-note">
                    Select one
                  </span>
                </div>

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
              </div>

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

              <div className="pdp-description">
                <h2>Description</h2>
                <p>
                  {product.description ||
                    "Elegant frame designed for comfort and style."}
                </p>
              </div>
            </section>
          </div>

          <section className="pdp-information">
            <h2>Product information</h2>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
