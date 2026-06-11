import heroImage from "../assets/image.jpg";
import { Link } from "react-router-dom";

export default function Hero() {
  // <--- UPDATE THIS URL --->
  const facebookUrl = "https://web.facebook.com/profile.php?id=61561751544939";

  return (
    <section className="bg-white flex items-start px-6 md:px-12 lg:px-20 pt-16 pb-20">
      <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center">
        {/* Left: Text Content */}
        <div className="text-left">
          <p className="text-[#D32F2F] font-semibold text-sm uppercase tracking-wider mb-3">
            See the World Clearly
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#212529] leading-tight mb-5">
            Discover Your{" "}
            <span className="text-[#D32F2F] relative inline-block">
              Perfect Vision
              {/* Subtle red wave underline */}
              <svg
                className="absolute -bottom-2 left-0 w-full h-2 text-[#D32F2F]/30"
                viewBox="0 0 200 8"
                fill="currentColor"
              >
                <path
                  d="M0,4 Q25,0 50,4 T100,4 T150,4 T200,4"
                  stroke="currentColor"
                  fill="none"
                  strokeWidth="2"
                />
              </svg>
            </span>
          </h1>
          <p className="text-gray-600 text-lg max-w-lg leading-relaxed mb-8">
            Premium eyewear crafted with precision. Expert eye care tailored to
            your needs.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/shop">
              <button className="bg-[#D32F2F] text-white px-8 py-3 rounded-full font-semibold hover:bg-[#B71C1C] transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5">
                Explore Collection
              </button>
            </Link>
            {/* "Visit Store" Button now links to Facebook */}
            <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
              <button className="border border-gray-300 text-gray-700 px-8 py-3 rounded-full font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-300">
                Visit Store
              </button>
            </a>
          </div>
        </div>

        {/* Right: Hero Image with a subtle hover effect */}
        <div className="mt-8 md:mt-0 flex justify-center">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#D32F2F]/10 to-transparent rounded-2xl blur-xl opacity-70"></div>
            <img
              src={heroImage}
              alt="Stylish glasses"
              className="relative w-full max-w-md md:max-w-full h-auto rounded-2xl shadow-2xl transform transition duration-500 hover:scale-[1.02]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
