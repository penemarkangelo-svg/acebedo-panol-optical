import { Toaster } from "react-hot-toast";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./styles/acebedo-ui.css";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import StaffRoute from "./components/StaffRoute";
import OptometristRoute from "./components/OptometristRoute";
import HomeRoute from "./components/HomeRoute";
import LoginPage from "./pages/LoginPage";
import AcceptTeamInvitationPage from "./pages/AcceptTeamInvitationPage";
import RegisterPage from "./pages/RegisterPage";
import MainPage from "./pages/MainPage";
import ShopPage from "./pages/ShopPage";
import CartPage from "./pages/CartPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ContactLensDemoPage from "./pages/ContactLensDemoPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderConfirmationPage from "./pages/OrderConfirmationPage";
import VisionScreeningPage from "./pages/VisionScreeningPage";
import ScreeningEntry from "./vision-screening/components/ScreeningEntry";
import AppointmentPage from "./pages/AppointmentPage";
import AppointmentConfirmationPage from "./pages/AppointmentConfirmationPage";
import AccountPage from "./pages/AccountPage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import SuperAdminLayout from "./pages/admin/SuperAdminLayout";
import SuperAdminOverview from "./pages/admin/SuperAdminOverview";
import SuperAdminReports from "./pages/admin/SuperAdminReports";
import AdminStaffManagement from "./pages/admin/AdminStaffManagement";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminProductMedia from "./pages/admin/AdminProductMedia";
import AdminInventoryManagement from "./pages/admin/AdminInventoryManagement";
import AdminBrands from "./pages/admin/AdminBrands";
import AdminProductForm from "./pages/admin/AdminProductForm";
import AdminLensPricing from "./pages/admin/AdminLensPricing";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminAppointments from "./pages/admin/AdminAppointments";
import AdminPrescriptionDocuments from "./pages/admin/AdminPrescriptionDocuments";
import AdminPayments from "./pages/admin/AdminPayments";
import ScreeningRecords from "./pages/admin/AdminScreeningRecords";
import ClinicStaffLayout from "./pages/staff/ClinicStaffLayout";
import StaffDashboard from "./pages/staff/StaffDashboard";
import OptometristWorkspace, { OptometristSection } from "./pages/optometrist/OptometristWorkspace";
import OptometristDashboard from "./pages/optometrist/OptometristDashboard";
import OptometristAppointments from "./pages/optometrist/OptometristAppointments";
import OptometristClinicalRecords from "./pages/optometrist/OptometristClinicalRecords";
// other admin pages will be imported later here

const toastClassName = "!max-w-[min(24rem,calc(100vw_-_2rem))] !rounded-xl !border !border-[#E7E1DB] !bg-white !px-3 !py-2.5 !text-sm !font-medium !leading-snug !text-[#1A1816] !shadow-lg break-words sm:!px-4 sm:!py-3";

const toastOptions = {
  duration: 2000,
  className: toastClassName,
  success: {
    className: `${toastClassName} !border-l-4 !border-l-[#316746]`,
    iconTheme: { primary: "#316746", secondary: "#fff" },
  },
  error: {
    className: `${toastClassName} !border-l-4 !border-l-[#B8242F]`,
    iconTheme: { primary: "#B8242F", secondary: "#fff" },
  },
};

function App() {
  const { state } = useLocation();

  return (
    <>
      <Toaster position="top-right" toastOptions={toastOptions} />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomeRoute />} />
        <Route path="/about" element={<Navigate to="/#about" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accept-invite" element={<AcceptTeamInvitationPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/contact-lens-demo" element={<ContactLensDemoPage />} />
        <Route path="/cart" element={<CartPage />} />
        {/* Protected customer routes */}
        <Route
          path="/order-status/:orderId"
          element={<ProtectedRoute><OrderConfirmationPage /></ProtectedRoute>}
        />
        <Route
          path="/main"
          element={
            <ProtectedRoute>
              <MainPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <Navigate to="/account/orders" replace />
          }
        />
        <Route path="/account" element={<Navigate to="/account/profile" replace />} />
        <Route path="/account/:section" element={
          <ProtectedRoute loadingFallback={<AccountPage checkingAccess />}>
            <HomeRoute loadingFallback={<AccountPage checkingAccess />}>
              <AccountPage />
            </HomeRoute>
          </ProtectedRoute>
        } />
        <Route
          path="/vision-screening"
          element={
            state?.screeningStarted ? (
              <ProtectedRoute>
                <VisionScreeningPage />
              </ProtectedRoute>
            ) : <Navigate to="/shop" replace state={{ screeningIntro: "direct" }} />
          }
        />
        <Route
          path="/appointments"
          element={
            <Navigate to="/account/appointments" replace />
          }
        />
        <Route
          path="/appointments/book"
          element={
            <ProtectedRoute>
              <AppointmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointments/confirmation/:appointmentId"
          element={
            <ProtectedRoute>
              <AppointmentConfirmationPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              {({ canManageAdmins }) => <AdminLayout canManageAdmins={canManageAdmins} />}
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="staff" element={<Navigate to="/super-admin/team" replace />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="product-media" element={<AdminProductMedia />} />
          <Route path="product-media/:id" element={<AdminProductForm key="product-media" fromMedia />} />
          <Route path="inventory" element={<AdminInventoryManagement />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="brands" element={<AdminBrands />} />
          <Route path="products/:id/edit" element={<AdminProductForm />} />
          <Route path="lens-pricing" element={<AdminLensPricing />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrders />} />
          <Route path="appointments" element={<AdminAppointments />} />
          <Route path="prescriptions" element={<AdminPrescriptionDocuments />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="screenings" element={<ScreeningRecords />} />

          {/* Add other admin routes here (brands, orders, etc.) */}
        </Route>
        <Route path="/super-admin" element={<AdminRoute key="super-admin" requireSuperAdmin><SuperAdminLayout /></AdminRoute>}>
          <Route index element={<Navigate to="/super-admin/overview" replace />} />
          <Route path="overview" element={<SuperAdminOverview />} />
          <Route path="reports" element={<SuperAdminReports />} />
          <Route path="team" element={<AdminStaffManagement />} />
        </Route>
        <Route path="/staff" element={<StaffRoute><ClinicStaffLayout /></StaffRoute>}>
          <Route index element={<Navigate to="/staff/dashboard" replace />} />
          <Route path="dashboard" element={<StaffDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="appointments" element={<AdminAppointments />} />
        </Route>
        <Route path="/optometrist" element={<OptometristRoute><OptometristWorkspace /></OptometristRoute>}>
          <Route index element={<Navigate to="/optometrist/dashboard" replace />} />
          <Route path="dashboard" element={<OptometristDashboard />} />
          <Route path="appointments" element={<OptometristAppointments />} />
          <Route path="screenings" element={<ScreeningRecords clinical />} />
          <Route path="prescriptions" element={<AdminPrescriptionDocuments reviewMode />} />
          <Route path="review-history" element={<Navigate to="/optometrist/prescriptions" replace />} />
          <Route path="clinical-records" element={<OptometristClinicalRecords />} />
          <Route path="notifications" element={<OptometristSection section="notifications" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ScreeningEntry />
    </>
  );
}

export default App;
