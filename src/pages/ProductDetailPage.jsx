import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/CartContext";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function ProductDetailPage() {
  const { addToCart } = useCart();
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedCoatings, setSelectedCoatings] = useState([]);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("products")
        .select(
          `
          *,
          brands (id, name),
          frame_shape:categories!products_frame_shape_id_fkey(id, name, type),
          frame_material:categories!products_frame_material_id_fkey(id, name, type),
          product_images (image_url, is_primary),
          product_colors (id, color_name, color_hex, stock, is_available)
        `,
        )
        .eq("id", id)
        .single();

      if (error) {
        console.error("Product detail error:", error);
        navigate("/shop");
      } else {
        setProduct(data);

        const availableColors =
          data.product_colors?.filter((color) => color.is_available) || [];

        if (availableColors.length > 0) {
          setSelectedColor(availableColors[0]);
        }
      }

      setLoading(false);
    };

    fetchProduct();
  }, [id, navigate]);

  const primaryImage =
    product?.product_images?.find((img) => img.is_primary)?.image_url ||
    product?.product_images?.[0]?.image_url ||
    "https://placehold.co/600x400?text=No+Image";

  const brandName = product?.brands?.name || "No brand";
  const shapeName = product?.frame_shape?.name || "Shape not specified";
  const materialName =
    product?.frame_material?.name || "Material not specified";
  const stock = Number(product?.stock || 0);
  const isInStock = stock > 0;

  const availableColors =
    product?.product_colors?.filter((color) => color.is_available) || [];

  const handleQuantityChange = (delta) => {
    const newQty = quantity + delta;
    const maxQty = isInStock ? Math.min(stock, 99) : 1;

    if (newQty >= 1 && newQty <= maxQty) {
      setQuantity(newQty);
    }
  };

  const handleCoatingToggle = (coating) => {
    setSelectedCoatings((prev) =>
      prev.includes(coating)
        ? prev.filter((item) => item !== coating)
        : [...prev, coating],
    );
  };

  const handleAddToCart = () => {
    if (!isInStock) {
      alert("This product is currently out of stock.");
      return;
    }

    addToCart(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        image: primaryImage,
        brand: brandName,
        shape: shapeName,
        material: materialName,
      },
      quantity,
      {
        color: selectedColor?.color_name || "No color selected",
        colorHex: selectedColor?.color_hex || null,
        coatings: selectedCoatings,
      },
    );

    alert("Added to cart!");
  };

  const handleTryOn = () => {
    alert("AR Try-on coming soon");
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center">
          <div className="h-10 w-10 border-4 border-[#D32F2F] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-sm text-gray-600">Opening Product...</p>
        </div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <>
      <Header />

      <main className="bg-white py-12 px-6 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Back to shop"
              className="text-[#212529] hover:text-[#D32F2F] transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="size-12"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m11.25 9-3 3m0 0 3 3m-3-3h7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Product Image */}
            <div>
              <img
                src={primaryImage}
                alt={product.name}
                className="w-full rounded-2xl shadow-md object-cover"
              />
            </div>

            {/* Product Info */}
            <div>
              {product.is_new && (
                <span className="inline-block bg-[#D32F2F] text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
                  New Arrival
                </span>
              )}

              <h1 className="text-3xl md:text-4xl font-bold text-[#212529]">
                {product.name}
              </h1>

              <p className="text-gray-500 mt-2">
                {brandName} · {shapeName} · {materialName}
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  {shapeName}
                </span>

                <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  {materialName}
                </span>

                <span
                  className={`text-xs px-3 py-1 rounded-full ${
                    isInStock
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {isInStock ? `In stock: ${stock}` : "Out of stock"}
                </span>
              </div>

              <div className="mt-5">
                <span className="text-3xl font-bold text-[#D32F2F]">
                  ₱{Number(product.price).toFixed(2)}
                </span>

                {product.old_price && (
                  <span className="ml-2 text-gray-400 line-through">
                    ₱{Number(product.old_price).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Color Selection */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-[#212529] mb-2">
                  Available Color
                </label>

                {availableColors.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {availableColors.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm transition ${
                          selectedColor?.id === color.id
                            ? "border-[#D32F2F] ring-2 ring-[#D32F2F]/30"
                            : "border-gray-300 hover:border-[#D32F2F]"
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-gray-300"
                          style={{
                            backgroundColor: color.color_hex || "#ffffff",
                          }}
                        ></span>
                        {color.color_name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No color options available.
                  </p>
                )}
              </div>

              {/* Lens Coating */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-[#212529] mb-2">
                  Lens Coating
                </label>

                <div className="flex flex-wrap gap-3">
                  {["Blue-block", "Anti-reflective", "Photochromic"].map(
                    (coating) => (
                      <button
                        key={coating}
                        type="button"
                        onClick={() => handleCoatingToggle(coating)}
                        className={`px-4 py-2 rounded-full border text-sm transition ${
                          selectedCoatings.includes(coating)
                            ? "bg-[#D32F2F] text-white border-[#D32F2F]"
                            : "border-gray-300 text-gray-700 hover:border-[#D32F2F]"
                        }`}
                      >
                        {coating}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Quantity */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-[#212529] mb-2">
                  Quantity
                </label>
                <div className="inline-flex items-center justify-between w-36 h-11 border border-gray-300 rounded-xl overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="w-11 h-full flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    -
                  </button>

                  <span className="flex-1 text-center text-base font-semibold text-[#212529]">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleQuantityChange(1)}
                    disabled={!isInStock || quantity >= Math.min(stock, 99)}
                    className="w-11 h-full flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Buttons */}
              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!isInStock}
                  className={`px-8 py-3 rounded-lg font-semibold transition shadow-md ${
                    isInStock
                      ? "bg-[#D32F2F] text-white hover:bg-[#B71C1C]"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {isInStock ? "Add to Cart" : "Out of Stock"}
                </button>

                <button
                  type="button"
                  onClick={handleTryOn}
                  className="border border-gray-300 text-[#212529] px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Try On
                </button>
              </div>

              {/* Description */}
              <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-semibold text-[#212529] mb-2">
                  Description
                </h3>

                <p className="text-gray-600 leading-relaxed">
                  {product.description ||
                    "Elegant frame designed for comfort and style. Perfect for everyday wear with a touch of sophistication."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
