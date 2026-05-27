import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();
      if (orderError) {
        console.error(orderError);
      } else {
        setOrder(orderData);
        const { data: itemsData, error: itemsError } = await supabase
          .from("order_items")
          .select("*")
          .eq("order_id", orderId);
        if (!itemsError) setItems(itemsData);
      }
      setLoading(false);
    };
    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="bg-white min-h-screen py-12 px-6">
          <div className="text-center">Loading order details...</div>
        </main>
        <Footer />
      </>
    );
  }

  if (!order) {
    return (
      <>
        <Header />
        <main className="bg-white min-h-screen py-12 px-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Order not found</h1>
            <Link to="/shop" className="text-[#D32F2F]">
              Continue Shopping
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="bg-white min-h-screen py-12 px-6 md:px-12 lg:px-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#212529]">
              Thank You for Your Order!
            </h1>
            <p className="text-gray-500 mt-2">Order #{order.id}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    {item.product_name} x {item.quantity}
                  </span>
                  <span>₱{(item.unit_price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t pt-3 font-bold flex justify-between">
                <span>Total</span>
                <span>₱{order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="text-center">
            <Link
              to="/shop"
              className="inline-block bg-[#D32F2F] text-white px-6 py-2 rounded-lg hover:bg-[#B71C1C]"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
