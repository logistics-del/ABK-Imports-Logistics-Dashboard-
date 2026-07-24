import api from "./api";

/**
 * Triggers the backend's state-level pending-cases export
 * (GET /api/shipments/export-state/<state>/) and downloads the resulting
 * .xlsx file client-side. Returns a promise so callers can show/hide a
 * loading spinner around it.
 */
export async function exportStateExcel(stateName) {
  const response = await api.get(
    `/shipments/export-state/${encodeURIComponent(stateName)}/`,
    { responseType: "blob" }
  );

  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `ABK_Pending_Cases_${stateName}.xlsx`;

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
