import { useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Header from "../components/Header";
import Footer from "../components/Footer";
import registerImage from "../assets/image3.jpg";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      alert(error.message);
    } else {
      alert(
        "Verification email sent! Please check your inbox and confirm your email, then log in.",
      );
      navigate("/login");
    }
  };
  return (
    <>
      <Header />
      <main className="bg-white min-h-[calc(100vh-200px)] flex items-center justify-center px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center shadow-xl rounded-2xl overflow-hidden bg-[#F8F9FA] border border-gray-200">
          {/* Left side: Image */}
          <div className="hidden md:block h-full">
            <img
              src={registerImage}
              alt="Acebedo Panol Optical"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Right side: Registration Form */}
          <div className="px-8 py-12 md:px-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-[#212529]">
                Create your account
              </h2>
              <p className="text-[#212529]/70 mt-2">
                Join Acebedo Panol Optical today
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-[#212529] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D32F2F] focus:border-[#D32F2F] outline-none transition"
                  placeholder="Juan dela Cruz"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-[#212529] mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D32F2F] focus:border-[#D32F2F] outline-none transition"
                  placeholder="you@example.com"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-[#212529] mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D32F2F] focus:border-[#D32F2F] outline-none transition"
                  placeholder="Create a strong password"
                  required
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-[#212529] mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D32F2F] focus:border-[#D32F2F] outline-none transition"
                  placeholder="Repeat your password"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#D32F2F] text-white py-2 rounded-lg font-semibold hover:bg-[#B71C1C] transition shadow-md"
              >
                Create Account
              </button>
            </form>

            <p className="text-xs text-[#212529]/50 text-center mt-6">
              By signing up, you agree to our{" "}
              <a
                href="#"
                className="text-[#D32F2F] hover:text-[#B71C1C] hover:underline"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="#"
                className="text-[#D32F2F] hover:text-[#B71C1C] hover:underline"
              >
                Privacy Policy
              </a>
              .
            </p>

            <p className="text-center text-sm text-[#212529]/70 mt-6">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-[#D32F2F] font-semibold hover:text-[#B71C1C] hover:underline"
              >
                Log In
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
