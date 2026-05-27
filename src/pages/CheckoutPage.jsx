import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { supabase } from "../lib/supabaseClient";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cartItems, removeFromCart, clearCart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  // Get selected items from cart page (or fallback to all cart items if not provided)
  const selectedItems = location.state?.selectedItems || cartItems;

  const [fulfillmentMethod, setFulfillmentMethod] = useState("pickup");
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    contactNumber: "",
    email: "",
    address: "",
    deliveryNotes: "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const totalItems = selectedItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const subtotal = selectedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const total = subtotal; // no shipping fee for simplicity

  const handlePlaceOrder = async () => {
    if (!user) {
      alert("Please log in to place an order.");
      navigate("/login");
      return;
    }
    if (selectedItems.length === 0) {
      alert("No items selected for checkout.");
      navigate("/cart");
      return;
    }
    if (!formData.fullName || !formData.contactNumber || !formData.email) {
      alert("Please fill in all required contact fields.");
      return;
    }
    if (fulfillmentMethod === "delivery" && !formData.address) {
      alert("Please provide a delivery address.");
      return;
    }

    setSaving(true);

    try {
      // 1. Insert the order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          customer_name: formData.fullName,
          email: formData.email,
          contact_number: formData.contactNumber,
          fulfillment_method: fulfillmentMethod,
          delivery_address:
            fulfillmentMethod === "delivery" ? formData.address : null,
          delivery_notes: formData.deliveryNotes || null,
          order_status: "pending",
          payment_method: "not_selected", // placeholder
          payment_status: "unpaid",
          subtotal: subtotal,
          shipping_fee: 0,
          total: total,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert order items
      const orderItems = selectedItems.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        brand_name: item.brand || null,
        frame_shape: item.shape || null,
        frame_material: item.material || null,
        selected_color: item.selectedOptions?.color || null,
        selected_color_hex: item.selectedOptions?.colorHex || null,
        selected_coatings: item.selectedOptions?.coatings || [],
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 3. Clear selected items from cart (remove each selected item)
      // We need to find indices of selected items in cartItems and remove them
      // Simplest: clear the whole cart? Better: remove only selected.
      // We'll use the cart context remove function with index.
      // Since we have selectedItems, we can loop over cartItems and remove matches.
      const indicesToRemove = [];
      cartItems.forEach((cartItem, idx) => {
        const isSelected = selectedItems.some(
          (sel) =>
            sel.id === cartItem.id &&
            JSON.stringify(sel.selectedOptions) ===
              JSON.stringify(cartItem.selectedOptions),
        );
        if (isSelected) indicesToRemove.push(idx);
      });
      // Remove from end to avoid index shifting
      for (let i = indicesToRemove.length - 1; i >= 0; i--) {
        removeFromCart(indicesToRemove[i]);
      }

      // 4. Redirect to order confirmation
      navigate(`/order-confirmation/${order.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to place order: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (selectedItems.length === 0) {
    return (
      <>
        <Header />
        <main className="bg-white min-h-screen py-12 px-6 md:px-12 lg:px-20">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-[#212529] mb-4">Checkout</h1>
            <p className="text-gray-500 mb-6">
              No items selected for checkout.
            </p>
            <Link to="/cart" className="text-[#D32F2F] hover:underline">
              Back to Cart
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
            <div className="lg:col-span-2 space-y-6">
              {/* Contact Information */}
              <section className="border border-gray-200 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-[#212529] mb-4">
                  Contact Information
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      placeholder="Enter your full name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Number *
                    </label>
                    <input
                      type="text"
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={handleInputChange}
                      placeholder="09XXXXXXXXX"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F]"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="example@email.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F]"
                      required
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
                        Complete Address *
                      </label>
                      <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        rows="4"
                        placeholder="House no., street, barangay, city, province"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F]"
                      ></textarea>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes for Delivery
                      </label>
                      <input
                        type="text"
                        name="deliveryNotes"
                        value={formData.deliveryNotes}
                        onChange={handleInputChange}
                        placeholder="Optional delivery instruction"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F]"
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
              <div className="space-y-4 mb-4 max-h-80 overflow-y-auto">
                {selectedItems.map((item, idx) => {
                  const selectedOptions = item.selectedOptions || {};
                  const coatings = selectedOptions.coatings || [];
                  const itemTotal = Number(item.price || 0) * item.quantity;
                  return (
                    <div
                      key={`${item.id}-${idx}`}
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
                          ₱{itemTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal ({totalItems} items)</span>
                  <span>₱{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Shipping</span>
                  <span>
                    {fulfillmentMethod === "pickup"
                      ? "Pickup (Free)"
                      : "To be calculated"}
                  </span>
                </div>
              </div>
              <div className="border-t border-gray-200 mt-4 pt-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>₱{total.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={handlePlaceOrder}
                disabled={saving}
                className="w-full mt-6 bg-[#D32F2F] text-white py-3 rounded-lg hover:bg-[#B71C1C] transition font-semibold disabled:opacity-50"
              >
                {saving ? "Placing Order..." : "Place Order"}
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
