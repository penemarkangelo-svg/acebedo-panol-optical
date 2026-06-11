import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";
import { FiEye, FiEyeOff } from "react-icons/fi";
import Header from "../components/Header";
import Footer from "../components/Footer";
import loginImage from "../assets/bg.png";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});
  const navigate = useNavigate();

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setTouched({ email: true, password: true });
      toast.error("Please fill in all fields.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (error) {
      toast.error("Invalid email or password.");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (roleData?.role === "admin") {
      toast.success("Welcome back, Admin!");
      navigate("/admin");
    } else {
      toast.success("Logged in successfully!");
      navigate("/shop");
    }
  };

  const handleGuestLogin = () => {
    navigate("/shop");
  };

  return (
    <>
      <Header />
      <main className="bg-white min-h-[calc(100vh-200px)] flex items-center justify-center px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center shadow-xl rounded-2xl overflow-hidden bg-[#F8F9FA] border border-gray-200">
          <div className="hidden md:block h-full">
            <img
              src={loginImage}
              alt="Acebedo Panol Optical"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="px-8 py-12 md:px-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-[#212529]">
                Welcome Back
              </h2>
              <p className="text-[#212529]/70 mt-2">
                Sign in to your account to continue
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-[#212529] mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => handleBlur("email")}
                  required
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#D32F2F] outline-none transition ${
                    touched.email && !email.trim()
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                  placeholder="you@example.com"
                />
                {touched.email && !email.trim() && (
                  <p className="text-red-500 text-xs mt-1">
                    Email is required.
                  </p>
                )}
              </div>

              {/* Password with show/hide toggle */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-[#212529]">
                    Password
                  </label>
                  <a
                    href="#"
                    className="text-sm text-[#D32F2F] hover:text-[#B71C1C] hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => handleBlur("password")}
                    required
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#D32F2F] outline-none transition pr-10 ${
                      touched.password && !password.trim()
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? (
                      <FiEye className="w-5 h-5" />
                    ) : (
                      <FiEyeOff className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {touched.password && !password.trim() && (
                  <p className="text-red-500 text-xs mt-1">
                    Password is required.
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-[#D32F2F] text-white py-2 rounded-lg font-semibold hover:bg-[#B71C1C] transition shadow-md"
              >
                Log In
              </button>
            </form>

            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="px-3 text-[#212529]/50 text-sm">or</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>

            <button
              onClick={handleGuestLogin}
              className="w-full border border-gray-300 text-[#212529] py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
            >
              Continue as Guest
            </button>
            <p className="text-xs text-[#212529]/50 text-center mt-2">
              Guest accounts can browse & AR try‑on, but not take the vision
              test.
            </p>

            <p className="text-center text-sm text-[#212529]/70 mt-6">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-[#D32F2F] font-semibold hover:text-[#B71C1C] hover:underline"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
