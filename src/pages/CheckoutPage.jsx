import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cartItems, clearCart } = useCart(); // ADDED clearCart
  const location = useLocation();
  const navigate = useNavigate();

  // Get shipping method and cost from cart page
  const { shippingMethod = "pickup", shippingCost = 0 } = location.state || {};
  const isPickup = shippingMethod === "pickup";

  // Form fields
  const [contactName, setContactName] = useState(
    user?.user_metadata?.full_name || "",
  );
  const [phone, setPhone] = useState("");
  // Delivery address fields
  const [address, setAddress] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [zip, setZip] = useState("");
  const [confirmCorrect, setConfirmCorrect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({});

  const handleBlur = (field) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const isFormValid = () => {
    if (!contactName.trim()) return false;
    if (!phone.trim()) return false;
    if (!confirmCorrect) return false;
    if (!isPickup) {
      if (!address.trim()) return false;
      if (!barangay.trim()) return false;
      if (!city.trim()) return false;
      if (!province.trim()) return false;
      if (!zip.trim()) return false;
    }
    return true;
  };

  const selectedItems = cartItems;
  const totalItems = selectedItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const subtotal = selectedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const total = subtotal + shippingCost;
  const formatPrice = (price) => `₱${Number(price || 0).toFixed(2)}`;

  const handlePlaceOrder = async () => {
    if (!isFormValid()) {
      toast.error(
        "Please fill in all required fields and confirm the details.",
      );
      setTouched({
        contactName: true,
        phone: true,
        ...(!isPickup && {
          address: true,
          barangay: true,
          city: true,
          province: true,
          zip: true,
        }),
      });
      return;
    }
console.log(
  "Selected options for first item:",
  selectedItems[0]?.selectedOptions,
);
    setSaving(true);
    try {
      // 1. Insert order
      const deliveryAddress = isPickup
        ? null
        : `${address}, ${barangay}, ${city}, ${province} ${zip}`;
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          customer_name: contactName,
          email: user.email,
          contact_number: phone,
          fulfillment_method: shippingMethod,
          delivery_address: deliveryAddress,
          delivery_notes: null,
          order_status: "pending",
          payment_method: "paypal",
          payment_status: "unpaid",
          subtotal: subtotal,
          shipping_fee: shippingCost,
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
        prescription_data: item.selectedOptions?.prescription || null,
        lens_type_id: item.selectedOptions?.lensType || null,
        coating_id: item.selectedOptions?.coatingId || null,
        lens_package_name: item.selectedOptions?.lensPackage || null,
      }));
      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);
      if (itemsError) throw itemsError;

      // 3. Deduct stock
      const productIds = selectedItems.map((item) => item.id);
      const quantities = selectedItems.map((item) => item.quantity);
      const colors = selectedItems.map(
        (item) => item.selectedOptions?.color || null,
      );
      const { error: stockError } = await supabase.rpc("deduct_stock", {
        p_product_ids: productIds,
        p_quantities: quantities,
        p_colors: colors,
      });
      if (stockError) {
        await supabase.from("order_items").delete().eq("order_id", order.id);
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(stockError.message);
      }

      // 4. Clear entire cart (await the async clearCart)
      await clearCart();

      toast.success("Order placed successfully!");
      navigate(`/order-status/${order.id}`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to place order. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreditCardClick = () => {
    toast.info(
      "Credit card payment is not available in this demo. Please use PayPal.",
    );
  };

  if (selectedItems.length === 0) {
    return (
      <>
        <Header />
        <main className="bg-white min-h-screen py-12 px-6 md:px-12 lg:px-20">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Checkout</h1>
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
      <main className="bg-white py-12 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-[#212529] mb-8">Checkout</h1>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* LEFT COLUMN – FORMS */}
            <div className="lg:col-span-2 space-y-6">
              <div className="border-b pb-2">
                <h2 className="text-lg font-semibold">
                  {isPickup
                    ? "Store Pickup Information"
                    : "Delivery Information"}
                </h2>
                <p className="text-sm text-gray-500">
                  {isPickup
                    ? "You will pick up your order at our Rosario branch."
                    : "Please provide your shipping address."}
                </p>
              </div>

              {isPickup ? (
                <>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                    <h3 className="font-semibold text-[#212529]">
                      Pickup Location
                    </h3>
                    <p className="text-sm text-gray-700">
                      Acebedo Panol Optical - Rosario Branch
                    </p>
                    <p className="text-xs text-gray-500">Rosario, Cavite</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Name *
                      </label>
                      <input
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        onBlur={() => handleBlur("contactName")}
                        className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F] outline-none transition ${
                          touched.contactName && !contactName.trim()
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                      />
                      {touched.contactName && !contactName.trim() && (
                        <p className="text-red-500 text-xs mt-1">
                          Name is required.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onBlur={() => handleBlur("phone")}
                        className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F] outline-none transition ${
                          touched.phone && !phone.trim()
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                        placeholder="09XXXXXXXXX"
                      />
                      {touched.phone && !phone.trim() && (
                        <p className="text-red-500 text-xs mt-1">
                          Phone number is required.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Delivery fields – same as before */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      onBlur={() => handleBlur("contactName")}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F] outline-none transition ${
                        touched.contactName && !contactName.trim()
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    />
                    {touched.contactName && !contactName.trim() && (
                      <p className="text-red-500 text-xs mt-1">
                        Full name is required.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onBlur={() => handleBlur("phone")}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F] outline-none transition ${
                        touched.phone && !phone.trim()
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      placeholder="09XXXXXXXXX"
                    />
                    {touched.phone && !phone.trim() && (
                      <p className="text-red-500 text-xs mt-1">
                        Phone number is required.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address (house #, street) *
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      onBlur={() => handleBlur("address")}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F] outline-none transition ${
                        touched.address && !address.trim()
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    />
                    {touched.address && !address.trim() && (
                      <p className="text-red-500 text-xs mt-1">
                        Address is required.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Barangay *
                    </label>
                    <input
                      type="text"
                      value={barangay}
                      onChange={(e) => setBarangay(e.target.value)}
                      onBlur={() => handleBlur("barangay")}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F] outline-none transition ${
                        touched.barangay && !barangay.trim()
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    />
                    {touched.barangay && !barangay.trim() && (
                      <p className="text-red-500 text-xs mt-1">
                        Barangay is required.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City / Municipality *
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        onBlur={() => handleBlur("city")}
                        className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F] outline-none transition ${
                          touched.city && !city.trim()
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                      />
                      {touched.city && !city.trim() && (
                        <p className="text-red-500 text-xs mt-1">
                          City is required.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Province *
                      </label>
                      <input
                        type="text"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        onBlur={() => handleBlur("province")}
                        className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F] outline-none transition ${
                          touched.province && !province.trim()
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                      />
                      {touched.province && !province.trim() && (
                        <p className="text-red-500 text-xs mt-1">
                          Province is required.
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP Code *
                    </label>
                    <input
                      type="text"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      onBlur={() => handleBlur("zip")}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F] outline-none transition ${
                        touched.zip && !zip.trim()
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    />
                    {touched.zip && !zip.trim() && (
                      <p className="text-red-500 text-xs mt-1">
                        ZIP Code is required.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Methods */}
              <div className="border-t pt-6">
                <h2 className="text-lg font-semibold mb-3">Payment Method</h2>
                <div className="space-y-3">
                  {/* PayPal – working */}
                  <div
                    onClick={handlePlaceOrder}
                    className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition ${
                      !saving
                        ? "hover:border-[#D32F2F] hover:bg-red-50"
                        : "opacity-50 cursor-wait"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg"
                        alt="PayPal"
                        className="h-6"
                      />
                      <span className="font-medium">PayPal</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      Pay with your PayPal account
                    </span>
                  </div>
                  {/* Credit Card – mock */}
                  <div
                    onClick={handleCreditCardClick}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-xl cursor-pointer opacity-70 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <span className="text-xl">💳</span>
                        <span className="font-medium">Credit / Debit Card</span>
                      </div>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        Demo only
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      Visa, Mastercard
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN – ORDER SUMMARY */}
            <aside className="bg-gray-50 p-6 rounded-xl h-fit border border-gray-200 sticky top-24">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              <div className="space-y-4 mb-4 max-h-80 overflow-y-auto">
                {selectedItems.map((item, idx) => {
                  const selectedOptions = item.selectedOptions || {};
                  const coatings = selectedOptions.coatings || [];
                  const rx = selectedOptions.prescription;
                  const visionMode = selectedOptions.visionMode;
                  const itemTotal = Number(item.price || 0) * item.quantity;
                  return (
                    <div
                      key={`${item.id}-${idx}`}
                      className="border-b border-gray-200 pb-4"
                    >
                      <div className="flex gap-3">
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
                          {selectedOptions.lensPackage && (
                            <p className="text-xs text-gray-500">
                              Lens: {selectedOptions.lensPackage}
                            </p>
                          )}
                          <p className="text-sm font-semibold text-[#D32F2F] mt-1">
                            ₱{itemTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      {visionMode && visionMode !== "Plano" && rx && (
                        <div className="mt-2 bg-white p-2 rounded border border-gray-200 text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-gray-700">
                              Prescription Details
                            </span>
                            <span className="text-blue-600 text-[10px] bg-blue-50 px-1.5 py-0.5 rounded">
                              {visionMode}
                            </span>
                          </div>
                          <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                              <tr className="text-gray-400">
                                <th className="py-0.5">Eye</th>
                                <th className="py-0.5">SPH</th>
                                <th className="py-0.5">CYL</th>
                                <th className="py-0.5">AXIS</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="font-bold">OD (Right)</td>
                                <td>{rx.odSphere || "0.00"}</td>
                                <td>{rx.odCylinder || "0.00"}</td>
                                <td>{rx.odAxis || "0"}°</td>
                              </tr>
                              <tr>
                                <td className="font-bold">OS (Left)</td>
                                <td>{rx.osSphere || "0.00"}</td>
                                <td>{rx.osCylinder || "0.00"}</td>
                                <td>{rx.osAxis || "0"}°</td>
                              </tr>
                            </tbody>
                          </table>
                          {rx.pd && (
                            <div className="mt-1 pt-1 border-t text-[11px]">
                              <span className="font-semibold">
                                PD (Pupillary Distance):
                              </span>{" "}
                              {rx.pd} mm
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal ({totalItems} items)</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>
                    {isPickup ? "Pickup (Free)" : formatPrice(shippingCost)}
                  </span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmCorrect}
                    onChange={(e) => setConfirmCorrect(e.target.checked)}
                    className="mt-0.5 accent-[#D32F2F]"
                  />
                  <span>
                    I confirm that all shipping/pickup details and lens
                    configurations (including prescription values if applicable)
                    are correct. I understand that custom prescription lenses
                    are tailored specifically to these specifications.
                  </span>
                </label>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={saving || !isFormValid()}
                className="w-full mt-6 bg-[#D32F2F] text-white py-3 rounded-lg hover:bg-[#B71C1C] transition font-semibold disabled:opacity-50"
              >
                {saving ? "Processing..." : "Place Order"}
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
