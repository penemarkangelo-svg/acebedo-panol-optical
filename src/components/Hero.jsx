import heroImage from "../assets/image.jpg";

export default function Hero() {
  return (
    <section className="bg-white flex items-start px-6 md:px-12 lg:px-20 pt-16">
      <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center">
        {/* Left: Text Content */}
        <div className="text-left">
          <p className="text-[#D32F2F] font-semibold text-sm uppercase tracking-wider mb-2">
            See the World Clearly
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#212529] leading-tight mb-4">
            Discover Your <span className="text-[#D32F2F]">Perfect Vision</span>
          </h1>
          <p className="text-[#212529]/70 text-lg mb-8 max-w-lg">
            Premium eyewear crafted with precision. Expert eye care tailored to
            your needs.
          </p>
          <div className="flex flex-wrap gap-4">
            <button className="bg-[#D32F2F] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#B71C1C] transition shadow-md">
              Explore Collection
            </button>
            <button className="border border-gray-300 text-[#212529] px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition">
              Visit Store
            </button>
          </div>
        </div>

        {/* Right: Hero Image */}
        <div className="mt-8 md:mt-0">
          <img
            src={heroImage}
            alt="Stylish glasses"
            className="w-full h-auto rounded-2xl shadow-xl"
          />
        </div>
      </div>
    </section>
  );
}
