import { useState } from "react";

export default function Step1_PreScreening({ data, updateData, onNext }) {
  const [age, setAge] = useState(data.age || "");
  const [workEnv, setWorkEnv] = useState(data.workEnvironment || "");
  const [skinAcidity, setSkinAcidity] = useState(data.skinAcidity || "");
  const [chiefComplaints, setChiefComplaints] = useState(
    data.chiefComplaints || "",
  );

  const [systemicConditions, setSystemicConditions] = useState(
    data.systemicConditions || [],
  );
  const [medications, setMedications] = useState(data.medications || "");
  const [allergies, setAllergies] = useState(data.allergies || "");
  const [familyHistory, setFamilyHistory] = useState(data.familyHistory || []);
  const [lastEyeExam, setLastEyeExam] = useState(data.lastEyeExam || "");
  const [currentEyewear, setCurrentEyewear] = useState(
    data.currentEyewear || "",
  );
  const [prescriptionPurpose, setPrescriptionPurpose] = useState(
    data.prescriptionPurpose || [],
  );
  const [pastOcularHistory, setPastOcularHistory] = useState(
    data.pastOcularHistory || "",
  );

  const [screenHours, setScreenHours] = useState(data.screenHours || "");
  const [symptoms, setSymptoms] = useState(data.symptoms || []);
  const [visualDemands, setVisualDemands] = useState(data.visualDemands || "");

  const [consentDisclaimer, setConsentDisclaimer] = useState(
    data.consentDisclaimer || false,
  );

  const isFormValid = () => age && workEnv && skinAcidity && consentDisclaimer;

  const handleNext = () => {
    if (!isFormValid()) {
      alert("Please complete required fields.");
      return;
    }

    updateData({
      age,
      workEnvironment: workEnv,
      skinAcidity,
      chiefComplaints,
      systemicConditions,
      medications,
      allergies,
      familyHistory,
      lastEyeExam,
      currentEyewear,
      prescriptionPurpose,
      pastOcularHistory,
      screenHours,
      symptoms,
      visualDemands,
      consentDisclaimer,
    });

    onNext();
  };

  // Checkbox Group "None" logic
  const CheckboxGroup = ({
    title,
    options,
    selected,
    setSelected,
    cols = 2,
  }) => (
    <div className="space-y-2">
      <label className="text-sm font-medium">{title}</label>
      <div className={`grid grid-cols-${cols} gap-2`}>
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={(e) => {
                if (opt === "None") {
                  setSelected(e.target.checked ? ["None"] : []);
                } else {
                  const updated = e.target.checked
                    ? [...selected.filter((i) => i !== "None"), opt]
                    : selected.filter((i) => i !== opt);
                  setSelected(updated);
                }
              }}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );

  const inputStyle =
    "w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress */}
      <div className="text-sm text-gray-500">Step 1 of 3 — Pre-Screening</div>

      <h2 className="text-2xl font-bold">Patient Pre-Screening</h2>

      {/* SECTION 1 */}
      <div className="bg-white p-5 rounded-xl shadow-sm border space-y-4">
        <h3 className="text-lg font-semibold">1. Personal Information</h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">
              Age <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className={inputStyle}
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Work Environment <span className="text-red-500">*</span>
            </label>
            <select
              value={workEnv}
              onChange={(e) => setWorkEnv(e.target.value)}
              className={inputStyle}
            >
              <option value="">Select</option>
              <option value="Screens">Mostly screens</option>
              <option value="Outdoors">Mostly outdoors</option>
              <option value="Mixed">Mixed</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">
              Skin Type <span className="text-red-500">*</span>
            </label>
            <select
              value={skinAcidity}
              onChange={(e) => setSkinAcidity(e.target.value)}
              className={inputStyle}
            >
              <option value="">Select</option>
              <option value="Normal">Normal</option>
              <option value="Acidic">Acidic</option>
              <option value="Oily">Oily</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Chief Complaints</label>
            <textarea
              value={chiefComplaints}
              onChange={(e) => setChiefComplaints(e.target.value)}
              className={inputStyle}
              rows="2"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2 */}
      <div className="bg-white p-5 rounded-xl shadow-sm border space-y-4">
        <h3 className="text-lg font-semibold">2. Medical & Eye History</h3>

        <div className="grid md:grid-cols-2 gap-4">
          <CheckboxGroup
            title="Systemic Conditions"
            options={[
              "Diabetes",
              "High blood pressure",
              "Arthritis",
              "Thyroid disease",
              "None",
            ]}
            selected={systemicConditions}
            setSelected={setSystemicConditions}
          />

          <div>
            <label className="text-sm font-medium">Medications</label>
            <input
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              className={inputStyle}
            />
          </div>
          <CheckboxGroup
            title="Family Eye History"
            options={[
              "Glaucoma",
              "Macular degeneration",
              "High refractive error",
              "None",
            ]}
            selected={familyHistory}
            setSelected={setFamilyHistory}
          />

          <div>
            <label className="text-sm font-medium">Allergies</label>
            <input
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              className={inputStyle}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Last Eye Exam</label>
            <select
              value={lastEyeExam}
              onChange={(e) => setLastEyeExam(e.target.value)}
              className={inputStyle}
            >
              <option value="">Select</option>
              <option value="<1 year">&lt; 1 year</option>
              <option value="1-2 years">1–2 years</option>
              <option value=">2 years">&gt; 2 years</option>
              <option value="Never">Never</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Current Eyewear</label>
            <select
              value={currentEyewear}
              onChange={(e) => setCurrentEyewear(e.target.value)}
              className={inputStyle}
            >
              <option value="">Select</option>
              <option value="Glasses">Glasses</option>
              <option value="Contacts">Contacts</option>
              <option value="Both">Both</option>
              <option value="None">None</option>
            </select>
          </div>

          <CheckboxGroup
            title="Prescription Purpose"
            options={["Distance", "Reading", "Both", "None"]}
            selected={prescriptionPurpose}
            setSelected={setPrescriptionPurpose}
          />

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Past Eye Conditions</label>
            <input
              value={pastOcularHistory}
              onChange={(e) => setPastOcularHistory(e.target.value)}
              className={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* SECTION 3 */}
      <div className="bg-white p-5 rounded-xl shadow-sm border space-y-4">
        <h3 className="text-lg font-semibold">3. Lifestyle & Digital Habits</h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Screen Time</label>
            <select
              value={screenHours}
              onChange={(e) => setScreenHours(e.target.value)}
              className={inputStyle}
            >
              <option value="">Select</option>
              <option value="<2h">&lt; 2 hours</option>
              <option value="2-4h">2–4 hours</option>
              <option value="4-6h">4–6 hours</option>
              <option value=">8h">&gt; 8 hours</option>
            </select>
          </div>

          <CheckboxGroup
            title="Symptoms"
            options={[
              "Dry eyes",
              "Light sensitivity",
              "Night vision issues",
              "Floaters",
              "None",
            ]}
            selected={symptoms}
            setSelected={setSymptoms}
          />

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Visual Demands</label>
            <input
              value={visualDemands}
              onChange={(e) => setVisualDemands(e.target.value)}
              className={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* DISCLAIMER */}
      <div className="bg-yellow-50 border border-yellow-300 p-4 rounded-lg">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={consentDisclaimer}
            onChange={(e) => setConsentDisclaimer(e.target.checked)}
          />
          I understand this is a screening tool and not a medical diagnosis.
        </label>
      </div>

      {/* BUTTON */}
      <div className="flex justify-end">
        <button
          onClick={handleNext}
          className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
        >
          Next
        </button>
      </div>
    </div>
  );
}
