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
  const [coatings, setCoatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedCoatings, setSelectedCoatings] = useState([]); // store full objects

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          *,
          brands (id, name),
          frame_shape:frame_shapes (id, name),
          frame_material:frame_materials (id, name),
          product_images (image_url, is_primary),
          product_colors (id, color_name, color_code, stock)
        `,
        )
        .eq("id", id)
        .single();

      if (error) {
        console.error("Product detail error:", error);
        navigate("/shop");
      } else {
        setProduct(data);
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id, navigate]);

  // Fetch lens coatings (include additional_price)
  useEffect(() => {
    const fetchCoatings = async () => {
      const { data, error } = await supabase
        .from("lens_coatings")
        .select("name, additional_price, description")
        .eq("is_available", true)
        .order("name");
      if (!error && data) setCoatings(data);
      else {
        // fallback
        setCoatings([
          {
            name: "Blue-block",
            additional_price: 500,
            description: "Helps reduce blue light",
          },
          {
            name: "Anti-reflective",
            additional_price: 300,
            description: "Reduces glare",
          },
          {
            name: "Photochromic",
            additional_price: 1000,
            description: "Darkens outdoors",
          },
        ]);
      }
    };
    fetchCoatings();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center">
          <div className="h-10 w-10 border-4 border-[#D32F2F] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-sm text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }
  if (!product) return null;

  const primaryImage =
    product.product_images?.find((img) => img.is_primary)?.image_url ||
    product.product_images?.[0]?.image_url ||
    "https://placehold.co/600x400?text=No+Image";

  const brandName = product.brands?.name || "No brand";
  const shapeName = product.frame_shape?.name || "Shape not specified";
  const materialName = product.frame_material?.name || "Material not specified";
  const availableColors = product.product_colors || [];

  // Get stock for selected color
  const selectedColorStock = selectedColor?.stock || 0;
  const totalStock = product.stock || 0;

  // Determine max quantity (use color stock if selected, else global stock)
  const maxQuantity = selectedColor ? selectedColorStock : totalStock;
  const canAddToCart =
    selectedColor !== null && maxQuantity > 0 && quantity <= maxQuantity;

  const handleColorSelect = (color) => {
    setSelectedColor(color);
    setQuantity(1);
  };

  const handleQuantityChange = (delta) => {
    const newQty = quantity + delta;
    if (newQty >= 1 && newQty <= Math.min(maxQuantity, 99)) {
      setQuantity(newQty);
    }
  };

  const handleCoatingToggle = (coating) => {
    setSelectedCoatings((prev) =>
      prev.some((c) => c.name === coating.name)
        ? prev.filter((c) => c.name !== coating.name)
        : [...prev, coating],
    );
  };

  const handleAddToCart = () => {
    if (!selectedColor) {
      alert("Please select a color first.");
      return;
    }
    if (selectedColorStock <= 0) {
      alert(`Selected color "${selectedColor.color_name}" is out of stock.`);
      return;
    }
    if (quantity > selectedColorStock) {
      alert(`Only ${selectedColorStock} items available for this color.`);
      return;
    }

    // Calculate total price including coatings
    const coatingExtra = selectedCoatings.reduce(
      (sum, coating) => sum + (Number(coating.additional_price) || 0),
      0,
    );
    const finalUnitPrice = product.price + coatingExtra;

    addToCart(
      {
        id: product.id,
        name: product.name,
        price: finalUnitPrice,
        image: primaryImage,
        brand: brandName,
        shape: shapeName,
        material: materialName,
      },
      quantity,
      {
        color: selectedColor.color_name,
        colorHex: selectedColor.color_code,
        coatings: selectedCoatings.map((c) => c.name),
        coatingExtra: coatingExtra,
      },
    );
    alert("Added to cart!");
  };

  const handleTryOn = () => {
    alert("AR Try-on coming soon");
  };

  return (
    <>
      <Header />
      <main className="bg-white py-12 px-6 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <button
              onClick={() => navigate(-1)}
              className="text-[#212529] hover:text-[#D32F2F] transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="size-10"
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
            {/* Left: Image */}
            <div>
              <img
                src={primaryImage}
                alt={product.name}
                className="w-full rounded-2xl shadow-md"
              />
            </div>

            {/* Right: Details */}
            <div>
              {product.is_new && (
                <span className="inline-block bg-[#D32F2F] text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
                  New Arrival
                </span>
              )}
              <h1 className="text-3xl md:text-4xl font-bold text-[#212529]">
                {product.name}
              </h1>
              <p className="text-gray-500 mt-1">
                {brandName} · {shapeName} · {materialName}
              </p>

              <div className="mt-4">
                <span className="text-3xl font-bold text-[#D32F2F]">
                  ₱{Number(product.price).toFixed(2)}
                </span>
                {product.old_price && (
                  <span className="ml-2 text-gray-400 line-through">
                    ₱{Number(product.old_price).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Overall stock indicator */}
              <div className="mt-3">
                <span
                  className={`text-xs px-3 py-1 rounded-full ${
                    totalStock > 0
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {totalStock > 0 ? `In stock (${totalStock})` : "Out of stock"}
                </span>
              </div>

              {/* Color selection (with individual stock) */}
              {availableColors.length > 0 && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-[#212529] mb-2">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {availableColors.map((color) => {
                      const colorStock = color.stock || 0;
                      const isSelected = selectedColor?.id === color.id;
                      return (
                        <button
                          key={color.id}
                          onClick={() => handleColorSelect(color)}
                          disabled={colorStock <= 0}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm transition ${
                            isSelected
                              ? "border-[#D32F2F] ring-2 ring-[#D32F2F]/30"
                              : "border-gray-300 hover:border-[#D32F2F]"
                          } ${colorStock <= 0 ? "opacity-50 cursor-not-allowed bg-gray-100" : ""}`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-gray-300"
                            style={{
                              backgroundColor: color.color_code || "#ccc",
                            }}
                          />
                          {color.color_name}
                          {colorStock <= 0 && " (Out of stock)"}
                        </button>
                      );
                    })}
                  </div>
                  {selectedColor && (
                    <p className="text-xs text-gray-500 mt-2">
                      {selectedColor.color_name} stock: {selectedColorStock}{" "}
                      available
                    </p>
                  )}
                </div>
              )}

              {/* Lens coatings (with price shown) */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-[#212529] mb-2">
                  Lens Coating
                </label>
                <div className="flex flex-wrap gap-3">
                  {coatings.map((coating) => (
                    <button
                      key={coating.name}
                      onClick={() => handleCoatingToggle(coating)}
                      className={`px-4 py-2 rounded-full border text-sm transition ${
                        selectedCoatings.some((c) => c.name === coating.name)
                          ? "bg-[#D32F2F] text-white border-[#D32F2F]"
                          : "border-gray-300 text-gray-700 hover:border-[#D32F2F]"
                      }`}
                    >
                      {coating.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-[#212529] mb-2">
                  Quantity
                </label>
                <div className="flex items-center border border-gray-300 rounded-md overflow-hidden w-fit">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="px-3 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="px-3 py-1 min-w-[40px] text-center font-medium">
                    {quantity}
                  </span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= Math.min(maxQuantity, 99)}
                    className="px-3 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                {selectedColor && (
                  <p className="text-xs text-gray-500 mt-2">
                    Max quantity for {selectedColor.color_name}:{" "}
                    {selectedColorStock}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={handleAddToCart}
                  disabled={!canAddToCart}
                  className={`px-8 py-3 rounded-lg font-semibold transition shadow-md ${
                    canAddToCart
                      ? "bg-[#D32F2F] text-white hover:bg-[#B71C1C]"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Add to Cart
                </button>
                <button
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
                <p className="text-gray-600">
                  {product.description ||
                    "Elegant frame designed for comfort and style. Perfect for everyday wear."}
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
