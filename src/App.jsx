import { Toaster } from "react-hot-toast";
import { Routes, Route, Navigate } from "react-router-dom";
import "./styles/acebedo-ui.css";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import StaffRoute from "./components/StaffRoute";
import OptometristRoute from "./components/OptometristRoute";
import HomeRoute from "./components/HomeRoute";
import AccountLoading from "./components/AccountLoading";
import LoginPage from "./pages/LoginPage";
import AcceptTeamInvitationPage from "./pages/AcceptTeamInvitationPage";
import RegisterPage from "./pages/RegisterPage";
import MainPage from "./pages/MainPage";
import ShopPage from "./pages/ShopPage";
import CartPage from "./pages/CartPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderConfirmationPage from "./pages/OrderConfirmationPage";
import VisionScreeningPage from "./pages/VisionScreeningPage";
import AppointmentPage from "./pages/AppointmentPage";
import AppointmentConfirmationPage from "./pages/AppointmentConfirmationPage";
import AccountPage from "./pages/AccountPage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminStaffManagement from "./pages/admin/AdminStaffManagement";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminInventoryManagement from "./pages/admin/AdminInventoryManagement";
import AdminBrands from "./pages/admin/AdminBrands";
import AdminProductForm from "./pages/admin/AdminProductForm";
import AdminLensPricing from "./pages/admin/AdminLensPricing";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminOrderDetails from "./pages/admin/AdminOrderDetails";
import AdminAppointments from "./pages/admin/AdminAppointments";
import AdminPrescriptionDocuments from "./pages/admin/AdminPrescriptionDocuments";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminScreeningRecords from "./pages/admin/AdminScreeningRecords";
import ClinicStaffLayout from "./pages/staff/ClinicStaffLayout";
import StaffDashboard from "./pages/staff/StaffDashboard";
import OptometristWorkspace, { OptometristSection } from "./pages/optometrist/OptometristWorkspace";
import OptometristDashboard from "./pages/optometrist/OptometristDashboard";
// other admin pages will be imported later here

function App() {
  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 2000 }} />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomeRoute />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accept-invite" element={<AcceptTeamInvitationPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route
          path="/order-status/:orderId"
          element={<OrderConfirmationPage />}
        />

        {/* Protected customer routes */}
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
        <Route path="/account/:section" element={<ProtectedRoute loadingFallback={<AccountLoading />}><HomeRoute loadingFallback={<AccountLoading />}><AccountPage /></HomeRoute></ProtectedRoute>} />
        <Route
          path="/vision-screening"
          element={
            <ProtectedRoute>
              <VisionScreeningPage />
            </ProtectedRoute>
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
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="staff" element={<AdminStaffManagement />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="inventory" element={<AdminInventoryManagement />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="brands" element={<AdminBrands />} />
          <Route path="products/:id/edit" element={<AdminProductForm />} />
          <Route path="lens-pricing" element={<AdminLensPricing />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrderDetails />} />
          <Route path="appointments" element={<AdminAppointments />} />
          <Route path="prescriptions" element={<AdminPrescriptionDocuments />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="screenings" element={<AdminScreeningRecords />} />

          {/* Add other admin routes here (brands, orders, etc.) */}
        </Route>
        <Route path="/staff" element={<StaffRoute><ClinicStaffLayout /></StaffRoute>}>
          <Route index element={<Navigate to="/staff/dashboard" replace />} />
          <Route path="dashboard" element={<StaffDashboard />} />
          <Route path="orders" element={<AdminOrders staffMode />} />
          <Route path="appointments" element={<AdminAppointments />} />
        </Route>
        <Route path="/optometrist" element={<OptometristRoute><OptometristWorkspace /></OptometristRoute>}>
          <Route index element={<Navigate to="/optometrist/dashboard" replace />} />
          <Route path="dashboard" element={<OptometristDashboard />} />
          <Route path="appointments" element={<OptometristSection section="appointments" />} />
          <Route path="screenings" element={<OptometristSection section="screenings" />} />
          <Route path="prescriptions" element={<OptometristSection section="prescriptions" />} />
          <Route path="review-history" element={<OptometristSection section="review-history" />} />
          <Route path="clinical-records" element={<OptometristSection section="clinical-records" />} />
          <Route path="notifications" element={<OptometristSection section="notifications" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
