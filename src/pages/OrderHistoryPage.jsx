// src/pages/OrderHistoryPage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!error) setOrders(data);
      setLoading(false);
    };
    fetchOrders();
  }, [user]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="bg-white min-h-screen py-12 px-6">
          <div className="text-center">Loading your orders...</div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="bg-white min-h-screen py-12 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-[#212529] mb-8">
            Order History
          </h1>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                You haven't placed any orders yet.
              </p>
              <Link to="/shop" className="text-[#D32F2F] mt-4 inline-block">
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm"
                >
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Order #{order.id}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                      <p className="mt-1">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded-full ${
                            order.order_status === "delivered"
                              ? "bg-green-100 text-green-700"
                              : order.order_status === "cancelled"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {order.order_status}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-[#D32F2F]">
                        ₱{Number(order.total).toFixed(2)}
                      </p>
                      <Link
                        to={`/order-confirmation/${order.id}`}
                        className="text-sm text-[#D32F2F] hover:underline"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
