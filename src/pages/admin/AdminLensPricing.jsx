import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import toast from "react-hot-toast";

export default function AdminLensPricing() {
  const [lensTypes, setLensTypes] = useState([]);
  const [coatings, setCoatings] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch lens types, coatings, and existing prices
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [typesRes, coatingsRes, matrixRes] = await Promise.all([
        supabase.from("lens_types").select("id, name").order("id"),
        supabase.from("lens_coatings").select("id, name").order("id"),
        supabase
          .from("lens_pricing_matrix")
          .select("lens_type_id, coating_id, price"),
      ]);
      if (typesRes.error) {
        toast.error("Failed to load lens types.");
      } else {
        setLensTypes(typesRes.data || []);
      }
      if (coatingsRes.error) {
        toast.error("Failed to load lens coatings.");
      } else {
        setCoatings(coatingsRes.data || []);
      }
      if (matrixRes.error) {
        toast.error("Failed to load pricing matrix.");
      } else if (matrixRes.data) {
        const priceMap = {};
        matrixRes.data.forEach((row) => {
          if (!priceMap[row.lens_type_id]) priceMap[row.lens_type_id] = {};
          priceMap[row.lens_type_id][row.coating_id] = row.price;
        });
        setPrices(priceMap);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handlePriceChange = (lensTypeId, coatingId, value) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;
    setPrices((prev) => ({
      ...prev,
      [lensTypeId]: {
        ...(prev[lensTypeId] || {}),
        [coatingId]: numValue,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    let failed = false;

    for (const lensType of lensTypes) {
      for (const coating of coatings) {
        const newPrice = prices[lensType.id]?.[coating.id];
        if (newPrice === undefined || newPrice === null) continue;

        // Try to update first
        const { error: updateError } = await supabase
          .from("lens_pricing_matrix")
          .update({ price: newPrice })
          .eq("lens_type_id", lensType.id)
          .eq("coating_id", coating.id);

        if (updateError && updateError.code === "PGRST116") {
          // No matching row → insert
          const { error: insertError } = await supabase
            .from("lens_pricing_matrix")
            .insert({
              lens_type_id: lensType.id,
              coating_id: coating.id,
              price: newPrice,
            });
          if (insertError) {
            toast.error(`Error inserting ${lensType.name}/${coating.name}: ${insertError.message}`);
            failed = true;
            break;
          }
        } else if (updateError) {
          toast.error(`Error updating ${lensType.name}/${coating.name}: ${updateError.message}`);
          failed = true;
          break;
        }
      }
      if (failed) break;
    }

    if (!failed) {
      toast.success("Prices saved successfully!");
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-center py-10">Loading pricing data...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#212529]">Lens Pricing Matrix</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#D32F2F] text-white px-4 py-2 rounded-lg hover:bg-[#B71C1C] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save All Changes"}
        </button>
      </div>
      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Lens Type / Coating
              </th>
              {coatings.map((coating) => (
                <th
                  key={coating.id}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {coating.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {lensTypes.map((lensType) => (
              <tr key={lensType.id}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {lensType.name}
                </td>
                {coatings.map((coating) => {
                  const currentPrice = prices[lensType.id]?.[coating.id] || 0;
                  return (
                    <td key={coating.id} className="px-4 py-3">
                      <input
                        type="number"
                        value={currentPrice}
                        onChange={(e) =>
                          handlePriceChange(
                            lensType.id,
                            coating.id,
                            e.target.value,
                          )
                        }
                        className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-[#D32F2F]"
                        step="100"
                        min="0"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Edit any price and click "Save All Changes" to update the lens package
        prices across the store.
      </p>
    </div>
  );
}