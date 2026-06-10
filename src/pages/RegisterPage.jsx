import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";
import { FiEye, FiEyeOff } from "react-icons/fi";
import Header from "../components/Header";
import Footer from "../components/Footer";
import registerImage from "../assets/bg.png";

// Password validation helper
const validatePassword = (password) => {
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!?<>@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const isLongEnough = password.length >= 8;
  return { hasUpperCase, hasLowerCase, hasNumber, hasSpecial, isLongEnough };
};

// Email validation helper
const validateEmailFormat = (email) => {
  if (!email.trim()) return "Email is required.";
  const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
  if (!emailRegex.test(email)) return "Please enter a valid email address (e.g., name@example.com).";
  return "";
};

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({});
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [emailError, setEmailError] = useState("");
  const navigate = useNavigate();

  const passwordValidations = validatePassword(password);
  const isPasswordValid = Object.values(passwordValidations).every(Boolean);
  const isEmailValid = validateEmailFormat(email) === "";
  const doPasswordsMatch = password === confirmPassword;
  const isFormValid = fullName.trim() && isEmailValid && isPasswordValid && doPasswordsMatch;

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "email") {
      setEmailError(validateEmailFormat(email));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all fields before submitting (show toast for each missing/invalid field)
    if (!fullName.trim()) {
      toast.error("Full name is required.");
      setTouched((prev) => ({ ...prev, fullName: true }));
      return;
    }
    const emailValidationResult = validateEmailFormat(email);
    if (emailValidationResult) {
      toast.error(emailValidationResult);
      setTouched((prev) => ({ ...prev, email: true }));
      setEmailError(emailValidationResult);
      return;
    }
    if (!isPasswordValid) {
      toast.error("Please meet all password requirements.");
      setTouched((prev) => ({ ...prev, password: true }));
      return;
    }
    if (!doPasswordsMatch) {
      toast.error("Passwords do not match.");
      setTouched((prev) => ({ ...prev, confirmPassword: true }));
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verification email sent! Please check your inbox.");
      navigate("/login");
    }
  };

  return (
    <>
      <Header />
      <main className="bg-white min-h-[calc(100vh-200px)] flex items-center justify-center px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-stretch shadow-xl rounded-2xl overflow-hidden bg-[#F8F9FA] border border-gray-200">
          {/* Left side: Image – stable, no resizing */}
          <div className="hidden md:block h-full">
            <img src={registerImage} alt="Acebedo Panol Optical" className="w-full h-full object-cover" />
          </div>

          <div className="px-8 py-12 md:px-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-[#212529]">Create your account</h2>
              <p className="text-[#212529]/70 mt-2">Join Acebedo Panol Optical today</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-[#212529] mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => handleBlur("fullName")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D32F2F] outline-none transition"
                  placeholder="Juan dela Cruz"
                  required
                />
                {touched.fullName && !fullName.trim() && (
                  <p className="text-red-500 text-xs mt-1">Full name is required.</p>
                )}
              </div>

              {/* Email with inline validation */}
              <div>
                <label className="block text-sm font-medium text-[#212529] mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (touched.email) setEmailError(validateEmailFormat(e.target.value));
                  }}
                  onBlur={() => handleBlur("email")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D32F2F] outline-none transition"
                  placeholder="you@example.com"
                  required
                />
                {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
              </div>

              {/* Password with strength indicator and eye toggle */}
              <div>
                <label className="block text-sm font-medium text-[#212529] mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => {
                      setPasswordFocused(false);
                      handleBlur("password");
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D32F2F] outline-none transition pr-10"
                    placeholder="Create a strong password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <FiEye className="w-5 h-5" /> : <FiEyeOff className="w-5 h-5" />}
                  </button>
                </div>

                {(touched.password || passwordFocused) && (
                  <div className="mt-2 space-y-1 text-xs">
                    <p className={passwordValidations.isLongEnough ? "text-green-600" : "text-gray-500"}>
                      {passwordValidations.isLongEnough ? "✓" : "○"} 8 characters or more
                    </p>
                    <p className={passwordValidations.hasUpperCase ? "text-green-600" : "text-gray-500"}>
                      {passwordValidations.hasUpperCase ? "✓" : "○"} Uppercase letter
                    </p>
                    <p className={passwordValidations.hasLowerCase ? "text-green-600" : "text-gray-500"}>
                      {passwordValidations.hasLowerCase ? "✓" : "○"} Lowercase letter
                    </p>
                    <p className={passwordValidations.hasNumber ? "text-green-600" : "text-gray-500"}>
                      {passwordValidations.hasNumber ? "✓" : "○"} Number
                    </p>
                    <p className={passwordValidations.hasSpecial ? "text-green-600" : "text-gray-500"}>
                      {passwordValidations.hasSpecial ? "✓" : "○"} Special character (e.g., !?@#$%)
                    </p>
                  </div>
                )}

                {touched.password && !isPasswordValid && (
                  <p className="text-red-500 text-xs mt-1">Please meet all password requirements.</p>
                )}
              </div>

              {/* Confirm Password with eye toggle */}
              <div>
                <label className="block text-sm font-medium text-[#212529] mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => handleBlur("confirmPassword")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D32F2F] outline-none transition pr-10"
                    placeholder="Repeat your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                  </button>
                </div>
                {touched.confirmPassword && !doPasswordsMatch && (
                  <p className="text-red-500 text-xs mt-1">Passwords do not match.</p>
                )}
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
              <a href="#" className="text-[#D32F2F] hover:text-[#B71C1C] hover:underline">Terms of Service</a>{" "}
              and{" "}
              <a href="#" className="text-[#D32F2F] hover:text-[#B71C1C] hover:underline">Privacy Policy</a>.
            </p>

            <p className="text-center text-sm text-[#212529]/70 mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-[#D32F2F] font-semibold hover:text-[#B71C1C] hover:underline">
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