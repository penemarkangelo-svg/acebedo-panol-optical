import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useCart } from "../context/CartContext";

export default function CartPage() {
  const { cartItems, updateQuantity, removeFromCart, subtotal, totalItems } =
    useCart();

  if (cartItems.length === 0) {
    return (
      <>
        <Header />
        <main className="bg-white min-h-screen py-12 px-6 md:px-12 lg:px-20">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-[#212529] mb-4">
              Your Cart is Empty
            </h1>
            <Link to="/shop" className="text-[#D32F2F] hover:underline">
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
              {cartItems.map((item, idx) => (
                <div key={idx} className="flex gap-4 border-b pb-4">
                  <img
                    src={item.image || "https://placehold.co/100"}
                    alt={item.name}
                    className="w-24 h-24 object-cover rounded"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-gray-500">${item.price}</p>
                    {item.selectedOptions.color && (
                      <p className="text-xs text-gray-400">
                        Color: {item.selectedOptions.color}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(idx, item.quantity - 1)}
                        className="px-2 border rounded"
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(idx, item.quantity + 1)}
                        className="px-2 border rounded"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFromCart(idx)}
                        className="text-red-500 text-sm ml-4"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="bg-gray-50 p-6 rounded-lg h-fit">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              <div className="flex justify-between mb-2">
                <span>Subtotal ({totalItems} items)</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-4 text-gray-500">
                <span>Shipping</span>
                <span>Calculated at next step</span>
              </div>
              <div className="border-t pt-4 mb-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
              </div>
              <Link
                to="/checkout"
                className="block text-center bg-[#D32F2F] text-white py-2 rounded-lg hover:bg-[#B71C1C] transition"
              >
                Proceed to Checkout
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
