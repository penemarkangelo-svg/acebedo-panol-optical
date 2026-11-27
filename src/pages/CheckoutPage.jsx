import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FileText, Upload, X } from "lucide-react";
import qrPhLogo from "../assets/qr-ph-logo.svg";
import gcashLogo from "../assets/gcash-logo.svg";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";
import Header from "../components/Header";
import Footer from "../components/Footer";
import PrescriptionUploadModal from "../components/PrescriptionUploadGuide";
import { getAppointmentReference } from "../appointments/appointmentUtils";
import "../styles/checkout.css";

const PAYMENT_RETURN_KEY = "apo-payment-return";

function readPaymentReturn(userId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PAYMENT_RETURN_KEY) || "null");
    return saved?.userId === userId && Array.isArray(saved.items) ? saved : null;
  } catch {
    return null;
  }
}

async function attachPrescription({ file, id, extension }, userId, orderId) {
  const storagePath = `${userId}/orders/${orderId}/${id}.${extension}`;
  const { data: existing, error: lookupError } = await supabase
    .from("order_prescription_uploads")
    .select("id")
    .eq("order_id", orderId)
    .eq("uploaded_by", userId)
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return;

  const { error: uploadError } = await supabase.storage
    .from("prescription-uploads")
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  // A retry can find the same file already stored after a failed metadata write.
  if (uploadError && !["Duplicate", "KeyAlreadyExists", "409"].includes(uploadError.statusCode)) {
    throw uploadError;
  }

  const { error: insertError } = await supabase.from("order_prescription_uploads").insert({
    order_id: orderId,
    uploaded_by: userId,
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: file.type,
  });
  if (insertError) throw insertError;
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cartItems, clearCart, cartId, isSyncing } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  const savedPayment = user?.id && cartItems.length === 0 ? readPaymentReturn(user.id) : null;
  const { shippingMethod = "pickup", shippingCost = 0 } =
    savedPayment || location.state || {};

  const isPickup = shippingMethod === "pickup";

  const [contactName, setContactName] = useState(
    savedPayment?.contactName || user?.user_metadata?.full_name || "",
  );
  const [contactEmail, setContactEmail] = useState(savedPayment?.contactEmail || user?.email || "");
  const [phone, setPhone] = useState(savedPayment?.phone || "");

  const [address, setAddress] = useState(savedPayment?.address || "");
  const [barangay, setBarangay] = useState(savedPayment?.barangay || "");
  const [city, setCity] = useState(savedPayment?.city || "");
  const [province, setProvince] = useState(savedPayment?.province || "");
  const [zip, setZip] = useState(savedPayment?.zip || "");

  const [confirmCorrect, setConfirmCorrect] = useState(Boolean(savedPayment));
  const [saving, setSaving] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(savedPayment ? "qrph" : "");
  const [touched, setTouched] = useState({});
  const [prescription, setPrescription] = useState(null);
  const [prescriptionError, setPrescriptionError] = useState("");
  const [clinicVisits, setClinicVisits] = useState(null);
  const [selectedVisitId, setSelectedVisitId] = useState(null);
  const prescriptionButton = useRef(null);
  const prescriptionDialog = useRef(null);
  const restoredOrder = useRef(null);

  useEffect(() => {
    if (!savedPayment || restoredOrder.current === savedPayment.orderId) return;
    restoredOrder.current = savedPayment.orderId;
    setContactName(savedPayment.contactName || "");
    setContactEmail(savedPayment.contactEmail || "");
    setPhone(savedPayment.phone || "");
    setAddress(savedPayment.address || "");
    setBarangay(savedPayment.barangay || "");
    setCity(savedPayment.city || "");
    setProvince(savedPayment.province || "");
    setZip(savedPayment.zip || "");
    setConfirmCorrect(true);
    setSelectedPaymentMethod("qrph");
  }, [savedPayment]);

  useEffect(() => {
    if (!contactEmail && user?.email) setContactEmail(user.email);
  }, [contactEmail, user?.email]);

  const handleBlur = (field) => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  const isFormValid = () => {
    if (!contactName.trim()) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) return false;
    if (!phone.trim()) return false;
    if (!confirmCorrect) return false;
    if (selectedPaymentMethod !== "qrph") return false;

    if (!isPickup) {
      if (!address.trim()) return false;
      if (!barangay.trim()) return false;
      if (!city.trim()) return false;
      if (!province.trim()) return false;
      if (!zip.trim()) return false;
    }

    return true;
  };

  const selectedItems = savedPayment?.items || cartItems;
  const requiresPrescription = !savedPayment && selectedItems.some(({ selectedOptions }) => (
    selectedOptions?.visionMode === "Prescription Lens"
    || (selectedOptions?.lensType && (selectedOptions.lensType !== "sv" || selectedOptions.visionMode !== "Plano"))
  ));
  const selectedPrescription = prescription?.userId === user?.id ? prescription : null;
  const visitOptions = clinicVisits?.userId === user?.id ? clinicVisits : null;
  const visits = visitOptions?.visits || [];
  const clinicVisit = visits.find((visit) => visit.id === selectedVisitId)
    || (visits.length === 1 ? visits[0] : null);

  useEffect(() => {
    const userId = user?.id;
    if (!requiresPrescription || !userId) return;
    let active = true;
    const loadVisits = async () => {
      const { data, error } = await supabase.rpc("customer_visit_checkouts");
      if (active) setClinicVisits({
        userId,
        visits: data || [],
        legacy: error?.code === "PGRST202",
        error: Boolean(error && error.code !== "PGRST202"),
      });
    };
    loadVisits();
    window.addEventListener("focus", loadVisits);
    return () => { active = false; window.removeEventListener("focus", loadVisits); };
  }, [requiresPrescription, user?.id]);

  function confirmPrescription({ file, extension, fileId }) {
    setPrescription({ file, extension, id: fileId, userId: user?.id });
    setPrescriptionError("");
  }

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
    if (savedPayment) {
      navigate(`/order-status/${savedPayment.orderId}?payment=interrupted`);
      return;
    }
    if (!isFormValid()) {
      toast.error(
        "Please fill in all required fields, choose QR Ph, and confirm the details.",
      );

      setTouched({
        contactName: true,
        contactEmail: true,
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

    if (!user || !cartId) {
      toast.error("Sign in and wait for your cart to finish syncing before checkout.");
      if (!user) navigate("/login");
      return;
    }
    if (isSyncing) {
      toast.error("Your cart is still syncing. Please try again in a moment.");
      return;
    }
    if (requiresPrescription && (!visitOptions || visitOptions.error)) {
      toast.error("Unable to check prescription options. Refresh checkout and try again.");
      return;
    }
    if (requiresPrescription && visits.length > 0 && !clinicVisit) {
      toast.error("Choose the clinic visit to use for this order.");
      return;
    }
    if (requiresPrescription && !clinicVisit && !selectedPrescription) {
      prescriptionDialog.current?.showModal();
      return;
    }

    setSaving(true);
    setPrescriptionError("");

    try {
      const deliveryAddress = isPickup
        ? null
        : `${address}, ${barangay}, ${city}, ${province} ${zip}`;
      const idempotencyStorageKey = `apo-checkout:${cartId}`;
      let idempotencyKey = sessionStorage.getItem(idempotencyStorageKey);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        sessionStorage.setItem(idempotencyStorageKey, idempotencyKey);
      }

      let prescriptionPath;
      if (requiresPrescription && !clinicVisit && !visitOptions?.legacy && selectedPrescription) {
        const { file, id, extension } = selectedPrescription;
        prescriptionPath = `${user.id}/checkout/${idempotencyKey}/${id}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("prescription-uploads")
          .upload(prescriptionPath, await file.arrayBuffer(), { contentType: file.type, cacheControl: "0", upsert: false });
        if (uploadError && !["Duplicate", "KeyAlreadyExists", "409"].includes(uploadError.statusCode)) {
          setPrescriptionError("Your prescription could not be uploaded. Try again before continuing to payment.");
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke("create-paymongo-checkout", {
        body: {
          cartId,
          idempotencyKey,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactNumber: phone.trim(),
          fulfillmentMethod: shippingMethod,
          deliveryAddress,
          clinicAppointmentId: requiresPrescription ? clinicVisit?.id : undefined,
          prescriptionPath,
          prescriptionFilename: prescriptionPath ? selectedPrescription.file.name : undefined,
        },
      });

      const responseBody = typeof error?.context?.clone === "function"
        ? await error.context.clone().json().catch(() => null)
        : null;
      const recoverableOrder = responseBody?.canResumeOrder && responseBody?.orderId;
      const orderId = data?.orderId || recoverableOrder;

      if (requiresPrescription && visitOptions?.legacy && selectedPrescription && orderId) {
        try {
          await attachPrescription(selectedPrescription, user.id, orderId);
        } catch {
          setPrescriptionError("Your order was saved, but the prescription could not be attached. Try continuing again.");
          return;
        }
      }

      if (recoverableOrder) {
        navigate(`/order-status/${recoverableOrder}?payment=setup-failed`, {
          replace: true,
          state: { checkoutError: responseBody.error },
        });
        return;
      }
      if (error) throw new Error(responseBody?.error || error.message);
      if (data?.alreadyPaid && data?.orderId) {
        navigate(`/order-status/${data.orderId}`);
        return;
      }
      if (!data?.checkoutUrl?.startsWith("https://checkout.paymongo.com/")) {
        throw new Error(data?.error || "PayMongo did not return a valid QR Ph payment link.");
      }

      sessionStorage.setItem(PAYMENT_RETURN_KEY, JSON.stringify({
        userId: user.id, orderId: data.orderId, items: selectedItems,
        shippingMethod, shippingCost, contactName, contactEmail, phone,
        address, barangay, city, province, zip,
      }));
      sessionStorage.removeItem(idempotencyStorageKey);
      await clearCart().catch((cartError) => {
        console.error("The order was created, but the local cart could not be cleared.", cartError);
      });
      window.location.assign(data.checkoutUrl);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Could not start QR Ph checkout. Please try again.");
    } finally {
      setSaving(false);
    }
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

                <div className="checkout-fields">
                  <div className="checkout-field checkout-field-full">
                    <label htmlFor="contact-email">
                      Contact Email
                      <span>*</span>
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      autoComplete="email"
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      onBlur={() => handleBlur("contactEmail")}
                      className={
                        touched.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())
                          ? "checkout-input checkout-input-error"
                          : "checkout-input"
                      }
                    />
                    {touched.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim()) && (
                      <p className="checkout-error">Enter a valid email address for your order.</p>
                    )}
                  </div>
                </div>
              </section>

              {/* PAYMENT */}
              <section className="checkout-payment-section">
                <h2>Payment Method</h2>

                <div className="checkout-payment-options">
                  <button
                    type="button"
                    aria-pressed={selectedPaymentMethod === "qrph"}
                    onClick={() => setSelectedPaymentMethod("qrph")}
                    disabled={saving}
                    className={`checkout-payment-option${selectedPaymentMethod === "qrph" ? " is-selected" : ""}`}
                  >
                    <div className="checkout-payment-main">
                      <span className="checkout-payment-logo checkout-payment-logo--qrph">
                        <img src={qrPhLogo} alt="QR Ph" />
                      </span>
                    </div>
                    <span className="checkout-radio" aria-hidden="true"><span /></span>
                  </button>
                  <button
                    type="button"
                    className="checkout-payment-option checkout-payment-option--disabled"
                    disabled
                    aria-label="GCash is currently unavailable"
                  >
                    <div className="checkout-payment-main">
                      <span className="checkout-payment-logo">
                        <img src={gcashLogo} alt="" aria-hidden="true" />
                      </span>
                    </div>
                    <span className="checkout-payment-unavailable">Unavailable</span>
                  </button>
                </div>
                <p className="checkout-payment-note">Pay with QR Ph using a supported bank or e-wallet app. GCash is currently unavailable.</p>
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

              {requiresPrescription && visits.length > 0 && (
                <div className="checkout-prescription-upload">
                  <div className="checkout-prescription-file">
                    <FileText size={16} aria-hidden="true" />
                    <span><strong>Eye exam completed at Acebedo</strong>{clinicVisit && ` · ${getAppointmentReference(clinicVisit)}`}</span>
                  </div>
                  {visits.length > 1 && (
                    <label>
                      Clinic visit{" "}
                      <select value={clinicVisit?.id || ""} onChange={(event) => setSelectedVisitId(Number(event.target.value) || null)} disabled={saving}>
                        <option value="">Choose a completed visit</option>
                        {visits.map((visit) => <option key={visit.id} value={visit.id}>{getAppointmentReference(visit)}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              )}
              {requiresPrescription && !visitOptions && <p role="status">Checking prescription options.</p>}
              {requiresPrescription && visitOptions?.error && <p className="checkout-error" role="alert">Prescription options could not be checked. Refresh checkout to try again.</p>}
              {requiresPrescription && visitOptions && !visitOptions.error && visits.length === 0 && (
                <div className="checkout-prescription-upload">
                  <button
                    ref={prescriptionButton}
                    type="button"
                    className="checkout-prescription-upload-button"
                    aria-labelledby="checkout-prescription-upload-label"
                    aria-describedby="checkout-prescription-file-hint"
                    aria-haspopup="dialog"
                    onClick={() => prescriptionDialog.current?.showModal()}
                    disabled={saving}
                  >
                    <span className="checkout-prescription-upload-icon">
                      <Upload size={18} aria-hidden="true" />
                    </span>
                    <span>
                      <strong id="checkout-prescription-upload-label">
                        {selectedPrescription ? "Replace prescription" : "Upload prescription"}
                      </strong>
                      <small id="checkout-prescription-file-hint">Required · PDF, JPG or PNG up to 5 MB</small>
                    </span>
                  </button>
                  {selectedPrescription && (
                    <div className="checkout-prescription-file">
                      <FileText size={16} aria-hidden="true" />
                      <span role="status">{selectedPrescription.file.name}</span>
                      <button
                        type="button"
                        aria-label="Remove prescription file"
                        onClick={() => {
                          setPrescription(null);
                          setPrescriptionError("");
                          prescriptionButton.current?.focus();
                        }}
                        disabled={saving}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  {prescriptionError && <p className="checkout-error" role="alert">{prescriptionError}</p>}
                  <PrescriptionUploadModal
                    dialogRef={prescriptionDialog}
                    title={selectedPrescription ? "Replace your prescription" : "Upload your prescription"}
                    confirmLabel="Attach and continue"
                    onConfirm={confirmPrescription}
                  />
                </div>
              )}

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
                  saving || (!savedPayment && (isSyncing || !isFormValid()))
                }
                className="checkout-place-order"
              >
                {saving
                  ? "Opening QR Ph checkout..."
                  : savedPayment ? "View payment status" : "Continue to QR Ph"}
              </button>

              {savedPayment && <p className="checkout-order-hint">Your order is saved. You can resume QR Ph from the order page while the payment window is open.</p>}
              {!savedPayment && !isFormValid() && !saving && (
                <p className="checkout-order-hint">
                  Complete the required contact and fulfillment details, select QR Ph, then confirm above to continue.
                </p>
              )}

              <Link
                to="/cart"
                className="checkout-back"
                onClick={() => sessionStorage.removeItem(PAYMENT_RETURN_KEY)}
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
