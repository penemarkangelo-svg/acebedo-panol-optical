import {
  FaFacebook,
  FaInstagram,
  FaTwitter,
  FaYoutube,
  FaLinkedin,
} from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 border-t border-gray-800 mt-20">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Column 1: Brand + Contact */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              {/* Optional small logo icon – you can add an SVG here */}
              <div>
                <span className="font-serif text-2xl font-bold tracking-widest text-white">
                  ACEBEDO
                </span>
                <div className="font-sans text-xs font-light tracking-[0.2em] text-gray-500">
                  PANOL OPTICAL
                </div>
              </div>
            </div>
            <p className="text-sm mb-4 max-w-md">
              Professional optical care and digital vision screening. Your sight
              is our priority.
            </p>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">📧 info@acebedopanol.com</p>
              <p className="flex items-center gap-2">📞 +1 (800) 555-0200</p>
              <p className="flex items-center gap-2"> 📍 123 Rosario, Cavite</p>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">QUICK LINKS</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-[#C72C41] transition">
                  Home
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#C72C41] transition">
                  Shop Frames
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#C72C41] transition">
                  Vision Test
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#C72C41] transition">
                  Cart
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#C72C41] transition">
                  My Profile
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Support */}
          <div>
            <h3 className="text-white font-semibold mb-4">SUPPORT</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-[#C72C41] transition">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#C72C41] transition">
                  FAQs
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#C72C41] transition">
                  Shipping & Returns
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#C72C41] transition">
                  Frame Fit Guide
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#C72C41] transition">
                  Prescription Guide
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4">LEGAL</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-[#C72C41] transition">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#C72C41] transition">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#C72C41] transition">
                  Accessibility
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#C72C41] transition">
                  Medical Disclaimer
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar: Social + Eye motif + Copyright */}
        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center text-sm">
          <div className="flex space-x-4 mb-4 md:mb-0">
            <a href="#" className="hover:text-[#C72C41] transition">
              <FaFacebook className="w-5 h-5" />
            </a>
            <a href="#" className="hover:text-[#C72C41] transition">
              <FaInstagram className="w-5 h-5" />
            </a>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <span>© 2026 ACEBEDO PANOL OPTICAL. All rights reserved.</span>
            {/* Eye motif – simple SVG */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-gray-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"
              />
            </svg>
          </div>
        </div>
      </div>
    </footer>
  );
}
