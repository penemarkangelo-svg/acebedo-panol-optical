import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Image, Search } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { PRODUCT_TYPES, getProductCategory, usesVariantStock } from "../../utils/productTypes";
import "../../styles/AdminDashboard.css";
import "../../styles/AdminProducts.css";
import "../../styles/AdminProductMedia.css";

const PRODUCTS_PER_PAGE = 8;
const CATALOG_BATCH_SIZE = 200;

function summarizeProduct(product) {
  const images = product.product_images || [];
  const colors = product.product_colors || [];
  const imageIds = new Set(images.map((image) => image.id));
  const primary = images.find((image) => image.is_primary)
    || [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];

  return {
    id: product.id,
    name: product.name,
    brand: product.brands?.name,
    category: getProductCategory(product),
    isEyewear: usesVariantStock(product.type),
    imageUrl: primary?.image_url,
    photoCount: images.length,
    colorCount: colors.length,
    colorsWithPhotos: colors.filter((color) => color.product_color_images?.length || imageIds.has(color.image_id)).length,
    colorsWithAr: colors.filter((color) => color.ar_overlay_path).length,
  };
}

export default function AdminProductMedia() {
  const [catalog, setCatalog] = useState({ status: "loading", products: [] });
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let current = true;

    async function loadCatalog() {
      const products = [];
      for (let offset = 0; current; offset += CATALOG_BATCH_SIZE) {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, type, brands(name), product_images(id, image_url, is_primary, sort_order), product_colors(image_id, ar_overlay_path, product_color_images(product_image_id))")
          .order("id", { ascending: false })
          .range(offset, offset + CATALOG_BATCH_SIZE - 1);
        if (!current) return;
        if (error) {
          setCatalog({ status: "error", products: [] });
          return;
        }
        products.push(...data);
        if (data.length < CATALOG_BATCH_SIZE) break;
      }
      if (current) setCatalog({ status: "ready", products: products.map(summarizeProduct) });
    }

    loadCatalog();
    return () => { current = false; };
  }, [reload]);

  const query = search.trim().toLowerCase();
  const filtered = catalog.products.filter((product) => (
    (category === "all" || product.category === category)
    && [product.name, product.brand, `#${product.id}`].some((value) => String(value || "").toLowerCase().includes(query))
  ));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE));
  const activePage = Math.min(page, pageCount);
  const start = (activePage - 1) * PRODUCTS_PER_PAGE;
  const visible = filtered.slice(start, start + PRODUCTS_PER_PAGE);
  const loading = catalog.status === "loading";
  const failed = catalog.status === "error";

  return (
    <div className="apo-dashboard apo-products-page apo-product-media">
      <header className="apo-dashboard-header apo-products-header">
        <div className="apo-dashboard-title-row">
          <div>
            <p className="apo-dashboard-eyebrow">Commerce</p>
            <h1>Product media</h1>
            <p className="apo-products-subtitle">Manage catalog photos, color galleries, and AR try-on assets.</p>
          </div>
        </div>
      </header>

      <section className="apo-dashboard-panel apo-products-catalog" aria-labelledby="apo-media-catalog-title">
        <div className="apo-panel-heading"><h2 id="apo-media-catalog-title">Catalog</h2></div>
        <div className="apo-product-media-filters">
          <label className="apo-products-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" aria-label="Search products" placeholder="Search by name, brand, or product ID" value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </label>
          <label className="apo-products-select">
            <select aria-label="Product category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
              <option value="all">All categories</option>
              {PRODUCT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
        </div>

        <div className="apo-product-media-table-wrap" role="region" aria-label="Product media catalog" tabIndex={0}>
          <table className="apo-dashboard-table apo-product-media-table">
            <thead>
              <tr><th scope="col">Product</th><th scope="col">Category</th><th scope="col">Photos</th><th scope="col">AR try-on</th><th scope="col">Action</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="apo-products-table-message"><span role="status">Loading catalog.</span></td></tr>}
              {failed && <tr><td colSpan={5} className="apo-products-table-message">
                <p role="status">The catalog could not be loaded.</p>
                <button type="button" className="apo-dashboard-retry" onClick={() => {
                  setCatalog({ status: "loading", products: [] });
                  setReload((value) => value + 1);
                }}>Retry</button>
              </td></tr>}
              {!loading && !failed && visible.length === 0 && <tr><td colSpan={5} className="apo-products-table-message">{catalog.products.length ? "No products match your filters." : "No products in the catalog yet."}</td></tr>}
              {visible.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="apo-products-product-cell">
                      {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <span className="apo-products-image-placeholder"><Image size={16} aria-hidden="true" /></span>}
                      <div>
                        <strong>{product.name}</strong>
                        <small>{product.brand ? `${product.brand} · ` : ""}#{product.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>{PRODUCT_TYPES.find((type) => type.value === product.category)?.label || "Uncategorized"}</td>
                  <td>{product.isEyewear && product.colorCount ? `${product.colorsWithPhotos} of ${product.colorCount} colors` : `${product.photoCount} ${product.photoCount === 1 ? "photo" : "photos"}`}</td>
                  <td>{product.isEyewear ? product.colorCount ? `${product.colorsWithAr} of ${product.colorCount} colors` : "No colors yet" : "Not applicable"}</td>
                  <td><Link to={`/admin/product-media/${product.id}`} className="apo-product-media-link" aria-label={`Manage media for ${product.name}`}>Manage media <ArrowRight size={14} aria-hidden="true" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && <footer className="apo-products-footer">
          <span>Showing {start + 1}–{start + visible.length} of {filtered.length} products</span>
          {pageCount > 1 && <div className="apo-products-pagination" role="group" aria-label="Catalog pages">
            <button type="button" disabled={activePage === 1} onClick={() => setPage(activePage - 1)}>Previous</button>
            <span>Page {activePage} of {pageCount}</span>
            <button type="button" disabled={activePage === pageCount} onClick={() => setPage(activePage + 1)}>Next</button>
          </div>}
        </footer>}
      </section>
    </div>
  );
}
