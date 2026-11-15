import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import "../styles/SystemHeader.css";

export default function Header() {
  const { totalItems } = useCart();
  const { user } = useAuth();
  const location = useLocation();
  const [guestMenuOpen, setGuestMenuOpen] = useState(false);
  const guestMenuRef = useRef(null);
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (guestMenuRef.current && !guestMenuRef.current.contains(event.target)) setGuestMenuOpen(false);
    };
    const closeOnEscape = (event) => { if (event.key === "Escape") setGuestMenuOpen(false); };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const navLink = (to, label, active) => (
    <Link to={to} className={`system-header__link${active ? " is-active" : ""}`} key={label}>{label}</Link>
  );

  return (
    <header className="system-header">
      <Link to="/" className="system-header__brand" aria-label="Acebedo Panol Optical home">
        <span>ACEBEDO</span><small>PANOL OPTICAL</small>
      </Link>
      {!isAuthPage && <nav className="system-header__nav" aria-label="Main navigation">
        {!user && navLink("/", "Home", location.pathname === "/")}
        {navLink("/shop", "Shop Frames", location.pathname.startsWith("/shop"))}
        {navLink("/vision-screening", "Vision Screening", location.pathname.startsWith("/vision-screening"))}
        {navLink("/appointments/book", "Appointments", location.pathname.startsWith("/appointments"))}
        {!user && navLink("/about", "About Us", location.pathname.startsWith("/about"))}
      </nav>}
      <div className="system-header__actions">
        {!isAuthPage && <>
          <Link className={`system-header__cart${location.pathname === "/cart" ? " is-active" : ""}`} to="/cart" aria-label={`Shopping cart, ${totalItems} items`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3h2l2.2 12.2a2 2 0 0 0 2 1.7h8.5a2 2 0 0 0 1.9-1.4L22 8H6"/><circle cx="10" cy="21" r="1"/><circle cx="18" cy="21" r="1"/></svg>
            {totalItems > 0 && <span>{totalItems}</span>}
          </Link>
          {user ? <Link className={`system-header__account-button${location.pathname.startsWith("/account") ? " is-active" : ""}`} to="/account" aria-label="My Account">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20v-1.5a6.5 6.5 0 0 1 13 0V20"/></svg>
          </Link> : <div className="system-header__guest" ref={guestMenuRef}>
            <button className="system-header__account-button" aria-label="Open account options" aria-expanded={guestMenuOpen} onClick={() => setGuestMenuOpen((open) => !open)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20v-1.5a6.5 6.5 0 0 1 13 0V20"/></svg>
            </button>
            {guestMenuOpen && <div className="system-header__guest-menu">
              <Link to="/login" onClick={() => setGuestMenuOpen(false)}>Log In</Link>
              <Link to="/register" onClick={() => setGuestMenuOpen(false)}>Create an Account</Link>
            </div>}
          </div>}
        </>}
      </div>
    </header>
  );
}
