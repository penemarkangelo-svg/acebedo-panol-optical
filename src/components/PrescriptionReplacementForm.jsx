import { useRef } from "react";
import { submitOrderPrescriptionReplacement } from "../lib/orderPrescriptionUploads";
import PrescriptionUploadModal from "./PrescriptionUploadGuide";

export default function PrescriptionReplacementForm({ orderId, userId, previousUploadId, onRefresh }) {
  const dialogRef = useRef(null);

  async function submitReplacement(selectedFile) {
    try {
      await submitOrderPrescriptionReplacement({ orderId, userId, previousUploadId, selectedFile });
      onRefresh(true);
    } catch (error) {
      onRefresh();
      throw error;
    }
  }

  return (
    <div className="order-details__prescription-replacement">
      <button type="button" aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
        Upload replacement
      </button>
      <PrescriptionUploadModal
        dialogRef={dialogRef}
        title="Replace your prescription"
        confirmLabel="Upload replacement"
        onConfirm={submitReplacement}
      />
    </div>
  );
}
