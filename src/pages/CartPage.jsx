import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useCart } from "../context/CartContext";

export default function CartPage() {
  const { cartItems, updateQuantity, removeFromCart, subtotal, totalItems } =
    useCart();

  const formatPrice = (price) => {
    return `₱${Number(price || 0).toFixed(2)}`;
  };

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
          <h1 className="text-3xl font-bold text-[#212529] mb-8">
            Shopping Cart
          </h1>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item, index) => {
                const selectedOptions = item.selectedOptions || {};
                const coatings = selectedOptions.coatings || [];
                const itemTotal = Number(item.price || 0) * item.quantity;

                return (
                  <div
                    key={`${item.id}-${index}`}
                    className="border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4"
                  >
                    <img
                      src={item.image || "https://placehold.co/120x120"}
                      alt={item.name}
                      className="w-full sm:w-28 h-40 sm:h-28 object-cover rounded-lg"
                    />

                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-[#212529]">
                            {item.name}
                          </h3>

                          <p className="text-sm text-gray-500 mt-1">
                            {item.brand || "No brand"} ·{" "}
                            {item.shape || "Shape not specified"} ·{" "}
                            {item.material || "Material not specified"}
                          </p>

                          <p className="text-sm font-semibold text-[#D32F2F] mt-2">
                            {formatPrice(item.price)}
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="font-semibold text-[#212529]">
                            {formatPrice(itemTotal)}
                          </p>
                        </div>
                      </div>

                      {/* Selected Options */}
                      <div className="mt-3 space-y-1">
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

                      {/* Quantity Controls */}
                      <div className="flex flex-wrap items-center gap-3 mt-4">
                        <div className="inline-flex items-center justify-between w-32 h-10 border border-gray-300 rounded-xl overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(index, item.quantity - 1)
                            }
                            className="w-10 h-full flex items-center justify-center text-gray-600 hover:bg-gray-100"
                          >
                            -
                          </button>

                          <span className="flex-1 text-center text-sm font-semibold text-[#212529]">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(index, item.quantity + 1)
                            }
                            className="w-10 h-full flex items-center justify-center text-gray-600 hover:bg-gray-100"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
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

            {/* Order Summary */}
            <aside className="bg-gray-50 p-6 rounded-xl h-fit border border-gray-200">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

              <div className="flex justify-between mb-2 text-sm">
                <span>Subtotal ({totalItems} items)</span>
                <span>{formatPrice(subtotal)}</span>
              </div>

              <div className="flex justify-between mb-4 text-sm text-gray-500">
                <span>Shipping</span>
                <span>Calculated at next step</span>
              </div>

              <div className="border-t pt-4 mb-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
              </div>

              <Link
                to="/checkout"
                className="block text-center bg-[#D32F2F] text-white py-3 rounded-lg hover:bg-[#B71C1C] transition font-semibold"
              >
                Proceed to Checkout
              </Link>

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
