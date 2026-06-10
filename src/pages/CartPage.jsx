import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiTrash2 } from "react-icons/fi";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useCart } from "../context/CartContext";

export default function CartPage() {
  const { cartItems, updateQuantity, removeFromCart, isSyncing } = useCart();
  const navigate = useNavigate();

  const [shippingMethod, setShippingMethod] = useState("pickup");

  const shippingCost = shippingMethod === "pickup" ? 0 : 99;
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const total = subtotal + shippingCost;

  const formatPrice = (price) => `₱${Number(price || 0).toFixed(2)}`;

  const handleQuantityChange = (index, delta) => {
    const newQty = cartItems[index].quantity + delta;
    if (newQty < 1) {
      removeFromCart(index);
      toast.success("Item removed.");
    } else {
      updateQuantity(index, newQty);
    }
  };

  const handleRemove = (index) => {
    removeFromCart(index);
    toast.success("Item removed.");
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }
    navigate("/checkout", {
      state: {
        selectedItems: cartItems,
        shippingMethod,
        shippingCost,
      },
    });
  };

  if (cartItems.length === 0) {
    return (
      <>
        <Header />
        <main className="bg-white min-h-[60vh] flex items-center justify-center py-12 px-6">
          <div className="text-center max-w-md">
            <h1 className="text-3xl font-bold text-[#212529] mb-2">
              Your Cart is Empty
            </h1>
            <p className="text-gray-500 mb-6">
              Looks like you haven't added any products to your cart yet.
            </p>
            <Link
              to="/shop"
              className="inline-block w-full bg-[#D32F2F] hover:bg-[#B71C1C] text-white text-center font-semibold px-6 py-3 rounded-lg transition shadow"
            >
              Continue Shopping
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="bg-white py-12 px-6 md:px-12 lg:px-24">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-[#212529] mb-8">
            Shopping Cart
          </h1>

          {/* Table header (desktop) */}
          <div className="hidden md:grid grid-cols-12 gap-4 text-sm font-semibold text-gray-500 border-b pb-3 mb-4">
            <div className="col-span-5">PRODUCT</div>
            <div className="col-span-2 text-right">PRICE</div>
            <div className="col-span-2 text-center">QTY</div>
            <div className="col-span-2 text-right">TOTAL</div>
            <div className="col-span-1"></div>
          </div>

          {/* Cart items */}
          <div className="space-y-6">
            {cartItems.map((item, idx) => {
              const selectedOptions = item.selectedOptions || {};
              const coatings = selectedOptions.coatings || [];
              const lensPackage = selectedOptions.lensPackage || null;
              const lensExtra =
                selectedOptions.lensExtraCharge ||
                selectedOptions.coatingExtra ||
                0;
              const baseFramePrice = item.price - lensExtra;
              const isAccessory =
                item.brand === "Accessory" || item.type === "accessory";
              const itemTotal = item.price * item.quantity;

              // Build extras as an array of lines
              const extraLines = [];
              if (selectedOptions.color)
                extraLines.push(`Color: ${selectedOptions.color}`);
              if (lensPackage)
               extraLines.push(`Lens Package: ${lensPackage}`);
              if (coatings.length)
                extraLines.push(`Coating: ${coatings.join(", ")}`);

              // Safe fallbacks to prevent undefined errors + AI Vision Mode labels
              if (selectedOptions.prescription) {
                const p = selectedOptions.prescription;
                const label =
                  selectedOptions.visionMode === "AI Screening"
                    ? "AI Vision Check"
                    : "Prescription";
               extraLines.push(`${label}:`);
               extraLines.push(`OD: ${p.odSphere ?? "0.00"}`);
               extraLines.push(`OS: ${p.osSphere ?? "0.00"}`);

               if (p.pd) {
                 extraLines.push(`PD: ${p.pd} mm`);
               }
              }

              return (
                <div
                  key={`${item.id}-${idx}`}
                  className="grid grid-cols-12 gap-4 items-center border-b pb-4"
                >
                  {/* PRODUCT */}
                  <div className="col-span-12 md:col-span-5 flex gap-3">
                    <img
                      src={item.image || "https://placehold.co/100x100"}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-[#212529]">
                        {item.name}
                      </div>
                      {!isAccessory && (
                        <div className="text-sm text-gray-500">
                          {item.brand || "No brand"} · {item.shape || "N/A"} ·{" "}
                          {item.material || "N/A"}
                        </div>
                      )}
                      {isAccessory && (
                        <div className="text-sm text-gray-500">Accessory</div>
                      )}
                      {extraLines.length > 0 && (
                        <div className="text-xs text-gray-600 mt-1 space-y-0.5 bg-gray-50 p-2 rounded border border-gray-100 font-medium">
                          {extraLines.map((line, i) => (
                            <div key={i}>{line}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PRICE */}
                  <div className="col-span-12 md:col-span-2 text-left md:text-right">
                    <div className="font-medium">
                      {formatPrice(item.price)} / piece
                    </div>
                    {lensExtra > 0 && !isAccessory && (
                      <div className="text-xs text-gray-500 mt-1 space-y-1">
                        <div>Frame Price: {formatPrice(baseFramePrice)}</div>

                        {lensExtra > 0 && (
                          <div>Lens Package: {formatPrice(lensExtra)}</div>
                        )}

                        <div className="font-semibold">
                          Item Total: {formatPrice(item.price)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* QTY */}
                  <div className="col-span-12 md:col-span-2 flex justify-start md:justify-center">
                    <div className="flex items-center border border-gray-300 rounded-md bg-white">
                      <button
                        onClick={() => handleQuantityChange(idx, -1)}
                        disabled={isSyncing}
                        className={`px-2 py-1 ${isSyncing ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        -
                      </button>
                      <span className="px-3 py-1 min-w-[40px] text-center font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(idx, 1)}
                        disabled={isSyncing}
                        className={`px-2 py-1 ${isSyncing ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => handleRemove(idx)}
                      disabled={isSyncing}
                      className="text-red-500 ml-2 md:hidden disabled:opacity-50"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* TOTAL */}
                  <div className="col-span-12 md:col-span-2 text-left md:text-right font-semibold text-gray-900">
                    {formatPrice(itemTotal)}
                  </div>

                  {/* DESKTOP TRASH */}
                  <div className="hidden md:block md:col-span-1 text-right">
                    <button
                      onClick={() => handleRemove(idx)}
                      disabled={isSyncing}
                      className="text-red-500 hover:text-red-700 transition disabled:opacity-50"
                    >
                      <FiTrash2 className="w-5 h-5 inline" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Combined Card: Shipping + Totals (two-column layout) */}
          <div className="mt-10 bg-gray-50 border border-gray-200 rounded-2xl p-6">
            <div className="grid lg:grid-cols-[2fr_1fr] gap-10 items-start">
              {/* LEFT SIDE - SHIPPING */}
              <div>
                <h2 className="text-xl font-semibold text-[#212529] mb-6">
                  Choose shipping mode
                </h2>
                <div className="space-y-5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="shipping"
                      value="pickup"
                      checked={shippingMethod === "pickup"}
                      onChange={() => setShippingMethod("pickup")}
                      className="mt-1 accent-[#D32F2F]"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          Store pickup
                        </span>
                        <span className="text-sm text-gray-500">
                          (ready in 2‑3 days)
                        </span>
                      </div>
                      <p className="text-sm text-green-600 font-medium">FREE</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="shipping"
                      value="delivery"
                      checked={shippingMethod === "delivery"}
                      onChange={() => setShippingMethod("delivery")}
                      className="mt-1 accent-[#D32F2F]"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          Delivery
                        </span>
                        <span className="text-sm text-gray-500">
                          (3‑5 business days)
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">₱99.00</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* RIGHT SIDE - ORDER SUMMARY */}
              <div className="border-t lg:border-t-0 lg:border-l border-gray-200 lg:pl-8 pt-6 lg:pt-0">
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="uppercase text-gray-500">Subtotal</span>
                    <span className="font-medium">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="uppercase text-gray-500">Shipping</span>
                    <span className="font-medium">
                      {shippingMethod === "pickup"
                        ? "Free"
                        : formatPrice(shippingCost)}
                    </span>
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex justify-between font-bold text-lg text-gray-900">
                      <span>Total</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={isSyncing}
                  className={`w-full mt-6 py-3 rounded-lg font-semibold transition text-white shadow-sm ${
                    isSyncing
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[#D32F2F] hover:bg-[#B71C1C]"
                  }`}
                >
                  {isSyncing
                    ? "Saving Changes..."
                    : `Checkout ${formatPrice(total)}`}
                </button>
                <Link
                  to="/shop"
                  className="block text-center text-[#D32F2F] mt-4 text-sm font-medium hover:underline"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
