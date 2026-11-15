import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AlertCircle, Check, Info, Loader2, RotateCw, Save } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import "../../styles/AdminLensPricing.css";

const clonePrices = (value) => Object.fromEntries(
  Object.entries(value).map(([lensTypeId, coatings]) => [lensTypeId, { ...coatings }]),
);

const normalized = (value) => value === "" || value == null ? null : Number(value);

export default function AdminLensPricing() {
  const [lensTypes, setLensTypes] = useState([]);
  const [coatings, setCoatings] = useState([]);
  const [prices, setPrices] = useState({});
  const [savedPrices, setSavedPrices] = useState({});
  const [existingRows, setExistingRows] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const [typesRes, coatingsRes, matrixRes] = await Promise.all([
      supabase.from("lens_types").select("id, name").order("id"),
      supabase.from("lens_coatings").select("id, name").order("id"),
      supabase.from("lens_pricing_matrix").select("lens_type_id, coating_id, price"),
    ]);

    if (typesRes.error || coatingsRes.error || matrixRes.error) {
      console.error("Failed to load lens pricing data:", typesRes.error || coatingsRes.error || matrixRes.error);
      toast.error("Could not load lens pricing. Try refreshing.");
      setLoadError(true);
      setLoading(false);
      return;
    }

    const loadedPrices = {};
    const rowKeys = new Set();
    (matrixRes.data || []).forEach((row) => {
      if (!loadedPrices[row.lens_type_id]) loadedPrices[row.lens_type_id] = {};
      loadedPrices[row.lens_type_id][row.coating_id] = String(row.price);
      rowKeys.add(`${row.lens_type_id}:${row.coating_id}`);
    });
    setLensTypes(typesRes.data || []);
    setCoatings(coatingsRes.data || []);
    setPrices(loadedPrices);
    setSavedPrices(clonePrices(loadedPrices));
    setExistingRows(rowKeys);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const changedCells = useMemo(() => {
    const changed = [];
    lensTypes.forEach((lensType) => coatings.forEach((coating) => {
      const current = normalized(prices[lensType.id]?.[coating.id]);
      const saved = normalized(savedPrices[lensType.id]?.[coating.id]);
      if (current !== saved) changed.push({ lensType, coating, current });
    }));
    return changed;
  }, [lensTypes, coatings, prices, savedPrices]);

  const handlePriceChange = (lensTypeId, coatingId, value) => {
    if (value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0)) return;
    setPrices((current) => ({
      ...current,
      [lensTypeId]: { ...(current[lensTypeId] || {}), [coatingId]: value },
    }));
  };

  const handlePriceBlur = (lensTypeId, coatingId) => {
    const currentValue = prices[lensTypeId]?.[coatingId];
    const savedValue = savedPrices[lensTypeId]?.[coatingId];
    if (currentValue === "" && savedValue != null) {
      setPrices((current) => ({
        ...current,
        [lensTypeId]: { ...(current[lensTypeId] || {}), [coatingId]: savedValue },
      }));
    }
  };

  const handleSave = async () => {
    if (!changedCells.length) return;
    const invalidCell = changedCells.find(({ current }) => current == null || !Number.isFinite(current) || current < 0);
    if (invalidCell) {
      toast.error(`Enter a valid price for ${invalidCell.lensType.name} · ${invalidCell.coating.name}.`);
      return;
    }

    setSaving(true);
    for (const { lensType, coating, current } of changedCells) {
      const key = `${lensType.id}:${coating.id}`;
      let error = null;
      if (existingRows.has(key)) {
        const result = await supabase
          .from("lens_pricing_matrix")
          .update({ price: current })
          .eq("lens_type_id", lensType.id)
          .eq("coating_id", coating.id)
          .select("lens_type_id")
          .maybeSingle();
        error = result.error || (!result.data ? new Error("Pricing row was not found or could not be updated.") : null);
      } else {
        const result = await supabase
          .from("lens_pricing_matrix")
          .insert({ lens_type_id: lensType.id, coating_id: coating.id, price: current });
        error = result.error;
        if (!error) {
          setExistingRows((rows) => new Set(rows).add(key));
        }
      }

      if (error) {
        console.error("Failed to save lens price:", error);
        toast.error(`Could not save ${lensType.name} · ${coating.name}.`);
        setSaving(false);
        return;
      }
    }

    setSavedPrices(clonePrices(prices));
    setSaving(false);
    toast.success("Lens prices saved.");
  };

  const combinationCount = lensTypes.length * coatings.length;

  return (
    <div className="apo-lens-pricing-page">
      <header className="apo-lens-pricing-header">
        <div>
          <p className="apo-lens-pricing-eyebrow">Commerce</p>
          <h1>Lens Pricing</h1>
          <p className="apo-lens-pricing-subtitle">Manage prices for lens package and coating combinations.</p>
        </div>
        <div className="apo-lens-pricing-header-actions">
          <span className={`apo-lens-pricing-change-indicator${changedCells.length ? " has-changes" : ""}`}>
            {changedCells.length ? <><span className="apo-lens-pricing-change-dot" />{changedCells.length} unsaved {changedCells.length === 1 ? "change" : "changes"}</> : <><Check size={14} /> All changes saved</>}
          </span>
          <button className="apo-lens-pricing-save" type="button" onClick={handleSave} disabled={saving || loading || loadError || !changedCells.length}>
            {saving ? <Loader2 size={15} className="is-spinning" /> : <Save size={15} />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </header>

      <section className="apo-lens-pricing-matrix">
        <div className="apo-lens-pricing-matrix-heading">
          <div><h2>Price matrix</h2><p>Each cell sets the lens add-on price used during eyeglasses checkout.</p></div>
          {!loading && !loadError && <span>{lensTypes.length} lens packages · {coatings.length} coatings · {combinationCount} combinations</span>}
        </div>

        {loading ? (
          <div className="apo-lens-pricing-message"><Loader2 size={18} className="is-spinning" /> Loading lens pricing…</div>
        ) : loadError ? (
          <div className="apo-lens-pricing-message is-error"><AlertCircle size={18} /> Pricing data could not be loaded.<button type="button" onClick={fetchData}><RotateCw size={14} />Try again</button></div>
        ) : !lensTypes.length || !coatings.length ? (
          <div className="apo-lens-pricing-message"><Info size={18} /> Add lens packages and coatings before setting prices.</div>
        ) : (
          <div className="apo-lens-pricing-table-wrap">
            <table className="apo-lens-pricing-table">
              <thead><tr>
                <th scope="col">Lens package</th>
                {coatings.map((coating) => <th scope="col" key={coating.id}>{coating.name}</th>)}
              </tr></thead>
              <tbody>
                {lensTypes.map((lensType) => (
                  <tr key={lensType.id}>
                    <th scope="row"><strong>{lensType.name}</strong><small>Lens add-on</small></th>
                    {coatings.map((coating) => {
                      const value = prices[lensType.id]?.[coating.id] ?? "";
                      const dirty = normalized(value) !== normalized(savedPrices[lensType.id]?.[coating.id]);
                      return <td key={coating.id} data-label={coating.name}>
                        <label className={`apo-lens-price-field${dirty ? " is-changed" : ""}`}>
                          <span>₱</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={value}
                            placeholder="Not set"
                            aria-label={`${lensType.name} price with ${coating.name}`}
                            onChange={(event) => handlePriceChange(lensType.id, coating.id, event.target.value)}
                            onBlur={() => handlePriceBlur(lensType.id, coating.id)}
                          />
                        </label>
                      </td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !loadError && lensTypes.length > 0 && coatings.length > 0 && (
          <div className="apo-lens-pricing-footer-note"><Info size={15} /><span>Prices use Philippine pesos. Changes apply to new checkouts; existing order prices remain saved with their order.</span></div>
        )}
      </section>

    </div>
  );
}
