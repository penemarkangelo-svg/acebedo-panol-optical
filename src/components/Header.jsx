import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logoSvg from "../assets/logo.svg";

export default function Header() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
    setDropdownOpen(false);
  };

  // Get user's first name or fallback
  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.charAt(0).toUpperCase() ||
    "User";

  return (
    <header className="w-full bg-white px-8 py-4 shadow-xl border-b border-gray-200 flex items-center justify-between">
      {/* Logo + Brand Name */}
      <Link to="/" className="flex items-center gap-3">
        <img
          src={logoSvg}
          alt="Acebedo Panol Optical Logo"
          className="h-10 w-auto"
        />
        <div className="space-y-0">
          <span className="font-serif text-2xl font-bold tracking-widest text-[#D32F2F]">
            ACEBEDO
          </span>
          <div className="font-sans text-xs font-light tracking-[0.2em] text-[#212529]">
            PANOL OPTICAL
          </div>
        </div>
      </Link>

      {/* Navigation Links */}
      {!isAuthPage && (
        <nav className="hidden md:flex space-x-10 font-medium">
          {!user ? (
            // Logged out – show all links
            <>
              <Link
                to="/"
                className="text-[#212529] hover:text-[#D32F2F] transition-colors"
              >
                Home
              </Link>
              <Link
                to="/main"
                className="text-[#212529] hover:text-[#D32F2F] transition-colors"
              >
                Shop Frames
              </Link>
              <Link
                to="/vision-screening"
                className="text-[#212529] hover:text-[#D32F2F] transition-colors"
              >
                Vision Screening
              </Link>
              <Link
                to="/about"
                className="text-[#212529] hover:text-[#D32F2F] transition-colors"
              >
                About Us
              </Link>
            </>
          ) : (
            // Logged in – show only Shop and Vision Screening
            <>
              <Link
                to="/main"
                className="text-[#212529] hover:text-[#D32F2F] transition-colors"
              >
                Shop Frames
              </Link>
              <Link
                to="/vision-screening"
                className="text-[#212529] hover:text-[#D32F2F] transition-colors"
              >
                Vision Screening
              </Link>
            </>
          )}
        </nav>
      )}
      
      {/* User Actions */}
      <div className="flex items-center space-x-6">
        {/* Shopping Cart (always visible) */}
        {!isAuthPage && (
          <Link
            to="/cart"
            className="text-[#212529] hover:text-[#D32F2F] transition-colors relative"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
              />
            </svg>
            <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-[#D32F2F] text-[8px] text-white">
              2
            </span>
          </Link>
        )}

        {user ? (
          // Logged in: user dropdown
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-2 focus:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-[#D32F2F] flex items-center justify-center text-white font-semibold">
                {user.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <span className="text-sm font-medium text-[#212529] hidden md:inline">
                {firstName}
              </span>
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">
                    {user.user_metadata?.full_name || "User"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <div className="py-1">
                  <Link
                    to="/account"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setDropdownOpen(false)}
                  >
                    My Profile
                  </Link>
                  <Link
                    to="/account?tab=prescriptions"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setDropdownOpen(false)}
                  >
                    My Prescriptions
                  </Link>
                  <Link
                    to="/account?tab=orders"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Order History
                  </Link>
                  <Link
                    to="/account?tab=settings"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Settings
                  </Link>
                  <hr className="my-1" />
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                  >
                    Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Logged out: show Log In and Sign Up buttons
          <>
            <Link
              to="/login"
              className="text-[#212529] font-medium hover:text-[#D32F2F] transition-colors"
            >
              Log In
            </Link>
            <Link
              to="/register"
              className="bg-[#D32F2F] text-white px-6 py-2 rounded-full font-medium hover:bg-[#B71C1C] shadow-md transition-all"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
