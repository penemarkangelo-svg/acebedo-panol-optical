import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { supabase } from "../lib/supabaseClient";

const ITEMS_PER_PAGE = 6;
const MAX_PRICE = 5000;

export default function ShopPage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [materials, setMaterials] = useState([]);

  const [loading, setLoading] = useState(true);

  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedShapes, setSelectedShapes] = useState([]);
  const [selectedMaterials, setSelectedMaterials] = useState([]);

  const [brandSearch, setBrandSearch] = useState("");
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [inStockOnly, setInStockOnly] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchShopData = async () => {
      setLoading(true);

      const productsQuery = supabase
        .from("products")
        .select(
          `
          *,
          brands (id, name),
          frame_shape:categories!products_frame_shape_id_fkey(id, name, type),
          frame_material:categories!products_frame_material_id_fkey(id, name, type),
          product_images (image_url, is_primary)
        `,
        )
        .order("created_at", { ascending: false });

      const brandsQuery = supabase
        .from("brands")
        .select("id, name")
        .order("name", { ascending: true });

      const shapesQuery = supabase
        .from("categories")
        .select("id, name, type")
        .eq("type", "shape")
        .order("name", { ascending: true });

      const materialsQuery = supabase
        .from("categories")
        .select("id, name, type")
        .eq("type", "material")
        .order("name", { ascending: true });

      const [productsResult, brandsResult, shapesResult, materialsResult] =
        await Promise.all([
          productsQuery,
          brandsQuery,
          shapesQuery,
          materialsQuery,
        ]);

      if (productsResult.error) {
        console.error("Products error:", productsResult.error);
      } else {
        setProducts(productsResult.data || []);
      }

      if (brandsResult.error) {
        console.error("Brands error:", brandsResult.error);
      } else {
        setBrands(brandsResult.data || []);
      }

      if (shapesResult.error) {
        console.error("Shapes error:", shapesResult.error);
      } else {
        setShapes(shapesResult.data || []);
      }

      if (materialsResult.error) {
        console.error("Materials error:", materialsResult.error);
      } else {
        setMaterials(materialsResult.data || []);
      }

      setLoading(false);
    };

    fetchShopData();
  }, []);

  const toggleFilter = (value, selectedValues, setSelectedValues) => {
    setSelectedValues((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
    setCurrentPage(1);
  };

  const filteredBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(brandSearch.toLowerCase()),
  );

  const visibleBrands = showAllBrands
    ? filteredBrands
    : filteredBrands.slice(0, 5);

  const filteredProducts = products.filter((product) => {
    const brandMatch =
      selectedBrands.length === 0 || selectedBrands.includes(product.brand_id);

    const shapeMatch =
      selectedShapes.length === 0 ||
      selectedShapes.includes(product.frame_shape_id);

    const materialMatch =
      selectedMaterials.length === 0 ||
      selectedMaterials.includes(product.frame_material_id);

    const priceMatch = Number(product.price) <= Number(maxPrice);

    const stockMatch = !inStockOnly || product.stock > 0;

    return (
      brandMatch && shapeMatch && materialMatch && priceMatch && stockMatch
    );
  });

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPrimaryImage = (product) => {
    const primary = product.product_images?.find((img) => img.is_primary);

    return (
      primary?.image_url ||
      product.product_images?.[0]?.image_url ||
      "https://placehold.co/400x300?text=No+Image"
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center">
          <div className="h-10 w-10 border-4 border-[#D32F2F] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-sm text-gray-600">Please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />

      <main className="bg-white py-12 px-6 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-[#212529] mb-6">
            Shop Frames
          </h1>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar Filters */}
            <aside className="w-full md:w-72">
              <div className="border border-gray-200 rounded-xl p-5 sticky top-24">
                <h2 className="text-lg font-bold text-[#212529] mb-5">
                  Filters
                </h2>

                {/* Brand Filter */}
                <div className="mb-6">
                  <h3 className="font-semibold text-[#212529] mb-3">Brands</h3>

                  <input
                    type="text"
                    placeholder="Search brand..."
                    value={brandSearch}
                    onChange={(e) => {
                      setBrandSearch(e.target.value);
                      setShowAllBrands(false);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#D32F2F]"
                  />

                  <div className="space-y-2">
                    {visibleBrands.map((brand) => (
                      <label
                        key={brand.id}
                        className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBrands.includes(brand.id)}
                          onChange={() =>
                            toggleFilter(
                              brand.id,
                              selectedBrands,
                              setSelectedBrands,
                            )
                          }
                          className="accent-[#D32F2F]"
                        />
                        {brand.name}
                      </label>
                    ))}
                  </div>

                  {filteredBrands.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllBrands((prev) => !prev)}
                      className="mt-3 text-sm text-[#D32F2F] hover:underline"
                    >
                      {showAllBrands ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>

                {/* Frame Shape Filter */}
                <div className="mb-6">
                  <h3 className="font-semibold text-[#212529] mb-3">
                    Frame Shape
                  </h3>

                  <div className="space-y-2">
                    {shapes.map((shape) => (
                      <label
                        key={shape.id}
                        className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedShapes.includes(shape.id)}
                          onChange={() =>
                            toggleFilter(
                              shape.id,
                              selectedShapes,
                              setSelectedShapes,
                            )
                          }
                          className="accent-[#D32F2F]"
                        />
                        {shape.name}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Material Filter */}
                <div className="mb-6">
                  <h3 className="font-semibold text-[#212529] mb-3">
                    Material
                  </h3>

                  <div className="space-y-2">
                    {materials.map((material) => (
                      <label
                        key={material.id}
                        className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMaterials.includes(material.id)}
                          onChange={() =>
                            toggleFilter(
                              material.id,
                              selectedMaterials,
                              setSelectedMaterials,
                            )
                          }
                          className="accent-[#D32F2F]"
                        />
                        {material.name}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-[#212529]">
                      Price Range
                    </h3>
                    <span className="text-sm text-gray-600">₱{maxPrice}</span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max={MAX_PRICE}
                    step="100"
                    value={maxPrice}
                    onChange={(e) => {
                      setMaxPrice(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="w-full accent-[#D32F2F]"
                  />

                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>₱0</span>
                    <span>₱{MAX_PRICE}</span>
                  </div>
                </div>

                {/* Availability */}
                <div className="mb-2">
                  <h3 className="font-semibold text-[#212529] mb-3">
                    Availability
                  </h3>

                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => {
                        setInStockOnly(e.target.checked);
                        setCurrentPage(1);
                      }}
                      className="accent-[#D32F2F]"
                    />
                    In stock only
                  </label>
                </div>
              </div>
            </aside>

            {/* Product Grid */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-gray-600">
                  Showing {filteredProducts.length} product
                  {filteredProducts.length !== 1 ? "s" : ""}
                </p>
              </div>

              {filteredProducts.length === 0 ? (
                <p className="text-gray-500 text-center py-12">
                  No products match the selected filters.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedProducts.map((product) => (
                      <div
                        key={product.id}
                        className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition bg-white"
                      >
                        <img
                          src={getPrimaryImage(product)}
                          alt={product.name}
                          className="w-full h-48 object-cover"
                        />

                        <div className="p-4">
                          <h3 className="font-semibold text-[#212529]">
                            {product.name}
                          </h3>

                          <p className="text-sm text-gray-500">
                            {product.brands?.name || "No brand"}
                          </p>

                          <div className="flex flex-wrap gap-2 mt-3">
                            {product.frame_shape?.name && (
                              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                                {product.frame_shape.name}
                              </span>
                            )}

                            {product.frame_material?.name && (
                              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                                {product.frame_material.name}
                              </span>
                            )}
                          </div>

                          <div className="flex justify-between items-center mt-4">
                            <span className="text-[#D32F2F] font-bold">
                              ₱{Number(product.price).toFixed(2)}
                            </span>

                            <button
                              onClick={() => navigate(`/product/${product.id}`)}
                              className="text-sm bg-[#D32F2F] text-white px-3 py-1.5 rounded-lg hover:bg-[#B71C1C] transition"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-8">
                      <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Prev
                      </button>

                      {[...Array(totalPages)].map((_, i) => (
                        <button
                          key={i}
                          onClick={() => goToPage(i + 1)}
                          className={`px-3 py-1 border rounded ${
                            currentPage === i + 1
                              ? "bg-[#D32F2F] text-white"
                              : "bg-white text-[#212529]"
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}

                      <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
