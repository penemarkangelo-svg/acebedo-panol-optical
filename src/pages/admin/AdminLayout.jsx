import { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import {
  HiOutlineCube,
  HiOutlineShoppingBag,
  HiOutlineTruck,
  HiOutlineCalendar,
  HiOutlineEye,
  HiOutlineUsers,
  HiOutlineCurrencyDollar,
} from "react-icons/hi";

const navItems = [
  { name: "Products", path: "/admin/products", icon: HiOutlineCube },
  { name: "Brands", path: "/admin/brands", icon: HiOutlineShoppingBag },
  { name: "Lens Pricing",path: "/admin/lens-pricing",icon: HiOutlineCurrencyDollar,},
  { name: "Orders", path: "/admin/orders", icon: HiOutlineTruck },
  { name: "Appointments", path: "/admin/appointments", icon: HiOutlineCalendar,},
  { name: "Vision Results", path: "/admin/vision-results", icon: HiOutlineEye },
  { name: "Staff Roles", path: "/admin/roles", icon: HiOutlineUsers },
];

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    const checkAdmin = async () => {
      if (loading) {
        return;
      }

      if (!user) {
        navigate("/");
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data || data.role !== "admin") {
        navigate("/");
      } else {
        setIsAdmin(true);
      }
    };
    checkAdmin();
  }, [user, loading, navigate]);

  if (loading || isAdmin === null) {
    return <div className="text-center py-10">Checking permissions...</div>;
  }

  // Render admin panel only for admins
  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 bg-white shadow-md flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-[#D32F2F]">Admin Panel</h1>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                location.pathname === item.path
                  ? "bg-[#D32F2F] text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
