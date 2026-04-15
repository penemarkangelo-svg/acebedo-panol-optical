import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import MainPage from "./pages/MainPage";
import VisionScreeningPage from "./pages/VisionScreeningPage"; 

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/main" element={<MainPage />} />
      <Route
        path="/vision-screening"
        element={
          <ProtectedRoute>
            <VisionScreeningPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
