// 1. Import your UI components (Notice the ../ because we have to go up one folder)

import Header from "../components/Header";
import Hero from "../components/Hero";
import Footer from "../components/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* We stack our LEGO blocks here! */}
      <Header />
      <Hero />
      <Footer />

      {/* This is where the Footer will go later */}
    </div>
  );
}
