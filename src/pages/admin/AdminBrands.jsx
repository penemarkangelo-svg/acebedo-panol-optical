import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import toast from "react-hot-toast";

export default function AdminBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    brand: null,
  });

  const fetchBrands = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("brands").select(`
        id,
        name,
        products ( id )
      `);
    if (error) {
      toast.error("Failed to load brands.");
      console.error(error);
    } else {
      const brandsWithCount = data.map((brand) => ({
        ...brand,
        product_count: brand.products?.length || 0,
      }));
      setBrands(brandsWithCount);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const handleAdd = async () => {
    if (!newBrandName.trim()) {
      toast.error("Brand name cannot be empty.");
      return;
    }
    const { error } = await supabase
      .from("brands")
      .insert({ name: newBrandName.trim() });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Brand added successfully.");
      setNewBrandName("");
      setAdding(false);
      fetchBrands();
    }
  };

  const handleEdit = (brand) => {
    setEditingId(brand.id);
    setEditName(brand.name);
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) {
      toast.error("Brand name cannot be empty.");
      return;
    }
    const { error } = await supabase
      .from("brands")
      .update({ name: editName.trim() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Brand updated successfully.");
      setEditingId(null);
      fetchBrands();
    }
  };

  const openDeleteModal = (brand) => {
    if (brand.product_count > 0) {
      toast.error(
        `Cannot delete "${brand.name}" because it has ${brand.product_count} product(s). Remove or reassign products first.`,
      );
      return;
    }
    setDeleteModal({ isOpen: true, brand });
  };

  const confirmDelete = async () => {
    const { brand } = deleteModal;
    if (!brand) return;
    const { error } = await supabase.from("brands").delete().eq("id", brand.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Brand deleted successfully.");
      fetchBrands();
    }
    setDeleteModal({ isOpen: false, brand: null });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, brand: null });
  };

  if (loading) {
    return <div className="text-center py-10">Loading brands...</div>;
  }

  return (
    <>
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-[#212529]">Manage Brands</h1>
          <button
            onClick={() => setAdding(true)}
            className="bg-[#D32F2F] text-white px-4 py-2 rounded-lg hover:bg-[#B71C1C]"
          >
            + Add Brand
          </button>
        </div>

        {adding && (
          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50 flex gap-2">
            <input
              type="text"
              placeholder="Brand name"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              className="flex-1 border rounded px-3 py-2 focus:ring-2 focus:ring-[#D32F2F]"
              autoFocus
            />
            <button
              onClick={handleAdd}
              className="bg-[#D32F2F] text-white px-4 py-2 rounded hover:bg-[#B71C1C]"
            >
              Save
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setNewBrandName("");
              }}
              className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Brand Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Products
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {brands.map((brand) => (
                <tr key={brand.id}>
                  <td className="px-6 py-4">
                    {editingId === brand.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="border rounded px-2 py-1 w-full"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium text-gray-900">
                        {brand.name}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {brand.product_count}{" "}
                    {brand.product_count === 1 ? "product" : "products"}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {editingId === brand.id ? (
                      <>
                        <button
                          onClick={() => handleUpdate(brand.id)}
                          className="text-green-600 hover:underline"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(brand)}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDeleteModal(brand)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {brands.length === 0 && (
                <tr>
                  <td
                    colSpan="3"
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No brands yet. Click "Add Brand" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-[#212529] mb-2">
              Confirm Delete
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the brand{" "}
              <strong>{deleteModal.brand?.name}</strong>? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeDeleteModal}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
