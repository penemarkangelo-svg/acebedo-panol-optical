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
  const [selectedColor, setSelectedColor] = useState("Gold");
  const [selectedCoatings, setSelectedCoatings] = useState([]);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          *,
          brands (name),
          categories (name, type),
          product_images (image_url, is_primary)
        `,
        )
        .eq("id", id)
        .single();
      if (error) {
        console.error(error);
        navigate("/shop");
      } else {
        setProduct(data);
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id, navigate]);

  const handleQuantityChange = (delta) => {
    const newQty = quantity + delta;
    if (newQty >= 1 && newQty <= 99) setQuantity(newQty);
  };

  const handleCoatingToggle = (coating) => {
    setSelectedCoatings((prev) =>
      prev.includes(coating)
        ? prev.filter((c) => c !== coating)
        : [...prev, coating],
    );
  };

  const handleAddToCart = () => {
    addToCart(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        image: primaryImage,
        // you can also pass product_images array if needed
      },
      quantity,
      { color: selectedColor, coatings: selectedCoatings },
    );
    alert("Added to cart!");
  };

  const handleTryOn = () => {
    // TODO: open AR try-on (later)
    alert("AR Try-on coming soon");
  };

 if (loading) {
   return (
     <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
       <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center">
         <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
         <p className="mt-3 text-sm text-gray-600">Opening Product</p>
       </div>
     </div>
   );
 }

  if (!product) return null;

  const primaryImage =
    product.product_images?.find((img) => img.is_primary)?.image_url ||
    product.product_images?.[0]?.image_url ||
    "https://placehold.co/600x400?text=No+Image";

  const brandName = product.brands?.name || "Generic";
  const categoryName = product.categories?.name || "Frame";
  const material =
    product.categories?.type === "material"
      ? product.categories?.name
      : "Metal";

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
              ← Back to Shop
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-12">
            {/* Left: Product Image */}
            <div>
              <img
                src={primaryImage}
                alt={product.name}
                className="w-full rounded-2xl shadow-md"
              />
            </div>

            {/* Right: Product Info */}
            <div>
              {/* Bestseller badge (optional) */}
              {product.is_new && (
                <span className="inline-block bg-[#D32F2F] text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
                  Bestseller
                </span>
              )}
              <h1 className="text-3xl md:text-4xl font-bold text-[#212529]">
                {product.name}
              </h1>
              <p className="text-gray-500 mt-1">
                {brandName} · {categoryName} · {material}
              </p>
              <div className="mt-4">
                <span className="text-3xl font-bold text-[#D32F2F]">
                  ${product.price}
                </span>
                {product.old_price && (
                  <span className="ml-2 text-gray-400 line-through">
                    ${product.old_price}
                  </span>
                )}
              </div>

              {/* Color selection (demo) */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-[#212529] mb-2">
                  Color
                </label>
                <div className="flex gap-3">
                  {["Gold", "Silver", "Black", "Rose Gold"].map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 rounded-full border ${
                        selectedColor === color
                          ? "border-[#D32F2F] ring-2 ring-[#D32F2F]/30"
                          : "border-gray-300"
                      } text-sm hover:border-[#D32F2F] transition`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
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
                        onClick={() => handleCoatingToggle(coating)}
                        className={`px-4 py-2 rounded-full border ${
                          selectedCoatings.includes(coating)
                            ? "bg-[#D32F2F] text-white border-[#D32F2F]"
                            : "border-gray-300 text-gray-700"
                        } text-sm hover:border-[#D32F2F] transition`}
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
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                  >
                    -
                  </button>
                  <span className="text-lg font-semibold w-8 text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Buttons */}
              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={handleAddToCart}
                  className="bg-[#D32F2F] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#B71C1C] transition shadow-md"
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
