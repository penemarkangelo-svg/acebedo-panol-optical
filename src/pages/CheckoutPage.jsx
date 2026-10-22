import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/checkout.css";

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cartItems, clearCart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  const { shippingMethod = "pickup", shippingCost = 0 } =
    location.state || {};

  const isPickup = shippingMethod === "pickup";

  const [contactName, setContactName] = useState(
    user?.user_metadata?.full_name || "",
  );
  const [phone, setPhone] = useState("");

  const [address, setAddress] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [zip, setZip] = useState("");

  const [confirmCorrect, setConfirmCorrect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({});

  const handleBlur = (field) => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

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

  const formatPrice = (price) =>
    `₱${Number(price || 0).toFixed(2)}`;

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

    setSaving(true);

    try {
      const deliveryAddress = isPickup
        ? null
        : `${address}, ${barangay}, ${city}, ${province} ${zip}`;

      // 1. Create order
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
          subtotal,
          shipping_fee: shippingCost,
          total,
        })
        .select()
        .single();

      if (orderError) {
        console.error("Order creation failed:", {
          message: orderError.message,
          details: orderError.details,
          hint: orderError.hint,
          code: orderError.code,
        });

        throw orderError;
      }

      // 2. Create order items
      const orderItems = selectedItems.map((item) => ({
        order_id: order.id,
        product_id: item.id,

        product_name: item.name,
        brand_name: item.brand || null,
        frame_shape: item.shape || null,
        frame_material: item.material || null,

        product_color_id:
          item.selectedOptions?.productColorId || null,

        lens_type_id:
          item.selectedOptions?.lensType || null,

        coating_id:
          item.selectedOptions?.coatingId || null,

        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity,

        prescription_data:
          item.selectedOptions?.prescription || null,

        lens_package_name:
          item.selectedOptions?.lensPackage || null,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 3. Deduct stock
      const productIds = selectedItems.map((item) => item.id);

      const quantities = selectedItems.map(
        (item) => item.quantity,
      );

      const productColorIds = selectedItems.map(
        (item) =>
          item.selectedOptions?.productColorId || null,
      );

      const { error: stockError } = await supabase.rpc(
        "deduct_stock",
        {
          p_product_ids: productIds,
          p_quantities: quantities,
          p_product_color_ids: productColorIds,
        },
      );

      if (stockError) {
        await supabase
          .from("order_items")
          .delete()
          .eq("order_id", order.id);

        await supabase
          .from("orders")
          .delete()
          .eq("id", order.id);

        throw new Error(stockError.message);
      }

      // 4. Clear cart
      await clearCart();

      toast.success("Order placed successfully!");
      navigate(`/order-status/${order.id}`);
    } catch (err) {
      console.error(err);

      toast.error(
        err.message ||
          "Failed to place order. Please try again.",
      );
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

        <main className="checkout-page">
          <div className="checkout-empty">
            <h1>Checkout</h1>

            <p>No items selected for checkout.</p>

            <Link to="/cart">
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

      <main className="checkout-page">
        <div className="checkout-container">

          {/* HEADER */}
          <div className="checkout-heading-row">
            <h1 className="checkout-title">
              Checkout
            </h1>

            <div className="checkout-fulfillment-status">
              <span className="checkout-status-dot" />

              <span>
                {isPickup ? "Store pickup" : "Delivery"}
              </span>

              <span className="checkout-status-separator">
                ·
              </span>

              <span className="checkout-status-muted">
                {isPickup
                  ? "Ready in 2–3 days"
                  : "3–5 business days"}
              </span>
            </div>
          </div>

          <div className="checkout-layout">

            {/* LEFT */}
            <section className="checkout-main">

              {/* FULFILLMENT INFORMATION */}
              <section className="checkout-section">
                <div className="checkout-section-heading">
                  <h2>
                    {isPickup
                      ? "Store Pickup Information"
                      : "Delivery Information"}
                  </h2>

                  <p>
                    {isPickup
                      ? "You will pick up your order at our Rosario branch."
                      : "Please provide your shipping address."}
                  </p>
                </div>

                {isPickup ? (
                  <>
                    <div className="checkout-pickup-location">
                      <span className="checkout-small-label">
                        PICKUP LOCATION
                      </span>

                      <strong>
                        Acebedo Panol Optical - Rosario Branch
                      </strong>

                      <span>
                        Rosario, Cavite
                      </span>
                    </div>

                    <div className="checkout-fields">
                      <div className="checkout-field">
                        <label htmlFor="contact-name">
                          Contact Name
                          <span>*</span>
                        </label>

                        <input
                          id="contact-name"
                          type="text"
                          value={contactName}
                          onChange={(e) =>
                            setContactName(e.target.value)
                          }
                          onBlur={() =>
                            handleBlur("contactName")
                          }
                          className={
                            touched.contactName &&
                            !contactName.trim()
                              ? "checkout-input checkout-input-error"
                              : "checkout-input"
                          }
                        />

                        {touched.contactName &&
                          !contactName.trim() && (
                            <p className="checkout-error">
                              Name is required.
                            </p>
                          )}
                      </div>

                      <div className="checkout-field">
                        <label htmlFor="phone">
                          Phone Number
                          <span>*</span>
                        </label>

                        <input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) =>
                            setPhone(e.target.value)
                          }
                          onBlur={() =>
                            handleBlur("phone")
                          }
                          placeholder="09XXXXXXXXX"
                          className={
                            touched.phone &&
                            !phone.trim()
                              ? "checkout-input checkout-input-error"
                              : "checkout-input"
                          }
                        />

                        {touched.phone &&
                          !phone.trim() && (
                            <p className="checkout-error">
                              Phone number is required.
                            </p>
                          )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="checkout-fields">

                    <div className="checkout-field checkout-field-full">
                      <label htmlFor="delivery-name">
                        Full Name
                        <span>*</span>
                      </label>

                      <input
                        id="delivery-name"
                        type="text"
                        value={contactName}
                        onChange={(e) =>
                          setContactName(e.target.value)
                        }
                        onBlur={() =>
                          handleBlur("contactName")
                        }
                        className={
                          touched.contactName &&
                          !contactName.trim()
                            ? "checkout-input checkout-input-error"
                            : "checkout-input"
                        }
                      />

                      {touched.contactName &&
                        !contactName.trim() && (
                          <p className="checkout-error">
                            Full name is required.
                          </p>
                        )}
                    </div>

                    <div className="checkout-field checkout-field-full">
                      <label htmlFor="delivery-phone">
                        Phone Number
                        <span>*</span>
                      </label>

                      <input
                        id="delivery-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) =>
                          setPhone(e.target.value)
                        }
                        onBlur={() =>
                          handleBlur("phone")
                        }
                        placeholder="09XXXXXXXXX"
                        className={
                          touched.phone &&
                          !phone.trim()
                            ? "checkout-input checkout-input-error"
                            : "checkout-input"
                        }
                      />

                      {touched.phone &&
                        !phone.trim() && (
                          <p className="checkout-error">
                            Phone number is required.
                          </p>
                        )}
                    </div>

                    <div className="checkout-field checkout-field-full">
                      <label htmlFor="address">
                        Address (house #, street)
                        <span>*</span>
                      </label>

                      <input
                        id="address"
                        type="text"
                        value={address}
                        onChange={(e) =>
                          setAddress(e.target.value)
                        }
                        onBlur={() =>
                          handleBlur("address")
                        }
                        className={
                          touched.address &&
                          !address.trim()
                            ? "checkout-input checkout-input-error"
                            : "checkout-input"
                        }
                      />

                      {touched.address &&
                        !address.trim() && (
                          <p className="checkout-error">
                            Address is required.
                          </p>
                        )}
                    </div>

                    <div className="checkout-field checkout-field-full">
                      <label htmlFor="barangay">
                        Barangay
                        <span>*</span>
                      </label>

                      <input
                        id="barangay"
                        type="text"
                        value={barangay}
                        onChange={(e) =>
                          setBarangay(e.target.value)
                        }
                        onBlur={() =>
                          handleBlur("barangay")
                        }
                        className={
                          touched.barangay &&
                          !barangay.trim()
                            ? "checkout-input checkout-input-error"
                            : "checkout-input"
                        }
                      />

                      {touched.barangay &&
                        !barangay.trim() && (
                          <p className="checkout-error">
                            Barangay is required.
                          </p>
                        )}
                    </div>

                    <div className="checkout-field-row">
                      <div className="checkout-field">
                        <label htmlFor="city">
                          City / Municipality
                          <span>*</span>
                        </label>

                        <input
                          id="city"
                          type="text"
                          value={city}
                          onChange={(e) =>
                            setCity(e.target.value)
                          }
                          onBlur={() =>
                            handleBlur("city")
                          }
                          className={
                            touched.city &&
                            !city.trim()
                              ? "checkout-input checkout-input-error"
                              : "checkout-input"
                          }
                        />

                        {touched.city &&
                          !city.trim() && (
                            <p className="checkout-error">
                              City is required.
                            </p>
                          )}
                      </div>

                      <div className="checkout-field">
                        <label htmlFor="province">
                          Province
                          <span>*</span>
                        </label>

                        <input
                          id="province"
                          type="text"
                          value={province}
                          onChange={(e) =>
                            setProvince(e.target.value)
                          }
                          onBlur={() =>
                            handleBlur("province")
                          }
                          className={
                            touched.province &&
                            !province.trim()
                              ? "checkout-input checkout-input-error"
                              : "checkout-input"
                          }
                        />

                        {touched.province &&
                          !province.trim() && (
                            <p className="checkout-error">
                              Province is required.
                            </p>
                          )}
                      </div>
                    </div>

                    <div className="checkout-field checkout-field-full">
                      <label htmlFor="zip">
                        ZIP Code
                        <span>*</span>
                      </label>

                      <input
                        id="zip"
                        type="text"
                        value={zip}
                        onChange={(e) =>
                          setZip(e.target.value)
                        }
                        onBlur={() =>
                          handleBlur("zip")
                        }
                        className={
                          touched.zip &&
                          !zip.trim()
                            ? "checkout-input checkout-input-error"
                            : "checkout-input"
                        }
                      />

                      {touched.zip &&
                        !zip.trim() && (
                          <p className="checkout-error">
                            ZIP Code is required.
                          </p>
                        )}
                    </div>

                  </div>
                )}
              </section>

              {/* PAYMENT */}
              <section className="checkout-payment-section">
                <h2>Payment Method</h2>

                <div className="checkout-payment-options">

                  <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={saving}
                    className={`checkout-payment-option ${
                      saving
                        ? "checkout-payment-disabled"
                        : ""
                    }`}
                  >
                    <div className="checkout-payment-left">
                      <span className="checkout-radio">
                        <span />
                      </span>

                      <img
                        src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg"
                        alt="PayPal"
                      />

                      <span>PayPal</span>
                    </div>

                    <span>
                      Pay with your PayPal account
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCreditCardClick}
                    className="checkout-payment-option checkout-payment-card"
                  >
                    <div className="checkout-payment-left">
                      <span className="checkout-lock">
                        ♧
                      </span>

                      <span>
                        Credit / Debit Card
                      </span>

                      <small>
                        Demo only
                      </small>
                    </div>

                    <span>
                      Visa, Mastercard
                    </span>
                  </button>

                </div>
              </section>

            </section>

            {/* RIGHT */}
            <aside className="checkout-summary">

              <div className="checkout-summary-heading">
                <h2>Order Summary</h2>

                <span>
                  {totalItems}{" "}
                  {totalItems === 1 ? "item" : "items"}
                </span>
              </div>

              <div className="checkout-summary-items">
                {selectedItems.map((item, idx) => {
                  const selectedOptions =
                    item.selectedOptions || {};

                  const coatings =
                    selectedOptions.coatings || [];

                  const rx =
                    selectedOptions.prescription;

                  const visionMode =
                    selectedOptions.visionMode;

                  const itemTotal =
                    Number(item.price || 0) *
                    item.quantity;

                  return (
                    <div
                      key={`${item.id}-${idx}`}
                      className="checkout-summary-item"
                    >
                      <div className="checkout-summary-product">
                        <img
                          src={
                            item.image ||
                            "https://placehold.co/80x80"
                          }
                          alt={item.name}
                        />

                        <div>
                          <h3>{item.name}</h3>

                          <p>
                            Qty: {item.quantity}
                          </p>

                          {selectedOptions.color && (
                            <p>
                              Color:{" "}
                              {selectedOptions.color}
                            </p>
                          )}

                          {coatings.length > 0 && (
                            <p>
                              Coating:{" "}
                              {coatings.join(", ")}
                            </p>
                          )}

                          {selectedOptions.lensPackage && (
                            <p>
                              {selectedOptions.lensPackage}
                            </p>
                          )}

                          <strong>
                            {formatPrice(itemTotal)}
                          </strong>
                        </div>
                      </div>

                      {visionMode &&
                        visionMode !== "Plano" &&
                        rx && (
                          <div className="checkout-prescription">
                            <div className="checkout-prescription-heading">
                              <strong>
                                Prescription Details
                              </strong>

                              <span>
                                {visionMode}
                              </span>
                            </div>

                            <table>
                              <thead>
                                <tr>
                                  <th>Eye</th>
                                  <th>SPH</th>
                                  <th>CYL</th>
                                  <th>AXIS</th>
                                </tr>
                              </thead>

                              <tbody>
                                <tr>
                                  <td>OD</td>
                                  <td>
                                    {rx.odSphere ||
                                      "0.00"}
                                  </td>
                                  <td>
                                    {rx.odCylinder ||
                                      "0.00"}
                                  </td>
                                  <td>
                                    {rx.odAxis || "0"}°
                                  </td>
                                </tr>

                                <tr>
                                  <td>OS</td>
                                  <td>
                                    {rx.osSphere ||
                                      "0.00"}
                                  </td>
                                  <td>
                                    {rx.osCylinder ||
                                      "0.00"}
                                  </td>
                                  <td>
                                    {rx.osAxis || "0"}°
                                  </td>
                                </tr>
                              </tbody>
                            </table>

                            {rx.pd && (
                              <div className="checkout-pd">
                                <strong>PD:</strong>{" "}
                                {rx.pd} mm
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>

              <div className="checkout-summary-lines">

                <div>
                  <span>
                    Subtotal ({totalItems}{" "}
                    {totalItems === 1
                      ? "item"
                      : "items"})
                  </span>

                  <strong>
                    {formatPrice(subtotal)}
                  </strong>
                </div>

                <div>
                  <span>Shipping</span>

                  <strong>
                    {isPickup
                      ? "Pickup (Free)"
                      : formatPrice(shippingCost)}
                  </strong>
                </div>

              </div>

              <div className="checkout-summary-total">
                <span>Total</span>

                <strong>
                  {formatPrice(total)}
                </strong>
              </div>

              <label className="checkout-confirmation">
                <input
                  type="checkbox"
                  checked={confirmCorrect}
                  onChange={(e) =>
                    setConfirmCorrect(
                      e.target.checked,
                    )
                  }
                />

                <span>
                  I confirm that all shipping/pickup
                  details and lens configurations
                  (including prescription values if
                  applicable) are correct. I understand
                  that custom prescription lenses are
                  tailored specifically to these
                  specifications.
                </span>
              </label>

              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={
                  saving || !isFormValid()
                }
                className="checkout-place-order"
              >
                {saving
                  ? "Processing..."
                  : "Place Order"}
              </button>

              {!isFormValid() && !saving && (
                <p className="checkout-order-hint">
                  Complete the required details, select
                  a payment method and confirm above to
                  place your order.
                </p>
              )}

              <Link
                to="/cart"
                className="checkout-back"
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