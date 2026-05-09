import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useCart } from "../context/CartContext";

export default function CheckoutPage() {
  const { cartItems, subtotal, totalItems } = useCart();

  const [fulfillmentMethod, setFulfillmentMethod] = useState("pickup");

  const formatPrice = (price) => {
    return `₱${Number(price || 0).toFixed(2)}`;
  };

  if (cartItems.length === 0) {
    return (
      <>
        <Header />

        <main className="bg-white min-h-screen py-12 px-6 md:px-12 lg:px-20">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-[#212529] mb-4">Checkout</h1>

            <p className="text-gray-500 mb-6">
              Your cart is empty. Add frames first before checking out.
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

      <main className="bg-white min-h-screen py-12 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-[#212529] mb-8">Checkout</h1>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Checkout Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Contact Information */}
              <section className="border border-gray-200 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-[#212529] mb-4">
                  Contact Information
                </h2>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="Enter your full name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D32F2F]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Number
                    </label>
                    <input
                      type="text"
                      placeholder="09XXXXXXXXX"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D32F2F]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="example@email.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D32F2F]"
                    />
                  </div>
                </div>
              </section>

              {/* Fulfillment Method */}
              <section className="border border-gray-200 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-[#212529] mb-4">
                  Fulfillment Method
                </h2>

                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFulfillmentMethod("pickup")}
                    className={`text-left border rounded-xl p-4 transition ${
                      fulfillmentMethod === "pickup"
                        ? "border-[#D32F2F] ring-2 ring-[#D32F2F]/20"
                        : "border-gray-300 hover:border-[#D32F2F]"
                    }`}
                  >
                    <p className="font-semibold text-[#212529]">
                      Pickup at Store
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Customer will pick up the order at Acebedo Panol Optical.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFulfillmentMethod("delivery")}
                    className={`text-left border rounded-xl p-4 transition ${
                      fulfillmentMethod === "delivery"
                        ? "border-[#D32F2F] ring-2 ring-[#D32F2F]/20"
                        : "border-gray-300 hover:border-[#D32F2F]"
                    }`}
                  >
                    <p className="font-semibold text-[#212529]">Delivery</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Customer provides a delivery address for the order.
                    </p>
                  </button>
                </div>
              </section>

              {/* Delivery Address */}
              {fulfillmentMethod === "delivery" && (
                <section className="border border-gray-200 rounded-xl p-6">
                  <h2 className="text-xl font-semibold text-[#212529] mb-4">
                    Delivery Address
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Complete Address
                      </label>
                      <textarea
                        rows="4"
                        placeholder="House no., street, barangay, city, province"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D32F2F]"
                      ></textarea>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes for Delivery
                      </label>
                      <input
                        type="text"
                        placeholder="Optional delivery instruction"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D32F2F]"
                      />
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* Order Summary */}
            <aside className="bg-gray-50 p-6 rounded-xl h-fit border border-gray-200">
              <h2 className="text-xl font-semibold text-[#212529] mb-4">
                Order Summary
              </h2>

              <div className="space-y-4 mb-4">
                {cartItems.map((item, index) => {
                  const selectedOptions = item.selectedOptions || {};
                  const coatings = selectedOptions.coatings || [];
                  const itemTotal = Number(item.price || 0) * item.quantity;

                  return (
                    <div
                      key={`${item.id}-${index}`}
                      className="flex gap-3 border-b border-gray-200 pb-4"
                    >
                      <img
                        src={item.image || "https://placehold.co/80x80"}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />

                      <div className="flex-1">
                        <p className="font-semibold text-sm text-[#212529]">
                          {item.name}
                        </p>

                        <p className="text-xs text-gray-500">
                          Qty: {item.quantity}
                        </p>

                        {selectedOptions.color && (
                          <p className="text-xs text-gray-500">
                            Color: {selectedOptions.color}
                          </p>
                        )}

                        {coatings.length > 0 && (
                          <p className="text-xs text-gray-500">
                            Coating: {coatings.join(", ")}
                          </p>
                        )}

                        <p className="text-sm font-semibold text-[#D32F2F] mt-1">
                          {formatPrice(itemTotal)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal ({totalItems} items)</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>

                <div className="flex justify-between text-gray-500">
                  <span>Shipping</span>
                  <span>
                    {fulfillmentMethod === "pickup"
                      ? "Pickup"
                      : "To be calculated"}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-200 mt-4 pt-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  alert("Order saving to Supabase will be added next.")
                }
                className="w-full mt-6 bg-[#D32F2F] text-white py-3 rounded-lg hover:bg-[#B71C1C] transition font-semibold"
              >
                Place Order
              </button>

              <Link
                to="/cart"
                className="block text-center text-[#D32F2F] mt-3 text-sm hover:underline"
              >
                Back to Cart
              </Link>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
