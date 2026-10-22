import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiTrash2 } from "react-icons/fi";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useCart } from "../context/CartContext";
import "../styles/cart.css";

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

        <main className="cart-page">
          <div className="cart-empty">
            <p className="cart-eyebrow">SHOPPING BAG</p>

            <h1 className="cart-empty__title">Your cart is empty</h1>

            <p className="cart-empty__text">
              Looks like you haven't added any products to your cart yet.
            </p>

            <Link to="/shop" className="cart-button cart-button--primary">
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

      <main className="cart-page">
        <div className="cart-container">
          {/* PAGE HEADER */}
          <div className="cart-page-header">
            <div>
              <p className="cart-eyebrow">SHOPPING BAG</p>

              <h1 className="cart-page-title">Your Cart</h1>
            </div>

            <p className="cart-item-count">
              {cartItems.length}{" "}
              {cartItems.length === 1 ? "item" : "items"}
            </p>
          </div>

          {/* CART HEADER */}
          <div className="cart-table-header">
            <div className="cart-table-header__product">PRODUCT</div>
            <div className="cart-table-header__price">PRICE</div>
            <div className="cart-table-header__quantity">QTY</div>
            <div className="cart-table-header__total">TOTAL</div>
            <div />
          </div>

          {/* CART ITEMS */}
          <div className="cart-items">
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

              const extraLines = [];

              if (selectedOptions.color) {
                extraLines.push(`Color: ${selectedOptions.color}`);
              }

              if (lensPackage) {
                extraLines.push(`Lens Package: ${lensPackage}`);
              }

              if (coatings.length) {
                extraLines.push(`Coating: ${coatings.join(", ")}`);
              }

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
                <article className="cart-item" key={`${item.id}-${idx}`}>
                  {/* PRODUCT */}
                  <div className="cart-product">
                    <div className="cart-product__image-wrap">
                      <img
                        src={item.image || "https://placehold.co/100x100"}
                        alt={item.name}
                        className="cart-product__image"
                      />
                    </div>

                    <div className="cart-product__details">
                      <h2 className="cart-product__name">{item.name}</h2>

                      {!isAccessory && (
                        <p className="cart-product__meta">
                          {item.brand || "No brand"}
                          <span>·</span>
                          {item.shape || "N/A"}
                          <span>·</span>
                          {item.material || "N/A"}
                        </p>
                      )}

                      {isAccessory && (
                        <p className="cart-product__meta">Accessory</p>
                      )}

                      {extraLines.length > 0 && (
                        <div className="cart-product__options">
                          {extraLines.map((line, i) => (
                            <div key={i}>{line}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PRICE */}
                  <div className="cart-product-price">
                    <span className="cart-mobile-label">PRICE</span>

                    <div className="cart-price-main">
                      {formatPrice(item.price)}
                    </div>

                    <div className="cart-price-unit">per piece</div>

                    {lensExtra > 0 && !isAccessory && (
                      <div className="cart-price-breakdown">
                        <div>
                          Frame Price: {formatPrice(baseFramePrice)}
                        </div>

                        <div>
                          Lens Package: {formatPrice(lensExtra)}
                        </div>

                        <strong>
                          Item Total: {formatPrice(item.price)}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* QUANTITY */}
                  <div className="cart-product-quantity">
                    <span className="cart-mobile-label">QTY</span>

                    <div className="cart-quantity">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(idx, -1)}
                        disabled={isSyncing}
                        aria-label={`Decrease quantity of ${item.name}`}
                        className="cart-quantity__button"
                      >
                        −
                      </button>

                      <span className="cart-quantity__value">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleQuantityChange(idx, 1)}
                        disabled={isSyncing}
                        aria-label={`Increase quantity of ${item.name}`}
                        className="cart-quantity__button"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* TOTAL */}
                  <div className="cart-product-total">
                    <span className="cart-mobile-label">TOTAL</span>
                    <strong>{formatPrice(itemTotal)}</strong>
                  </div>

                  {/* REMOVE */}
                  <div className="cart-product-remove">
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      disabled={isSyncing}
                      aria-label={`Remove ${item.name} from cart`}
                      className="cart-remove-button"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* SHIPPING + SUMMARY */}
          <section className="cart-summary">
            <div className="cart-summary__shipping">
              <p className="cart-section-label">FULFILLMENT</p>

              <h2 className="cart-summary__title">
                Choose how you'd like to receive your order
              </h2>

              <div className="cart-shipping-options">
                {/* PICKUP */}
                <label
                  className={`cart-shipping-option ${
                    shippingMethod === "pickup"
                      ? "cart-shipping-option--selected"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="shipping"
                    value="pickup"
                    checked={shippingMethod === "pickup"}
                    onChange={() => setShippingMethod("pickup")}
                  />

                  <span className="cart-shipping-option__radio" />

                  <span className="cart-shipping-option__content">
                    <span className="cart-shipping-option__title">
                      Store pickup
                    </span>

                    <span className="cart-shipping-option__description">
                      Ready in 2–3 days
                    </span>
                  </span>

                  <span className="cart-shipping-option__price cart-shipping-option__price--free">
                    FREE
                  </span>
                </label>

                {/* DELIVERY */}
                <label
                  className={`cart-shipping-option ${
                    shippingMethod === "delivery"
                      ? "cart-shipping-option--selected"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="shipping"
                    value="delivery"
                    checked={shippingMethod === "delivery"}
                    onChange={() => setShippingMethod("delivery")}
                  />

                  <span className="cart-shipping-option__radio" />

                  <span className="cart-shipping-option__content">
                    <span className="cart-shipping-option__title">
                      Delivery
                    </span>

                    <span className="cart-shipping-option__description">
                      3–5 business days
                    </span>
                  </span>

                  <span className="cart-shipping-option__price">
                    ₱99.00
                  </span>
                </label>
              </div>
            </div>

            {/* ORDER TOTAL */}
            <aside className="cart-order-summary">
              <p className="cart-section-label">ORDER SUMMARY</p>

              <div className="cart-order-summary__rows">
                <div className="cart-summary-row">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>

                <div className="cart-summary-row">
                  <span>Shipping</span>

                  <span>
                    {shippingMethod === "pickup"
                      ? "Free"
                      : formatPrice(shippingCost)}
                  </span>
                </div>

                <div className="cart-summary-total">
                  <span>Total</span>
                  <strong>{formatPrice(total)}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={isSyncing}
                className="cart-button cart-button--checkout"
              >
                {isSyncing
                  ? "Saving Changes..."
                  : `Checkout ${formatPrice(total)}`}
              </button>

              <Link to="/shop" className="cart-continue-shopping">
                Continue Shopping
              </Link>
            </aside>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}