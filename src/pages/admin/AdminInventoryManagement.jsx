import { useCallback, useEffect, useMemo, useState } from "react";
import { BoxIcon, MagnifierIcon } from "@solar-icons/react/linear";
import { supabase } from "../../lib/supabaseClient";
import { getProductCategory, PRODUCT_TYPES, usesVariantStock } from "../../utils/productTypes";
import "../../styles/AdminDashboard.css";
import "../../styles/AdminInventoryManagement.css";

const numberFormat = new Intl.NumberFormat("en-PH");
const INVENTORY_ROWS_PER_PAGE = 5;

function categoryLabel(product) {
  return PRODUCT_TYPES.find(({ value }) => value === getProductCategory(product))?.label || "Uncategorized";
}

function primaryImage(product) {
  return product.product_images?.find((image) => image.is_primary)?.image_url
    || [...(product.product_images || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0]?.image_url
    || "";
}

function getInventoryRows(products) {
  return products.flatMap((product) => {
    const colors = product.product_colors || [];
    if (usesVariantStock(product.type) && colors.length) {
      return colors.map((color) => {
        const onHand = Number(color.stock || 0);
        const reserved = Number(color.reserved_stock || 0);
        const available = Math.max(0, onHand - reserved);
        const ownThreshold = color.low_stock_threshold;
        const threshold = ownThreshold ?? product.low_stock_threshold;
        return {
          id: `color-${color.id}`,
          product,
          color,
          onHand,
          reserved,
          available,
          threshold,
          thresholdSource: ownThreshold !== null && ownThreshold !== undefined
            ? "Variant set"
            : product.low_stock_threshold !== null && product.low_stock_threshold !== undefined
              ? "Inherited from product"
              : "Not set",
          status: available <= 0 ? "out" : threshold !== null && threshold !== undefined && available <= Number(threshold) ? "low" : "available",
        };
      });
    }

    const onHand = Number(product.stock || 0);
    const reserved = Number(product.reserved_stock || 0);
    const available = Math.max(0, onHand - reserved);
    const threshold = product.low_stock_threshold;
    return [{
      id: `product-${product.id}`,
      product,
      color: null,
      onHand,
      reserved,
      available,
      threshold,
      thresholdSource: threshold === null || threshold === undefined ? "Not set" : "Product threshold",
      status: available <= 0 ? "out" : threshold !== null && threshold !== undefined && available <= Number(threshold) ? "low" : "available",
    }];
  });
}

export default function AdminInventoryManagement() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageJump, setPageJump] = useState("");

  const loadInventory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, type, stock, reserved_stock, low_stock_threshold, product_images(image_url, is_primary, sort_order), product_colors(id, color_name, color_code, stock, reserved_stock, low_stock_threshold, sort_order)")
      .order("name", { ascending: true });

    if (error) {
      console.error("Unable to load inventory:", error);
      setLoadError(true);
      setProducts([]);
    } else {
      setLoadError(false);
      setProducts(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  const allRows = useMemo(() => getInventoryRows(products), [products]);
  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const rows = allRows.filter((row) => {
      const matchesSearch = !normalizedSearch
        || row.product.name.toLowerCase().includes(normalizedSearch)
        || (row.color?.color_name || "").toLowerCase().includes(normalizedSearch);
      const matchesCategory = category === "all" || getProductCategory(row.product) === category;
      const matchesStatus = status === "all" || row.status === status;
      return matchesSearch && matchesCategory && matchesStatus;
    });
    return rows.sort((a, b) => {
      if (sortBy === "available-desc") return b.available - a.available || a.product.name.localeCompare(b.product.name);
      if (sortBy === "available-asc") return a.available - b.available || a.product.name.localeCompare(b.product.name);
      if (sortBy === "on-hand-desc") return b.onHand - a.onHand || a.product.name.localeCompare(b.product.name);
      return a.product.name.localeCompare(b.product.name) || (a.color?.sort_order || 0) - (b.color?.sort_order || 0);
    });
  }, [allRows, search, category, status, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / INVENTORY_ROWS_PER_PAGE));
  const page = Math.min(currentPage, pageCount);
  const pageStart = filteredRows.length ? (page - 1) * INVENTORY_ROWS_PER_PAGE + 1 : 0;
  const pageEnd = Math.min(page * INVENTORY_ROWS_PER_PAGE, filteredRows.length);
  const paginatedRows = filteredRows.slice(pageStart - 1, pageEnd);
  const pageItems = pageCount <= 5
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : page <= 3
      ? [1, 2, 3, "ellipsis", pageCount]
      : page >= pageCount - 2
        ? [1, "ellipsis", pageCount - 2, pageCount - 1, pageCount]
        : [1, "ellipsis-start", page - 1, page, page + 1, "ellipsis-end", pageCount];

  const updateFilter = (setter, value) => {
    setter(value);
    setCurrentPage(1);
    setPageJump("");
  };

  const submitPageJump = (event) => {
    event.preventDefault();
    const requestedPage = Number.parseInt(pageJump, 10);
    if (!Number.isFinite(requestedPage)) return;
    setCurrentPage(Math.min(Math.max(requestedPage, 1), pageCount));
    setPageJump("");
  };

  const metrics = useMemo(() => ({
    available: allRows.reduce((sum, row) => sum + row.available, 0),
    reserved: allRows.reduce((sum, row) => sum + row.reserved, 0),
    low: allRows.filter((row) => row.status === "low").length,
    out: allRows.filter((row) => row.status === "out").length,
  }), [allRows]);

  const metricCards = [
    { label: "Available units", value: metrics.available, note: "On hand minus reserved" },
    { label: "Reserved units", value: metrics.reserved, note: "Held for checkout" },
    { label: "Low-stock items", value: metrics.low, note: "At or below threshold" },
    { label: "Out-of-stock items", value: metrics.out, note: "No available units", alert: metrics.out > 0 },
  ];

  return (
    <div className="apo-dashboard apo-inventory-page">
      <header className="apo-dashboard-header apo-inventory-header">
        <div className="apo-dashboard-title-row">
          <div>
            <h1>Inventory Management</h1>
            <p className="apo-inventory-subtitle">Monitor stock availability across products and color variants.</p>
          </div>
        </div>
      </header>

      <section className="apo-inventory-metrics" aria-label="Stock summary">
        {metricCards.map((metric) => (
          <article className={`apo-inventory-metric${metric.alert ? " is-alert" : ""}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{loading || loadError ? "—" : numberFormat.format(metric.value)}</strong>
            <small>{loadError ? "Inventory data unavailable" : metric.note}</small>
          </article>
        ))}
      </section>

      <section className="apo-dashboard-panel apo-inventory-directory">
        <div className="apo-panel-heading apo-inventory-directory-heading">
          <h2>Inventory directory</h2>
        </div>

        <div className="apo-inventory-filters">
          <label className="apo-products-search apo-inventory-search"><MagnifierIcon size={16} aria-hidden="true" /><input type="search" value={search} onChange={(event) => updateFilter(setSearch, event.target.value)} placeholder="Search product or color" aria-label="Search product or color" /></label>
          <label className="apo-products-select"><span className="apo-products-sr-only">Filter by category</span><select value={category} onChange={(event) => updateFilter(setCategory, event.target.value)}><option value="all">All categories</option>{PRODUCT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
          <label className="apo-products-select"><span className="apo-products-sr-only">Filter by stock status</span><select value={status} onChange={(event) => updateFilter(setStatus, event.target.value)}><option value="all">All stock statuses</option><option value="available">Available</option><option value="low">Low stock</option><option value="out">Out of stock</option></select></label>
          <label className="apo-products-select apo-inventory-sort"><span className="apo-products-sr-only">Sort inventory</span><select value={sortBy} onChange={(event) => updateFilter(setSortBy, event.target.value)}><option value="name">Sort: product name</option><option value="available-desc">Sort: most available</option><option value="available-asc">Sort: least available</option><option value="on-hand-desc">Sort: most on hand</option></select></label>
        </div>

        <div className="apo-inventory-table-wrap apo-admin-fit-table-wrap">
          <table className="apo-inventory-table apo-admin-fit-table">
            <thead><tr><th>Product</th><th>Category</th><th>Color variant</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Low-stock threshold</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? <tr><td className="apo-inventory-table-message" colSpan="8">Loading inventory…</td></tr>
                : loadError ? <tr><td className="apo-inventory-table-message" colSpan="8">Inventory information could not be loaded.</td></tr>
                  : filteredRows.length === 0 ? <tr><td className="apo-inventory-table-message" colSpan="8">No inventory records match these filters.</td></tr>
                    : paginatedRows.map((row) => <tr key={row.id}>
                      <td><div className="apo-inventory-product">{primaryImage(row.product)
                        ? <img className="apo-inventory-product-image" src={primaryImage(row.product)} alt="" loading="lazy" />
                        : <span className="apo-inventory-product-icon"><BoxIcon size={16} aria-hidden="true" /></span>}<strong>{row.product.name}</strong></div></td>
                      <td>{categoryLabel(row.product)}</td>
                      <td>{row.color ? <span className="apo-inventory-color"><i style={{ backgroundColor: row.color.color_code || "#d7d4cc" }} />{row.color.color_name}</span> : "—"}</td>
                      <td className="apo-inventory-number">{numberFormat.format(row.onHand)}</td>
                      <td className="apo-inventory-number">{numberFormat.format(row.reserved)}</td>
                      <td className="apo-inventory-number is-available">{numberFormat.format(row.available)}</td>
                      <td>
                        <div className="apo-inventory-threshold-value">
                          {row.threshold === null || row.threshold === undefined
                            ? "Not set"
                            : <>{numberFormat.format(Number(row.threshold))} units<small>{row.thresholdSource}</small></>}
                        </div>
                      </td>
                      <td><span className={`apo-inventory-status is-${row.status}`}>{row.status === "out" ? "Out of stock" : row.status === "low" ? "Low stock" : "Available"}</span></td>
                    </tr>)}
            </tbody>
          </table>
        </div>

        <footer className="apo-inventory-footer">
          <span className="apo-inventory-pagination-summary">
            {loadError
              ? "Inventory information could not be loaded."
              : loading
                ? "Loading inventory…"
                : `Showing ${pageStart} to ${pageEnd} of ${filteredRows.length} inventory records`}
          </span>
          {!loading && !loadError && filteredRows.length > 0 && pageCount > 1 && <nav className="apo-inventory-pagination" aria-label="Inventory pages">
            <button type="button" onClick={() => setCurrentPage(page - 1)} disabled={page === 1} aria-label="Previous page">‹</button>
            {pageItems.map((item, index) => typeof item === "number" ? <button
              type="button"
              key={item}
              className={item === page ? "is-current" : ""}
              onClick={() => setCurrentPage(item)}
              aria-label={`Page ${item}`}
              aria-current={item === page ? "page" : undefined}
            >{item}</button> : <span className="apo-inventory-pagination-ellipsis" key={`${item}-${index}`} aria-hidden="true">…</span>)}
            <button type="button" onClick={() => setCurrentPage(page + 1)} disabled={page === pageCount} aria-label="Next page">›</button>
            <form className="apo-inventory-page-jump" onSubmit={submitPageJump}>
              <label>Go to
                <input type="number" min="1" max={pageCount} value={pageJump} onChange={(event) => setPageJump(event.target.value)} placeholder={`e.g. ${pageCount}`} aria-label="Go to page" />
              </label>
              <button type="submit" className="apo-products-sr-only">Go to page</button>
            </form>
          </nav>}
        </footer>
      </section>

      <p className="apo-inventory-note">Available stock excludes reserved units. Eyeglasses and sunglasses track stock by color; accessories and eyedrops track stock by product.</p>

    </div>
  );
}
