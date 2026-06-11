import React from "react";
import { FaFacebookF, FaInstagram, FaTwitter } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="w-full bg-white border-t border-gray-100 font-sans">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 py-16">
        {/* Brand statement */}
        <div className="mb-16 max-w-md">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
            Brand Statement
          </p>
          <p className="text-gray-500 text-sm leading-relaxed">
            Professional optical care and digital vision screening. Your sight
            is our priority.
          </p>
        </div>

        {/* Links grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-16 border-b border-gray-100">
          {/* Navigation */}
          <div>
            <h3 className="text-gray-900 font-semibold text-sm uppercase tracking-wider mb-4">
              Navigation
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="/"
                  className="text-gray-500 hover:text-[#D32F2F] transition"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="/shop"
                  className="text-gray-500 hover:text-[#D32F2F] transition"
                >
                  Shop Frames
                </a>
              </li>
              <li>
                <a
                  href="/vision-test"
                  className="text-gray-500 hover:text-[#D32F2F] transition"
                >
                  Vision Test
                </a>
              </li>
              <li>
                <a
                  href="/cart"
                  className="text-gray-500 hover:text-[#D32F2F] transition"
                >
                  Cart
                </a>
              </li>
              <li>
                <a
                  href="/profile"
                  className="text-gray-500 hover:text-[#D32F2F] transition"
                >
                  My Profile
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-gray-900 font-semibold text-sm uppercase tracking-wider mb-4">
              Support
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="/contact"
                  className="text-gray-500 hover:text-[#D32F2F] transition"
                >
                  Contact Us
                </a>
              </li>
              <li>
                <a
                  href="/faqs"
                  className="text-gray-500 hover:text-[#D32F2F] transition"
                >
                  FAQs
                </a>
              </li>
              <li>
                <a
                  href="/shipping-returns"
                  className="text-gray-500 hover:text-[#D32F2F] transition"
                >
                  Shipping & Returns
                </a>
              </li>
              <li>
                <a
                  href="/frame-fit-guide"
                  className="text-gray-500 hover:text-[#D32F2F] transition"
                >
                  Frame Fit Guide
                </a>
              </li>
              <li>
                <a
                  href="/prescription-guide"
                  className="text-gray-500 hover:text-[#D32F2F] transition"
                >
                  Prescription Guide
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-gray-900 font-semibold text-sm uppercase tracking-wider mb-4">
              Legal
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="/privacy"
                  className="text-gray-500 hover:text-[#D32F2F] transition"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  className="text-gray-500 hover:text-[#D32F2F] transition"
                >
                  Terms of Service
                </a>
              </li>
              <li>
                <a
                  href="/accessibility"
                  className="text-gray-500 hover:text-[#D32F2F] transition"
                >
                  Accessibility
                </a>
              </li>
              <li>
                <a
                  href="/medical-disclaimer"
                  className="text-gray-500 hover:text-[#D32F2F] transition"
                >
                  Medical Disclaimer
                </a>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-gray-900 font-semibold text-sm uppercase tracking-wider mb-4">
              Connect
            </h3>
            <div className="flex space-x-4 mb-4">
              <a
                href="#"
                className="text-gray-500 hover:text-[#D32F2F] transition"
              >
                <FaFacebookF size={18} />
              </a>
              <a
                href="#"
                className="text-gray-500 hover:text-[#D32F2F] transition"
              >
                <FaInstagram size={18} />
              </a>
              <a
                href="#"
                className="text-gray-500 hover:text-[#D32F2F] transition"
              >
                <FaTwitter size={18} />
              </a>
            </div>
            <p className="text-xs text-gray-400">
              📍 123 Rosario, Cavite
              <br />
              📧 info@acebedopanol.com
            </p>
          </div>
        </div>

        {/* Massive brand text - solid color, adjusted size */}
        <div className="w-full pt-12 select-none">
          <h1 className="text-[#D32F2F] text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold tracking-tighter leading-none text-center uppercase">
            acebedo
          </h1>
        </div>

        {/* Copyright */}
        <div className="mt-8 text-center text-xs text-gray-400">
          © 2026 ACEBEDO PANOL OPTICAL. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
