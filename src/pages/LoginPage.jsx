import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
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
  const [resetSending, setResetSending] = useState(false);
  const navigate = useNavigate();
  const { state } = useLocation();

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
    } else if (roleData?.role === "clinic_staff") {
      toast.success("Welcome to the clinic staff workspace.");
      navigate("/staff");
    } else if (roleData?.role === "optometrist") {
      toast.success("Welcome to the optometrist workspace.");
      navigate("/optometrist");
    } else {
      toast.success("Logged in successfully!");
      if (state?.screeningStarted) {
        navigate("/vision-screening", { replace: true, state: { screeningStarted: true } });
      } else {
        navigate("/shop");
      }
    }
  };

  const handleGuestLogin = () => {
    navigate("/shop");
  };

  const handlePasswordReset = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.error("Enter your email address first.");
      return;
    }

    setResetSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/accept-invite?flow=recovery`,
    });
    setResetSending(false);

    if (error) {
      toast.error("The reset email could not be sent. Try again shortly.");
      return;
    }
    toast.success("If an account uses that email, a password reset link is on its way.");
  };

  return (
    <>
      <Header />
      <main className="bg-[#F8F7F4] min-h-[calc(100vh-200px)] flex items-center justify-center px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-[calc(80rem+var(--acebedo-customer-width-growth))] mx-auto w-full grid md:grid-cols-2 gap-12 items-center shadow-sm rounded-xl overflow-hidden bg-white">
          <div className="hidden md:block h-full">
            <img
              src={loginImage}
              alt="Acebedo Panol Optical"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="px-5 py-10 sm:px-8 md:px-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-[#1A1816]">
                Welcome Back
              </h2>
              <p className="text-[#5C574F] mt-2">
                Sign in to your account to continue
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-[#1A1816] mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => handleBlur("email")}
                  required
                  className={`w-full px-4 py-2 border border-[#D2C9BA] rounded-lg bg-white focus:ring-2 focus:ring-[#B8242F] outline-none transition ${
                    touched.email && !email.trim()
                      ? "border-red-500"
                      : "border-[#D2C9BA]"
                  }`}
                  placeholder="you@example.com"
                />
                {touched.email && !email.trim() && (
                  <p className="text-[#B3131B] text-sm mt-1">
                    Email is required.
                  </p>
                )}
              </div>

              {/* Password with show/hide toggle */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-[#1A1816]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={resetSending}
                    className="text-sm text-[#B8242F] hover:text-[#9A1C26] hover:underline disabled:opacity-60"
                  >
                    {resetSending ? "Sending reset link…" : "Forgot password?"}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => handleBlur("password")}
                    required
                    className={`w-full px-4 py-2 border border-[#D2C9BA] rounded-lg bg-white focus:ring-2 focus:ring-[#B8242F] outline-none transition pr-10 ${
                      touched.password && !password.trim()
                        ? "border-red-500"
                        : "border-[#D2C9BA]"
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
                  <p className="text-[#B3131B] text-sm mt-1">
                    Password is required.
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-[#B8242F] text-white py-2 rounded-lg font-semibold hover:bg-[#9A1C26] transition"
              >
                Log In
              </button>
            </form>

            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="px-3 text-[#5C574F] text-sm">or</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>

            <button
              onClick={handleGuestLogin}
              className="w-full border border-gray-300 text-[#1A1816] py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
            >
              Continue as Guest
            </button>

            <p className="text-center text-sm text-[#5C574F] mt-6">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-[#B8242F] font-semibold hover:text-[#9A1C26] hover:underline"
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
