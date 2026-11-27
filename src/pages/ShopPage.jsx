import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GlassesIcon } from "@solar-icons/react/linear";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ProductPhoto from "../components/ProductPhoto";
import TryOnModal from "../components/TryOnModal";
import { supabase } from "../lib/supabaseClient";
import { getProductCategory, usesVariantStock } from "../utils/productTypes";
import "../styles/shop.css";
import { getProductLabels } from "../utils/productLabels";

const ITEMS_PER_PAGE = 9;
const MAX_PRICE = 5000;
const ALL_PRODUCTS_PRIORITY = {
  eyeglasses: 0,
  sunglasses: 0,
  accessory: 1,
  eyedrops: 2,
};

function ShopFilterSkeleton() {
  return (
    <aside className="shop-filters" aria-hidden="true">
      {["Shape", "Material", "Brand"].map((label) => (
        <div className="shop-filter-section" key={label}>
          <div className="shop-filter-heading">
            <h2>{label}</h2>
          </div>
          <div className="shop-filter-options">
            {[0, 1, 2, 3].map((index) => (
              <div className="shop-filter-option" key={index}>
                <span className="shop-checkbox catalog-skeleton" />
                <span className="catalog-skeleton shop-skeleton__line shop-skeleton__line--filter" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}

function ShopProductGridSkeleton() {
  return (
    <div className="shop-product-grid" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="shop-product" key={index}>
          <div className="shop-product__image-wrap">
            <span className="catalog-skeleton catalog-skeleton--photo" />
            <span className="shop-product__try-on shop-skeleton__action" />
          </div>
          <div className="shop-product__details">
            <div className="shop-product__brand-row">
              <span className="catalog-skeleton shop-skeleton__line shop-skeleton__line--short" />
            </div>
            <div className="shop-product__name-row">
              <span className="catalog-skeleton shop-skeleton__line shop-skeleton__line--name" />
              <span className="shop-product__color catalog-skeleton" />
            </div>
            <div className="shop-product__attributes">
              <span className="catalog-skeleton shop-skeleton__line" />
            </div>
            <div className="shop-product__bottom">
              <span className="catalog-skeleton shop-skeleton__line shop-skeleton__line--short" />
              <span className="catalog-skeleton shop-skeleton__line shop-skeleton__line--details" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ShopPage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [tryOnProduct, setTryOnProduct] = useState(null);
  const [brands, setBrands] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedShapes, setSelectedShapes] = useState([]);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [productType, setProductType] = useState("all");

  const [brandSearch, setBrandSearch] = useState("");
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function fetchShopData() {
      setLoading(true);
      setFetchError("");

      try {
        const [
          productsResult,
          brandsResult,
          shapesResult,
          materialsResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select(`
              *,
              brands (id, name),
              frame_shape:frame_attributes!products_frame_shape_id_fkey (id, name),
              frame_material:frame_attributes!products_frame_material_id_fkey (id, name),
              product_images (image_url, is_primary, sort_order),
              product_colors (id, color_name, color_code, stock)
            `)
            .order("created_at", { ascending: false }),

          supabase
            .from("brands")
            .select("id, name")
            .order("name", { ascending: true }),

          supabase
            .from("frame_attributes")
            .select("id, name")
            .eq("attribute_type", "shape")
            .order("name", { ascending: true }),

          supabase
            .from("frame_attributes")
            .select("id, name")
            .eq("attribute_type", "material")
            .order("name", { ascending: true }),
        ]);

        if (productsResult.error) throw productsResult.error;
        if (brandsResult.error) throw brandsResult.error;
        if (shapesResult.error) throw shapesResult.error;
        if (materialsResult.error) throw materialsResult.error;

        if (cancelled) return;

        setProducts(productsResult.data || []);
        setBrands(brandsResult.data || []);
        setShapes(shapesResult.data || []);
        setMaterials(materialsResult.data || []);
      } catch (error) {
        console.error("Failed to load shop data:", error);

        if (!cancelled) {
          setFetchError(
            "We couldn't load the products. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchShopData();

    return () => {
      cancelled = true;
    };
  }, []);

  const resetPage = () => {
    setCurrentPage(1);
  };

  const toggleFilter = (value, selectedValues, setSelectedValues) => {
    setSelectedValues((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value]
    );

    resetPage();
  };

  const clearFilters = () => {
    setSelectedBrands([]);
    setSelectedShapes([]);
    setSelectedMaterials([]);
    setProductType("all");
    setBrandSearch("");
    setShowAllBrands(false);
    setMaxPrice(MAX_PRICE);
    setInStockOnly(false);
    setCurrentPage(1);
  };

  const filteredBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const visibleBrands = showAllBrands
    ? filteredBrands
    : filteredBrands.slice(0, 6);

  const productTypeLabel = productType === "all"
    ? "products"
    : productType;

  const filteredProducts = products.filter((product) => {
    const selectedCategory = productType === "accessories" ? "accessory" : productType;
    if (productType !== "all" && getProductCategory(product) !== selectedCategory) {
      return false;
    }

    const brandMatch =
      selectedBrands.length === 0 ||
      selectedBrands.includes(product.brand_id);

    const shapeMatch =
      selectedShapes.length === 0 ||
      selectedShapes.includes(product.frame_shape_id);

    const materialMatch =
      selectedMaterials.length === 0 ||
      selectedMaterials.includes(product.frame_material_id);

    const priceMatch = Number(product.price) <= maxPrice;

    const stockAvailable = usesVariantStock(product.type)
      ? (product.product_colors || []).some((color) => Number(color.stock || 0) > 0)
      : Number(product.stock || 0) > 0;
    const stockMatch = !inStockOnly || stockAvailable;

    return (
      brandMatch &&
      shapeMatch &&
      materialMatch &&
      priceMatch &&
      stockMatch
    );
  });

  // Keep the newest-first order within each group and sort before pagination.
  if (productType === "all") {
    filteredProducts.sort((a, b) =>
      (ALL_PRODUCTS_PRIORITY[getProductCategory(a)] ?? 3) -
      (ALL_PRODUCTS_PRIORITY[getProductCategory(b)] ?? 3)
    );
  }

  const totalPages = Math.ceil(
    filteredProducts.length / ITEMS_PER_PAGE
  );

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const getPrimaryImage = (product) => {
    const images = [...(product.product_images || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );

    const primary = images.find((image) => image.is_primary);

    return (
      primary?.image_url ||
      images[0]?.image_url ||
      "https://placehold.co/800x600?text=No+Image"
    );
  };

  const getProductColors = (product) => {
    if (!Array.isArray(product.product_colors)) {
      return [];
    }

    return product.product_colors
      .filter((color) => color?.color_code)
      .slice(0, 3);
  };

  const getColorValue = (color) => {
    return color?.color_code || "#d9d8d1";
  };

  return (
    <>
      <Header />

      <main className="shop-page">
        {fetchError && (
          <div className="shop-error" role="alert">
            <p>{fetchError}</p>

            <button
              type="button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        )}

        <section className="shop-collection">
          <div className="shop-collection__top">
            <div className="shop-tabs">
              <button
                type="button"
                className={`shop-tab ${
                  productType === "all"
                    ? "shop-tab--active"
                    : ""
                }`}
                onClick={() => {
                  setProductType("all");
                  resetPage();
                }}
              >
                All products
              </button>

              <button
                type="button"
                className={`shop-tab ${
                  productType === "eyeglasses"
                    ? "shop-tab--active"
                    : ""
                }`}
                onClick={() => {
                  setProductType("eyeglasses");
                  resetPage();
                }}
              >
                Eyeglasses
              </button>

              <button
                type="button"
                className={`shop-tab ${
                  productType === "sunglasses"
                    ? "shop-tab--active"
                    : ""
                }`}
                onClick={() => {
                  setProductType("sunglasses");
                  resetPage();
                }}
              >
                Sunglasses
              </button>

              <button
                type="button"
                className={`shop-tab ${
                  productType === "accessories"
                    ? "shop-tab--active"
                    : ""
                }`}
                onClick={() => {
                  setProductType("accessories");
                  resetPage();
                }}
              >
                Accessories
              </button>
              <button
                type="button"
                className={`shop-tab ${productType === "eyedrops" ? "shop-tab--active" : ""}`}
                onClick={() => {
                  setProductType("eyedrops");
                  resetPage();
                }}
              >
                Eyedrops
              </button>
            </div>

            <p className="shop-collection__statement">
              {loading ? (
                <span className="catalog-skeleton shop-skeleton__line shop-skeleton__line--statement" aria-hidden="true" />
              ) : (
                <>{filteredProducts.length} thoughtfully selected {productTypeLabel}</>
              )}
            </p>
          </div>

          <div className="shop-toolbar">
            <div className="shop-toolbar__left">
              <span className="shop-toolbar__label">
                Filter by
              </span>

              <button
                type="button"
                className="shop-clear-button"
                onClick={clearFilters}
              >
                Clear all
              </button>

              {loading ? (
                <span className="shop-loading-status" role="status">Loading products…</span>
              ) : (
                <span className="shop-toolbar__count">
                  {filteredProducts.length} {productTypeLabel}
                </span>
              )}
            </div>

            <div className="shop-sort">
              <span>Sort by</span>

              <button type="button">
                Featured
                <span
                  className="shop-sort__chevron"
                  aria-hidden="true"
                >
                  ↓
                </span>
              </button>
            </div>
          </div>

          <div className="shop-collection__body" aria-busy={loading}>
            {loading && <ShopFilterSkeleton />}
            <aside className="shop-filters" hidden={loading}>
              <div className="shop-filter-section">
                <div className="shop-filter-heading">
                  <h2>Shape</h2>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedShapes([]);
                      resetPage();
                    }}
                  >
                    −
                  </button>
                </div>

                <div className="shop-filter-options">
                  {shapes.map((shape) => (
                    <label
                      key={shape.id}
                      className="shop-filter-option"
                    >
                      <input
                        type="checkbox"
                        checked={selectedShapes.includes(
                          shape.id
                        )}
                        onChange={() =>
                          toggleFilter(
                            shape.id,
                            selectedShapes,
                            setSelectedShapes
                          )
                        }
                      />

                      <span className="shop-checkbox" />

                      <span className="shop-filter-option__name">
                        {shape.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="shop-filter-section">
                <div className="shop-filter-heading">
                  <h2>Material</h2>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMaterials([]);
                      resetPage();
                    }}
                  >
                    −
                  </button>
                </div>

                <div className="shop-filter-options">
                  {materials.map((material) => (
                    <label
                      key={material.id}
                      className="shop-filter-option"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMaterials.includes(
                          material.id
                        )}
                        onChange={() =>
                          toggleFilter(
                            material.id,
                            selectedMaterials,
                            setSelectedMaterials
                          )
                        }
                      />

                      <span className="shop-checkbox" />

                      <span className="shop-filter-option__name">
                        {material.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="shop-filter-section">
                <div className="shop-filter-heading">
                  <h2>Brand</h2>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBrands([]);
                      resetPage();
                    }}
                  >
                    −
                  </button>
                </div>

                <div className="shop-filter-options">
                  {visibleBrands.map((brand) => (
                    <label
                      key={brand.id}
                      className="shop-filter-option"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(
                          brand.id
                        )}
                        onChange={() =>
                          toggleFilter(
                            brand.id,
                            selectedBrands,
                            setSelectedBrands
                          )
                        }
                      />

                      <span className="shop-checkbox" />

                      <span className="shop-filter-option__name">
                        {brand.name}
                      </span>
                    </label>
                  ))}
                </div>

                {filteredBrands.length > 6 && (
                  <button
                    type="button"
                    className="shop-show-more"
                    onClick={() =>
                      setShowAllBrands((previous) => !previous)
                    }
                  >
                    {showAllBrands ? "Show less" : "Show more"}
                  </button>
                )}
              </div>

              <div className="shop-filter-section shop-filter-section--price">
                <div className="shop-filter-heading">
                  <h2>Price range</h2>
                </div>

                <div className="shop-price-fields">
                  <div className="shop-price-field">
                    <span>₱</span>
                    <span>500</span>
                  </div>

                  <div className="shop-price-field">
                    <span>₱</span>
                    <span>
                      {maxPrice.toLocaleString("en-PH")}
                    </span>
                  </div>
                </div>

                <input
                  className="shop-price-range"
                  type="range"
                  min="0"
                  max={MAX_PRICE}
                  step="100"
                  value={maxPrice}
                  onChange={(event) => {
                    setMaxPrice(Number(event.target.value));
                    resetPage();
                  }}
                  aria-label="Maximum price"
                />
              </div>
            </aside>

            <section className="shop-products">
              {loading ? (
                <ShopProductGridSkeleton />
              ) : filteredProducts.length === 0 ? (
                <div className="shop-empty">
                  <h2>
                    No {productTypeLabel} found
                  </h2>

                  <p>
                    Try changing your filters or clearing them.
                  </p>

                  <button
                    type="button"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="shop-product-grid">
                    {paginatedProducts.map((product) => {
                      const colors = getProductColors(product);
                      const imageUrl = getPrimaryImage(product);

                      return (
                        <article
                          key={product.id}
                          className="shop-product"
                        >
                          <div className="shop-product__image-wrap">
                            <div className="shop-product__badges">
                              {(getProductLabels(product).length ? getProductLabels(product) : product.name === "Triomphe" ? ["A Modern Classic"] : product.name === "Model" ? ["The Everyday Edit"] : []).map((label) => <span className="shop-product__badge" key={label}>{label}</span>)}
                            </div>
                            <button
                              type="button"
                              className="shop-product__heart"
                              aria-label={`Save ${product.name}`}
                            >
                              ♡
                            </button>

                            <button
                              type="button"
                              className="shop-product__image-button"
                              onClick={() =>
                                navigate(
                                  `/product/${product.id}`
                                )
                              }
                              aria-label={`View ${product.name}`}
                            >
                              <ProductPhoto
                                key={imageUrl}
                                src={imageUrl}
                                alt={product.name}
                                loading="lazy"
                              />
                            </button>

                            <button
                              type="button"
                              className="shop-product__try-on"
                              onClick={() => usesVariantStock(product.type)
                                ? setTryOnProduct(product)
                                : navigate(`/product/${product.id}`)}
                            >
                              {usesVariantStock(product.type) ? <>
                                <GlassesIcon size={15} aria-hidden="true" />
                                Try-on
                              </> : "View details"}
                            </button>
                          </div>

                          <div className="shop-product__details">
                            <div className="shop-product__brand-row">
                              <span className="shop-product__brand">
                                {product.brands?.name ||
                                  "Unbranded"}
                              </span>
                            </div>

                            <div className="shop-product__name-row">
                              <h3>{product.name}</h3>

                              {colors.length > 0 && (
                                <div
                                  className="shop-product__colors"
                                  aria-label="Available colors"
                                >
                                  {colors.map((color) => (
                                    <span
                                      key={`${product.id}-${color.id}`}
                                      className="shop-product__color"
                                      style={{
                                        backgroundColor:
                                          getColorValue(color),
                                      }}
                                      title={
                                        color.color_name ||
                                        "Available color"
                                      }
                                    />
                                  ))}
                                </div>
                              )}
                            </div>

                            <p className="shop-product__attributes">
                              {product.frame_shape?.name ||
                                "Frame"}
                              ,{" "}
                              {product.frame_material?.name ||
                                "Material"}
                            </p>

                            <div className="shop-product__bottom">
                              <span className="shop-product__price">
                                ₱
                                {Number(
                                  product.price
                                ).toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>

                              <button
                                type="button"
                                className="shop-product__details-link"
                                onClick={() =>
                                  navigate(
                                    `/product/${product.id}`
                                  )
                                }
                              >
                                View details
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="shop-discover">
                    <p>
                      Showing{" "}
                      {Math.min(
                        paginatedProducts.length,
                        ITEMS_PER_PAGE
                      )}{" "}
                      of {filteredProducts.length}{" "}
                      {productTypeLabel}
                    </p>

                    <span
                      className="shop-discover__line"
                      aria-hidden="true"
                    />

                    {totalPages > currentPage ? (
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage(
                            (previous) => previous + 1
                          )
                        }
                      >
                        Discover more{" "}
                        {productTypeLabel}
                        <span aria-hidden="true">→</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (totalPages > 1) {
                            setCurrentPage(1);
                          }
                        }}
                      >
                        Discover more{" "}
                        {productTypeLabel}
                        <span aria-hidden="true">→</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </section>
      </main>

      <Footer />
      {tryOnProduct && <TryOnModal
        product={tryOnProduct}
        onClose={() => setTryOnProduct(null)}
      />}
    </>
  );
}
