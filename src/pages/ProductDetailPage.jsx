import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/CartContext";
import { FaArrowLeft } from "react-icons/fa";
import toast from "react-hot-toast";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function ProductDetailPage() {
  const { addToCart } = useCart();
  const { id } = useParams();
  const navigate = useNavigate();

  // Common state
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(null);
  const [mainImage, setMainImage] = useState("");

  // Frame-specific state
  const [visionMode, setVisionMode] = useState("plano");
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [rx, setRx] = useState({
    odSphere: "",
    odCylinder: "",
    odAxis: "",
    osSphere: "",
    osCylinder: "",
    osAxis: "",
    pd: "",
  });
  const [lensPackages, setLensPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(true);

  // Fetch product data
  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          *,
          brands (name),
          frame_shape:frame_shapes (name),
          frame_material:frame_materials (name),
          product_images (image_url, is_primary),
          product_colors (id, color_name, color_code, stock)
        `,
        )
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching product details:", error);
        navigate("/shop");
      } else {
        setProduct(data);
        const primary = data.product_images?.find((img) => img.is_primary);
        setMainImage(
          primary?.image_url ||
            data.product_images?.[0]?.image_url ||
            "https://placehold.co/600x400?text=No+Image",
        );
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id, navigate]);

  // Fetch dynamic lens prices and schemas from Supabase
  useEffect(() => {
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

        // Map relationships elegantly in memory
        const mappedPackages = pricing.map((priceRow) => {
          const lensType = types.find(
            (t) => String(t.id).trim() === String(priceRow.lens_type_id).trim(),
          );
          const coating = coatings.find(
            (c) => String(c.id).trim() === String(priceRow.coating_id).trim(),
          );

          return {
            id: `${priceRow.lens_type_id}_${priceRow.coating_id}`,
            lensType: priceRow.lens_type_id,
            coatingId: priceRow.coating_id,
            displayName: `${lensType?.name || "Unknown Lens"} + ${coating?.name || "Unknown Coating"}`,
            description: coating?.description || "No description available.",
            price: priceRow.price,
          };
        });

        setLensPackages(mappedPackages);
      } catch (err) {
        console.error("Error building lens matrix:", err);
      } finally {
        setPackagesLoading(false);
      }
    };

    fetchLensData();
  }, []);

  // Reset selected package layout whenever vision mode changes to avoid bad selections
  useEffect(() => {
    setSelectedPackageId(null);
  }, [visionMode]);

  // Filter available packages reactively based on selection context
  const availablePackages = useMemo(() => {
    if (!product || product.type !== "frame") return [];

    let filtered = lensPackages;

    if (visionMode === "plano") {
      // Plano users only select standard Single Vision (sv) profiles
      filtered = lensPackages.filter((pkg) => pkg.lensType === "sv");
    }

    return filtered;
  }, [product, visionMode, lensPackages]);

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

  // Verification helper: Checks prescription bounds
  const isPrescriptionValid = () => {
    if (visionMode !== "prescription_form") return true;
    const odSphereValid =
      rx.odSphere.trim() !== "" && !isNaN(parseFloat(rx.odSphere));
    const osSphereValid =
      rx.osSphere.trim() !== "" && !isNaN(parseFloat(rx.osSphere));
    const pdValid = rx.pd.trim() !== "" && !isNaN(parseFloat(rx.pd));
    return odSphereValid && osSphereValid && pdValid;
  };

  // Guard Clause for managing cart transaction eligibility
  const isAddToCartEnabled = () => {
    if (product.type === "accessory") {
      return quantity <= product.stock && product.stock > 0;
    }
    if (!selectedColor) return false;
    if (!selectedPackageId) return false;
    if (quantity > (selectedColor.stock || 0)) return false;
    if (visionMode === "prescription_form" && !isPrescriptionValid())
      return false;
    return true;
  };

  const getFrameValidationMessage = () => {
    if (!selectedColor) return "Please select a frame color.";
    if (!selectedPackageId) return "Please select a lens package.";
    if (quantity > (selectedColor.stock || 0))
      return `Only ${selectedColor.stock} available for this color.`;
    if (visionMode === "prescription_form") {
      if (!rx.odSphere.trim() || !rx.osSphere.trim() || !rx.pd.trim())
        return "Please fill in Sphere (both eyes) and PD.";
      if (isNaN(parseFloat(rx.odSphere)) || isNaN(parseFloat(rx.osSphere)))
        return "Sphere values must be numbers.";
    }
    return "";
  };

  const handleAddToCart = () => {
    if (!isAddToCartEnabled()) return;

    if (product.type === "accessory") {
      if (quantity > product.stock) {
        toast.error(`Only ${product.stock} available.`);
        return;
      }
      addToCart(
        {
          id: product.id,
          name: product.name,
          price: product.price,
          image: mainImage,
          brand: "Accessory",
          shape: "",
          material: "",
        },
        quantity,
        { type: "accessory" },
      );
      toast.success("Added to cart!");
    } else {
      const selectedPackage = availablePackages.find(
        (p) => p.id === selectedPackageId,
      );
      const lensExtra = selectedPackage?.price || 0;
      const finalPrice = product.price + lensExtra;

      if (quantity > (selectedColor.stock || 0)) {
        toast.error("Not enough stock for this color.");
        return;
      }

      const config = {
        color: selectedColor.color_name,
        colorHex: selectedColor.color_code,
        visionMode:
          visionMode === "plano"
            ? "Plano"
            : visionMode === "prescription_form"
              ? "Manual Rx"
              : "AI Screening",
        lensPackage: selectedPackage?.displayName,
        lensExtraCharge: lensExtra,
        lensType: selectedPackage.lensType,
        coatingId: selectedPackage.coatingId,
        coatings: [],
        prescription: visionMode !== "plano" ? rx : null,
      };

      addToCart(
        {
          id: product.id,
          name: product.name,
          price: finalPrice,
          image: mainImage,
          brand: product.brands?.name,
          shape: product.frame_shape?.name,
          material: product.frame_material?.name,
        },
        quantity,
        config,
      );
      toast.success("Added to cart!");
    }
  };

  const stock = selectedColor ? selectedColor.stock : product.stock;
  const selectedPackage = selectedPackageId
    ? availablePackages.find((p) => p.id === selectedPackageId)
    : null;
  const lensExtra = selectedPackage?.price || 0;
  const finalPrice = product.price + lensExtra;
  const validationMessage = getFrameValidationMessage();

  const handleColorToggle = (color) => {
    setSelectedColor(selectedColor?.id === color.id ? null : color);
    setQuantity(1);
  };

  const handlePackageToggle = (pkgId) => {
    setSelectedPackageId(selectedPackageId === pkgId ? null : pkgId);
  };

  const handleRxChange = (e) =>
    setRx((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // ========== ACCESSORY VIEW LAYOUT ==========
  if (product.type === "accessory") {
    const accessoryStock = product.stock || 0;
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
                <p className="text-gray-500 mt-2">{product.description}</p>
                <div className="mt-4">
                  <span className="text-3xl font-black text-[#D32F2F]">
                    ₱{product.price.toFixed(2)}
                  </span>
                </div>
                <div className="mt-3">
                  <span
                    className={`text-sm px-3 py-1 rounded-full ${accessoryStock > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
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
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                    >
                      -
                    </button>
                    <span className="px-4 py-1 min-w-[40px] text-center font-medium">
                      {quantity}
                    </span>
                    <button
                      onClick={() =>
                        setQuantity((q) => Math.min(accessoryStock, q + 1))
                      }
                      className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={!accessoryStock || quantity > accessoryStock}
                  className={`mt-8 w-full py-3 rounded-lg font-semibold transition shadow-md ${!accessoryStock || quantity > accessoryStock ? "bg-gray-300 cursor-not-allowed text-gray-500" : "bg-[#D32F2F] text-white hover:bg-[#B71C1C]"}`}
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

  // ========== FRAME CONFIGURATOR VIEW LAYOUT ==========
  return (
    <>
      <Header />
      <main className="bg-white py-12 px-6 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="mb-6 text-gray-500 hover:text-[#D32F2F] transition flex items-center gap-1 text-sm"
            aria-label="Go back"
          >
            <FaArrowLeft className="w-6 h-6" />
          </button>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* LEFT COLUMN – IMAGE GALLERY */}
            <div>
              <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 shadow-md">
                <img
                  src={mainImage}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {product.product_images?.length > 1 && (
                <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                  {product.product_images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setMainImage(img.image_url)}
                      className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 ${mainImage === img.image_url ? "border-[#D32F2F]" : "border-gray-200"}`}
                    >
                      <img
                        src={img.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN – CONFIGURATOR */}
            <div className="space-y-6">
              <div>
                {product.is_new && (
                  <span className="inline-block bg-[#D32F2F] text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
                    New Arrival
                  </span>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl md:text-4xl font-bold text-[#212529]">
                    {product.name}
                  </h1>
                  <div className="mt-2">
                    <span
                      className={`text-sm px-3 py-1 rounded-full ${stock > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {stock > 0 ? `In stock (${stock})` : "Out of stock"}
                    </span>
                  </div>
                </div>
                <p className="text-gray-500 mt-1">
                  {product.brands?.name} · {product.frame_shape?.name} ·{" "}
                  {product.frame_material?.name}
                </p>
              </div>
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-black text-[#D32F2F]">
                    ₱{finalPrice.toFixed(2)}
                  </span>
                  {lensExtra > 0 && (
                    <span className="text-sm text-gray-500">
                      (+₱{lensExtra} lens package)
                    </span>
                  )}
                </div>
              </div>
              {/* Color selection container */}
              <div>
                <label className="block text-sm font-semibold text-[#212529] mb-2">
                  Frame Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.product_colors?.map((color) => {
                    const isSelected = selectedColor?.id === color.id;
                    const outOfStock = color.stock <= 0;
                    return (
                      <button
                        key={color.id}
                        onClick={() => handleColorToggle(color)}
                        disabled={outOfStock}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition ${isSelected ? "border-[#D32F2F] bg-[#D32F2F]/10 ring-1 ring-[#D32F2F]" : "border-gray-300 hover:border-[#D32F2F]"} ${outOfStock ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-gray-300"
                          style={{
                            backgroundColor: color.color_code || "#ccc",
                          }}
                        />
                        {color.color_name}
                        {outOfStock && " (Out of stock)"}
                      </button>
                    );
                  })}
                </div>
                {!selectedColor && product.product_colors?.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Please select a frame color.
                  </p>
                )}
              </div>
              {/* 3‑way vision mode selector */}
              <div>
                <label className="block text-sm font-semibold text-[#212529] mb-2">
                  Vision Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["plano", "prescription_form", "prescription_ai"].map(
                    (mode) => (
                      <button
                        key={mode}
                        onClick={() => setVisionMode(mode)}
                        className={`py-2 rounded-lg text-sm font-medium transition ${visionMode === mode ? "bg-[#D32F2F] text-white shadow" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                      >
                        {mode === "plano"
                          ? "Plano (Zero Grade)"
                          : mode === "prescription_form"
                            ? "Manual Prescription"
                            : "AI Screening"}
                      </button>
                    ),
                  )}
                </div>
              </div>
              {/* Manual prescription form fields layout */}
              {visionMode === "prescription_form" && (
                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                  <h3 className="font-semibold text-[#212529]">
                    Prescription Details
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-500">
                    <div>Metric</div>
                    <div>Right (OD)</div>
                    <div>Left (OS)</div>
                  </div>
                  {["Sphere", "Cylinder", "Axis"].map((field) => (
                    <div
                      key={field}
                      className="grid grid-cols-3 gap-2 items-center"
                    >
                      <span className="text-sm font-medium text-gray-700">
                        {field}
                      </span>
                      <input
                        type="text"
                        name={`od${field}`}
                        value={rx[`od${field}`]}
                        onChange={handleRxChange}
                        className="border rounded px-2 py-1 text-center text-sm"
                        placeholder={`e.g., ${field === "Axis" ? "90" : "0.00"}`}
                      />
                      <input
                        type="text"
                        name={`os${field}`}
                        value={rx[`os${field}`]}
                        onChange={handleRxChange}
                        className="border rounded px-2 py-1 text-center text-sm"
                        placeholder={`e.g., ${field === "Axis" ? "90" : "0.00"}`}
                      />
                    </div>
                  ))}
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">
                      PD (mm)
                    </span>
                    <input
                      type="text"
                      name="pd"
                      value={rx.pd}
                      onChange={handleRxChange}
                      className="border rounded px-2 py-1 w-24 text-center text-sm"
                      placeholder="e.g., 64"
                    />
                  </div>
                </div>
              )}
              {/* AI screening interface anchor link */}
              {visionMode === "prescription_ai" && (
                <div className="bg-blue-50 p-4 rounded-xl text-center">
                  <p className="text-sm text-gray-700">
                    Use our AI vision screening tool to estimate your
                    prescription.
                  </p>
                  <button
                    onClick={() => navigate("/vision-screening")}
                    className="mt-2 text-[#D32F2F] font-medium underline"
                  >
                    Launch AI Screening →
                  </button>
                </div>
              )}
              {/* Dynamic Lens Package Card List Container */}
              <div>
                <label className="block text-sm font-semibold text-[#212529] mb-2">
                  {visionMode === "plano"
                    ? "Lens Package (Plano)"
                    : "Lens Package (Prescription)"}
                </label>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {packagesLoading ? (
                    <div className="py-6 flex flex-col items-center justify-center text-gray-400 gap-2">
                      <div className="h-6 w-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs">Loading lens metadata...</p>
                    </div>
                  ) : (
                    availablePackages.map((pkg) => {
                      const isSelected = selectedPackageId === pkg.id;
                      return (
                        <div
                          key={pkg.id}
                          onClick={() => handlePackageToggle(pkg.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition ${isSelected ? "border-[#D32F2F] bg-[#D32F2F]/5" : "border-gray-200 hover:border-gray-400"}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="font-medium text-[#212529]">
                              {pkg.displayName}
                            </div>
                            <div className="font-semibold text-sm text-gray-700">
                              +₱{pkg.price}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {pkg.description}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {!selectedPackageId &&
                  !packagesLoading &&
                  availablePackages.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Please select a lens package.
                    </p>
                  )}
              </div>
              {/* Checkout Operations and Interactivity Context */}
              <div className="flex flex-col gap-2 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#212529] mb-1">
                      Quantity
                    </label>
                    <div className="flex items-center border border-gray-300 rounded-md">
                      <button
                        onClick={() =>
                          quantity > 1 && setQuantity((q) => q - 1)
                        }
                        className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                      >
                        -
                      </button>
                      <span className="w-12 py-1 text-center font-medium">
                        {quantity}
                      </span>
                      <button
                        onClick={() =>
                          quantity < Math.min(stock, 99) &&
                          setQuantity((q) => q + 1)
                        }
                        className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    disabled={!isAddToCartEnabled()}
                    className={`flex-1 py-3 rounded-lg font-semibold transition shadow-md ${isAddToCartEnabled() ? "bg-[#D32F2F] text-white hover:bg-[#B71C1C]" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
                  >
                    Add to Cart
                  </button>
                </div>
                {!isAddToCartEnabled() && validationMessage && (
                  <p className="text-red-500 text-sm text-right mt-1">
                    {validationMessage}
                  </p>
                )}
              </div>
              {/* Main Product Description Area */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-semibold text-[#212529] mb-1">
                  Description
                </h3>
                <p className="text-gray-600 text-sm">
                  {product.description ||
                    "Elegant frame designed for comfort and style."}
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
