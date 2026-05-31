import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [stockFilter, setStockFilter] = useState("all"); // 'all', 'inStock', 'outOfStock'
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
    fetchBrands();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        *,
        brands (name),
        frame_shapes (name),
        frame_materials (name),
        product_images (image_url, is_primary)
      `,
      )
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const fetchBrands = async () => {
    const { data, error } = await supabase
      .from("brands")
      .select("id, name")
      .order("name");
    if (!error) setBrands(data || []);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      alert(error.message);
    } else {
      fetchProducts();
    }
  };

  // Filter products
  const filteredProducts = products.filter((product) => {
    // Search by name
    if (search && !product.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    // Brand filter
    if (selectedBrand && product.brand_id !== parseInt(selectedBrand)) {
      return false;
    }
    // Stock filter
    if (stockFilter === "inStock" && product.stock <= 0) return false;
    if (stockFilter === "outOfStock" && product.stock > 0) return false;
    return true;
  });

  const getPrimaryImage = (product) => {
    const primary = product.product_images?.find((img) => img.is_primary);
    return (
      primary?.image_url ||
      product.product_images?.[0]?.image_url ||
      "https://placehold.co/60"
    );
  };

  if (loading) {
    return <div className="text-center py-10">Loading products...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link
          to="/admin/products/new"
          className="bg-[#D32F2F] text-white px-4 py-2 rounded-lg hover:bg-[#B71C1C]"
        >
          + Add Product
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="mb-6 flex flex-wrap gap-3 items-center bg-white p-3 rounded-lg shadow">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F]"
          />
        </div>
        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F]"
        >
          <option value="">All Brands</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F]"
        >
          <option value="all">All Stock</option>
          <option value="inStock">In Stock (&gt;0)</option>
          <option value="outOfStock">Out of Stock (0)</option>
        </select>
      </div>

      {filteredProducts.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No products match the filters.
        </p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Image
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Brand
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td className="px-6 py-4">
                    <img
                      src={getPrimaryImage(product)}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  </td>
                  <td className="px-6 py-4 font-medium">{product.name}</td>
                  <td className="px-6 py-4">{product.brands?.name || "-"}</td>
                  <td className="px-6 py-4">
                    ₱{Number(product.price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">{product.stock}</td>
                  <td className="px-6 py-4 space-x-2">
                    <Link
                      to={`/admin/products/${product.id}/edit`}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
