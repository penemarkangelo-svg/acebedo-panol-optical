import { useState, useEffect, useRef } from "react";
import { Plus, Search } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import toast from "react-hot-toast";
import "../../styles/AdminDashboard.css";
import "../../styles/AdminBrands.css";

export default function AdminBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState(false);
  const deleteDialogRef = useRef(null);
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
      setLoadError(true);
      toast.error("Failed to load brands.");
      console.error(error);
    } else {
      setLoadError(false);
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

  useEffect(() => {
    if (deleteModal.isOpen && !deleteDialogRef.current?.open) deleteDialogRef.current?.showModal();
  }, [deleteModal.isOpen]);

  const visibleBrands = brands.filter((brand) => brand.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="apo-dashboard apo-brands-page">
      <header className="apo-dashboard-header">
        <div className="apo-dashboard-title-row">
          <div><p className="apo-dashboard-eyebrow">Commerce</p><h1>Brands</h1><p className="apo-brands-subtitle">Manage the brands used in your product catalog.</p></div>
          <button type="button" className="apo-dashboard-primary-action" onClick={() => { setAdding(true); setEditingId(null); }} disabled={loading || adding}><Plus size={16} aria-hidden="true" />Add brand</button>
        </div>
      </header>

      {adding && (
        <section className="apo-dashboard-panel apo-brands-editor" aria-labelledby="apo-add-brand-title">
          <div className="apo-panel-heading"><div><h2 id="apo-add-brand-title">Add brand</h2><p>Use the brand name customers will see in the catalog.</p></div></div>
          <form className="apo-brands-add-form" onSubmit={(event) => { event.preventDefault(); handleAdd(); }}>
            <label htmlFor="apo-new-brand">Brand name<input id="apo-new-brand" autoFocus required value={newBrandName} onChange={(event) => setNewBrandName(event.target.value)} placeholder="Enter brand name" /></label>
            <div className="apo-brands-form-actions"><button type="button" className="apo-brands-secondary" onClick={() => { setAdding(false); setNewBrandName(""); }}>Cancel</button><button type="submit" className="apo-brands-primary">Save brand</button></div>
          </form>
        </section>
      )}

      <section className="apo-dashboard-panel apo-brands-directory">
        <div className="apo-panel-heading apo-brands-directory-heading"><div><h2>Brand directory</h2><p>Brand names and their linked products</p></div><span className="apo-panel-count">{loading || loadError ? "—" : `${brands.length} ${brands.length === 1 ? "brand" : "brands"}`}</span></div>
        <div className="apo-brands-toolbar"><label className="apo-brands-search"><Search size={16} aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search brand name" aria-label="Search brand name" /></label></div>
        <table className="apo-brands-table">
          <thead><tr><th scope="col">Brand name</th><th scope="col">Products</th><th scope="col">Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="3" className="apo-brands-message" role="status">Loading brands…</td></tr>
              : loadError ? <tr><td colSpan="3" className="apo-brands-message">Brands could not be loaded. <button type="button" className="apo-brands-text-action" onClick={fetchBrands}>Try again</button></td></tr>
                : visibleBrands.length === 0 ? <tr><td colSpan="3" className="apo-brands-message">{search.trim() ? "No brands match your search." : "No brands yet. Add a brand to get started."}</td></tr>
                  : visibleBrands.map((brand) => (
                    <tr key={brand.id}>
                      <td>{editingId === brand.id ? <input className="apo-brands-name-input" autoFocus required value={editName} onChange={(event) => setEditName(event.target.value)} aria-label={`New name for ${brand.name}`} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); handleUpdate(brand.id); } if (event.key === "Escape") setEditingId(null); }} /> : <strong>{brand.name}</strong>}</td>
                      <td>{brand.product_count} {brand.product_count === 1 ? "product" : "products"}</td>
                      <td><div className="apo-brands-row-actions">{editingId === brand.id ? <><button type="button" className="apo-brands-text-action" onClick={() => handleUpdate(brand.id)}>Save</button><button type="button" className="apo-brands-text-action" onClick={() => setEditingId(null)}>Cancel</button></> : <><button type="button" className="apo-brands-text-action" aria-label={`Edit ${brand.name}`} onClick={() => { setAdding(false); handleEdit(brand); }}>Edit</button><button type="button" className="apo-brands-text-action is-danger" aria-label={`Delete ${brand.name}`} onClick={() => openDeleteModal(brand)}>Delete</button></>}</div></td>
                    </tr>
                  ))}
          </tbody>
        </table>
        <footer className="apo-brands-footer"><span>{loading || loadError ? "Brand information is not available yet." : `Showing ${visibleBrands.length} of ${brands.length} brands`}</span><span>Reassign linked products before deleting a brand.</span></footer>
      </section>

      {deleteModal.isOpen && (
        <dialog ref={deleteDialogRef} className="apo-brands-delete-dialog" aria-labelledby="apo-delete-brand-title" aria-describedby="apo-delete-brand-description" onCancel={closeDeleteModal} onClose={closeDeleteModal}>
          <h2 id="apo-delete-brand-title">Delete brand?</h2>
          <p id="apo-delete-brand-description">Delete <strong>{deleteModal.brand?.name}</strong>? This action cannot be undone.</p>
          <div className="apo-brands-form-actions"><button type="button" autoFocus className="apo-brands-secondary" onClick={closeDeleteModal}>Cancel</button><button type="button" className="apo-brands-primary is-danger" onClick={confirmDelete}>Delete brand</button></div>
        </dialog>
      )}
    </div>
  );
}
