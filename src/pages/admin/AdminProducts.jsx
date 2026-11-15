import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BoxIcon, MagnifierIcon } from "@solar-icons/react/linear";
import { supabase } from "../../lib/supabaseClient";
import { PRODUCT_TYPES, getProductCategory, usesVariantStock } from "../../utils/productTypes";
import "../../styles/AdminDashboard.css";
import "../../styles/AdminProducts.css";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

function categoryLabel(product) {
  return PRODUCT_TYPES.find(({ value }) => value === getProductCategory(product))?.label
    || product?.type
    || "Uncategorized";
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function primaryImage(product) {
  return product.product_images?.find((image) => image.is_primary)?.image_url
    || product.product_images?.[0]?.image_url
    || "";
}

function availableStock(product) {
  if (usesVariantStock(product.type) && product.product_colors?.length) {
    return product.product_colors.reduce((total, color) => total + Number(color.stock || 0), 0);
  }
  return Number(product.stock || 0);
}

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [brandId, setBrandId] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    let current = true;

    async function loadCatalog() {
      setLoading(true);
      const [productsResult, brandsResult] = await Promise.all([
        supabase
          .from("products")
          .select("*, brands(name), product_images(image_url, is_primary), product_colors(stock)")
          .order("created_at", { ascending: false }),
        supabase.from("brands").select("id, name").order("name"),
      ]);

      if (!current) return;
      if (productsResult.error) {
        setLoadError(true);
        setProducts([]);
      } else {
        setLoadError(false);
        setProducts(productsResult.data || []);
      }
      setBrands(brandsResult.data || []);
      setLoading(false);
    }

    loadCatalog();
    return () => { current = false; };
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const rows = products.filter((product) => {
      const matchesSearch = !normalizedSearch
        || String(product.name || "").toLowerCase().includes(normalizedSearch)
        || String(product.id).toLowerCase().includes(normalizedSearch);
      const matchesCategory = category === "all" || getProductCategory(product) === category;
      const matchesBrand = brandId === "all" || String(product.brand_id || "") === brandId;
      const hasStock = Number(product.stock || 0) > 0;
      const matchesAvailability = availability === "all"
        || (availability === "available" && hasStock)
        || (availability === "out" && !hasStock);
      return matchesSearch && matchesCategory && matchesBrand && matchesAvailability;
    });

    return rows.sort((a, b) => {
      if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""));
      if (sortBy === "price-low") return Number(a.price || 0) - Number(b.price || 0);
      if (sortBy === "price-high") return Number(b.price || 0) - Number(a.price || 0);
      if (sortBy === "oldest") return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [products, search, category, brandId, availability, sortBy]);

  const inStockCount = products.filter((product) => availableStock(product) > 0).length;
  const outOfStockCount = products.length - inStockCount;
  const brandCount = new Set(products.map((product) => product.brand_id).filter(Boolean)).size;
  const productTypeCount = new Set(products.map(getProductCategory).filter(Boolean)).size;
  const metrics = [
    ["Total products", products.length, "In the product catalog"],
    ["Available", inStockCount, "Products with stock on hand"],
    ["Out of stock", outOfStockCount, "No stock on hand"],
    ["Brands", brandCount, "Represented in the catalog"],
    ["Product types", productTypeCount, "Current catalog types"],
  ];

  return (
    <div className="apo-dashboard apo-products-page">
      <header className="apo-dashboard-header apo-products-header">
        <div className="apo-dashboard-topbar" aria-hidden="true" />
        <div className="apo-dashboard-title-row">
          <div>
            <p className="apo-dashboard-eyebrow">Commerce</p>
            <h1>Product Management</h1>
            <p className="apo-products-subtitle">Manage product details, images, variants, and availability.</p>
          </div>
          <Link to="/admin/products/new" className="apo-dashboard-primary-action">+ Add new product</Link>
        </div>
      </header>

      <section className="apo-products-metrics" aria-label="Catalog overview">
        {metrics.map(([label, value, detail], index) => (
          <article className={`apo-products-metric${index === 0 ? " is-highlighted" : ""}`} key={label}>
            <span>{label}</span>
            <strong>{loading || loadError ? "—" : value}</strong>
            <small>{loadError ? "Catalog information unavailable" : detail}</small>
          </article>
        ))}
      </section>

      <section className="apo-dashboard-panel apo-products-catalog">
        <div className="apo-panel-heading apo-products-heading">
          <div><h2>Product catalog</h2><p>Search and review products in the catalog</p></div>
          <span className="apo-panel-count">{loading || loadError ? "—" : `${filteredProducts.length} products`}</span>
        </div>

        <div className="apo-products-filters">
          <label className="apo-products-search"><MagnifierIcon size={16} aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product name or ID" aria-label="Search by product name or ID" /></label>
          <label className="apo-products-select"><span className="apo-products-sr-only">Filter by category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{PRODUCT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
          <label className="apo-products-select"><span className="apo-products-sr-only">Filter by brand</span><select value={brandId} onChange={(event) => setBrandId(event.target.value)}><option value="all">All brands</option>{brands.map((brand) => <option key={brand.id} value={String(brand.id)}>{brand.name}</option>)}</select></label>
          <label className="apo-products-select"><span className="apo-products-sr-only">Filter by availability</span><select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">All availability</option><option value="available">Available</option><option value="out">Out of stock</option></select></label>
          <label className="apo-products-select apo-products-sort"><span className="apo-products-sr-only">Sort products</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="newest">Sort: newest</option><option value="oldest">Sort: oldest</option><option value="name">Sort: name</option><option value="price-low">Sort: price low to high</option><option value="price-high">Sort: price high to low</option></select></label>
        </div>

        <div className="apo-products-table-wrap apo-admin-fit-table-wrap">
          <table className="apo-products-table apo-admin-fit-table">
            <thead><tr><th>Product</th><th>Product ID</th><th>Category</th><th>Brand</th><th>Price</th><th>Availability</th><th>Date added</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td className="apo-products-table-message" colSpan="8">Loading product catalog…</td></tr>
                : loadError ? <tr><td className="apo-products-table-message" colSpan="8">Product information could not be loaded.</td></tr>
                  : filteredProducts.length === 0 ? <tr><td className="apo-products-table-message" colSpan="8">No products match these filters.</td></tr>
                    : filteredProducts.map((product) => {
                      const image = primaryImage(product);
                      const available = availableStock(product) > 0;
                      return <tr key={product.id}>
                        <td><div className="apo-products-product-cell">{image ? <img src={image} alt="" loading="lazy" /> : <span className="apo-products-image-placeholder"><BoxIcon size={18} aria-hidden="true" /></span>}<strong>{product.name}</strong></div></td>
                        <td className="apo-products-id">#{product.id}</td>
                        <td>{categoryLabel(product)}</td>
                        <td>{product.brands?.name || "—"}</td>
                        <td className="apo-products-price">{money.format(Number(product.price || 0))}</td>
                        <td><span className={`apo-products-availability${available ? " is-available" : " is-unavailable"}`}>{available ? "Available" : "Out of stock"}</span></td>
                        <td>{formatDate(product.created_at)}</td>
                        <td><div className="apo-products-actions"><Link to={`/product/${product.id}`} target="_blank" rel="noreferrer">View</Link><Link to={`/admin/products/${product.id}/edit`}>Edit</Link></div></td>
                      </tr>;
                    })}
            </tbody>
          </table>
        </div>
        <footer className="apo-products-footer">
          <span>{loadError ? "Check your connection and try again." : "Availability is based on current stock."}</span>
          <span>{loading || loadError ? "" : `Showing ${filteredProducts.length} of ${products.length} products`}</span>
        </footer>
      </section>
    </div>
  );
}
