import { manilaDayKey } from "./superAdminReportData.js";

const UNAVAILABLE = "Unavailable";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function header(value) {
  return { value, fontWeight: "bold", backgroundColor: "#173E34", textColor: "#FFFFFF" };
}

function amount(value) {
  return value == null ? UNAVAILABLE : { value, format: '"₱"#,##0.00' };
}

export async function downloadReportExcel(data, range) {
  const lastDate = manilaDayKey.format(range.lastDate);
  const filename = range.startKey === lastDate
    ? `acebedo-report-${lastDate}.xlsx`
    : `acebedo-report-${range.startKey}-to-${lastDate}.xlsx`;

  let fileHandle;
  if (typeof window.showSaveFilePicker === "function") {
    try {
      // Open the picker before loading the workbook writer so the click is still active.
      fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Excel workbook", accept: { [XLSX_MIME]: [".xlsx"] } }],
        excludeAcceptAllOption: true,
      });
    } catch (error) {
      if (error.name === "AbortError") return false;
      if (error.name !== "SecurityError") throw error;
      // Embedded browsers can block the save picker while allowing standard downloads.
    }
  }

  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const statusRows = data.statuses?.map(({ label, count }) => [
    label,
    count,
    { value: data.orders ? count / data.orders : 0, format: "0.0%" },
  ]) ?? [[UNAVAILABLE]];

  const rows = [
    [{ value: "Acebedo Panol Optical", fontWeight: "bold", fontSize: 16 }],
    ["Business report"],
    ["From", range.startKey],
    ["Through", lastDate],
    ["Time zone", "Philippine time (UTC+8)"],
    [],
    [header("Summary"), header("Total")],
    ["Verified payments (PHP)", amount(data.payment)],
    ["Orders placed", data.orders ?? UNAVAILABLE],
    ["Completed eye exams", data.exams ?? UNAVAILABLE],
    [],
    [header(range.byMonth ? "Month" : "Date"), header("Verified payments (PHP)"), header("Orders"), header("Completed exams")],
    ...data.rows.map((row) => [row.key, amount(row.payment), row.orders ?? UNAVAILABLE, row.exams ?? UNAVAILABLE]),
    [],
    [header("Order status"), header("Orders"), header("Share")],
    ...statusRows,
  ];

  const columns = [32, 28, 16, 22].map((width) => ({ width }));
  const workbook = writeExcelFile(rows, { sheet: "Report", columns });
  if (!fileHandle) {
    await workbook.toFile(filename);
    return false;
  }

  const blob = await workbook.toBlob();
  await blob.stream().pipeTo(await fileHandle.createWritable());
  return true;
}
