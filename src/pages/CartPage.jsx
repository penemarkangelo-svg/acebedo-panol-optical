import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useCart } from "../context/CartContext";

export default function CartPage() {
  const { cartItems, updateQuantity, removeFromCart } = useCart();

  // Track which items are selected for checkout (by index)
  const [selectedIndices, setSelectedIndices] = useState(
    () => cartItems.map((_, idx) => idx), // all selected by default
  );

  const formatPrice = (price) => `₱${Number(price || 0).toFixed(2)}`;

  const toggleSelectItem = (index) => {
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIndices.length === cartItems.length) {git
      setSelectedIndices([]);
    } else {
      setSelectedIndices(cartItems.map((_, idx) => idx));
    }
  };

  // Calculate totals for selected items
  let selectedSubtotal = 0;
  let selectedCoatingExtra = 0;
  let selectedTotalQuantity = 0;

  cartItems.forEach((item, idx) => {
    if (!selectedIndices.includes(idx)) return;
    const coatingExtra = item.selectedOptions?.coatingExtra || 0;
    const qty = item.quantity;
    selectedSubtotal += item.price * qty;
    selectedCoatingExtra += coatingExtra * qty;
    selectedTotalQuantity += qty;
  });

  const selectedTotal = selectedSubtotal;

  const canCheckout = selectedTotalQuantity > 0;

  if (cartItems.length === 0) {
    return (
      <>
        <Header />
        <main className="bg-white min-h-screen py-12 px-6 md:px-12 lg:px-20">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-[#212529] mb-4">
              Your Cart is Empty
            </h1>
            <p className="text-gray-500 mb-6">
              Looks like you have not added any frames yet.
            </p>
            <Link
              to="/shop"
              className="inline-block bg-[#D32F2F] text-white px-6 py-3 rounded-lg hover:bg-[#B71C1C] transition"
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
      <main className="bg-white py-12 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-[#212529]">Shopping Cart</h1>
            <button
              onClick={toggleSelectAll}
              className="text-sm text-[#D32F2F] hover:underline"
            >
              {selectedIndices.length === cartItems.length
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items with checkboxes */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item, index) => {
                const selectedOptions = item.selectedOptions || {};
                const coatings = selectedOptions.coatings || [];
                const coatingExtra = selectedOptions.coatingExtra || 0;
                const basePrice = item.price - coatingExtra; // final price minus coating surcharge

                return (
                  <div
                    key={`${item.id}-${index}`}
                    className="border border-gray-200 rounded-xl p-4 flex gap-4"
                  >
                    {/* Checkbox */}
                    <div className="flex-shrink-0 pt-1">
                      <input
                        type="checkbox"
                        checked={selectedIndices.includes(index)}
                        onChange={() => toggleSelectItem(index)}
                        className="w-5 h-5 accent-[#D32F2F]"
                      />
                    </div>

                    <img
                      src={item.image || "https://placehold.co/120x120"}
                      alt={item.name}
                      className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                    />

                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-[#212529]">
                            {item.name}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {item.brand || "No brand"} · {item.shape || "N/A"} ·{" "}
                            {item.material || "N/A"}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatPrice(basePrice)} 
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-[#212529]">
                            {formatPrice(item.price * item.quantity)}
                          </p>
                        </div>
                      </div>

                      {/* Selected options display */}
                      <div className="mt-2 space-y-1">
                        {selectedOptions.color && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span>Color:</span>
                            {selectedOptions.colorHex && (
                              <span
                                className="w-3 h-3 rounded-full border border-gray-300"
                                style={{
                                  backgroundColor: selectedOptions.colorHex,
                                }}
                              ></span>
                            )}
                            <span>{selectedOptions.color}</span>
                          </div>
                        )}
                        {coatings.length > 0 && (
                          <p className="text-xs text-gray-600">
                            Lens Coating: {coatings.join(", ")}
                          </p>
                        )}
                      </div>

                      {/* Quantity and remove */}
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <div className="inline-flex items-center border border-gray-300 rounded-md overflow-hidden">
                          <button
                            onClick={() =>
                              updateQuantity(index, item.quantity - 1)
                            }
                            className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                          >
                            -
                          </button>
                          <span className="px-3 py-1 min-w-[40px] text-center font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(index, item.quantity + 1)
                            }
                            className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(index)}
                          className="text-red-500 text-sm hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Order Summary - show coating extra separately */}
            <aside className="bg-gray-50 p-6 rounded-xl h-fit border border-gray-200">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal ({selectedTotalQuantity} items)</span>
                  <span>{formatPrice(selectedSubtotal)}</span>
                </div>
                {selectedCoatingExtra > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Lens coating extra</span>
                    <span>{formatPrice(selectedCoatingExtra)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Shipping</span>
                  <span>Calculated at next step</span>
                </div>
                <div className="border-t pt-3 mt-2">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatPrice(selectedTotal)}</span>
                  </div>
                </div>
              </div>

              {canCheckout ? (
                <Link
                  to="/checkout"
                  state={{
                    selectedItems: cartItems.filter((_, idx) =>
                      selectedIndices.includes(idx),
                    ),
                  }}
                  className="block text-center bg-[#D32F2F] text-white py-3 rounded-lg hover:bg-[#B71C1C] transition font-semibold mt-4"
                >
                  Proceed to Checkout
                </Link>
              ) : (
                <button
                  disabled
                  className="w-full bg-gray-300 text-gray-500 py-3 rounded-lg font-semibold cursor-not-allowed mt-4"
                >
                  Select an item to checkout
                </button>
              )}
              <Link
                to="/shop"
                className="block text-center text-[#D32F2F] mt-3 text-sm hover:underline"
              >
                Continue Shopping
              </Link>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
