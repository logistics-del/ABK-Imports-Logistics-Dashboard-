import React, { useRef, useState } from "react";
import api from "../utils/api";

export default function DataUploadPanel({ onImported }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = async (selected) => {
    if (!selected) return;
    setFile(selected);
    setResult(null);
    setPreviewing(true);
    try {
      const formData = new FormData();
      formData.append("file", selected);
      const { data } = await api.post("/ingestion/excel/preview/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(data);
      setMapping(data.suggested_mapping);
    } catch (err) {
      alert(`Could not read file: ${err.response?.data?.detail || err.message}`);
      setFile(null);
    } finally {
      setPreviewing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const updateMapping = (header, internalField) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (!internalField) {
        delete next[header];
      } else {
        next[header] = internalField;
      }
      return next;
    });
  };

  const confirmImport = async () => {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("field_mapping", JSON.stringify(mapping));
      const { data } = await api.post("/ingestion/excel/import/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      onImported?.();
    } catch (err) {
      alert(`Import failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setMapping({});
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const mappedRequiredCount = ["invoice_number", "ship_date", "edd_date", "shipment_status", "state"].filter(
    (f) => Object.values(mapping).includes(f)
  ).length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <h3 className="font-semibold text-abk-navy">Excel / CSV Upload</h3>

      {!preview && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver ? "border-abk-gold bg-amber-50" : "border-slate-300 hover:border-abk-navy"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {previewing ? (
            <p className="text-slate-500">Reading file…</p>
          ) : (
            <>
              <p className="text-slate-600 font-medium">Drag & drop an .xlsx or .csv file here</p>
              <p className="text-slate-400 text-sm mt-1">or click to browse</p>
            </>
          )}
        </div>
      )}

      {preview && !result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <strong>{file.name}</strong> — {preview.total_rows} rows detected
            </p>
            <button onClick={reset} className="text-xs text-slate-500 underline">
              Choose a different file
            </button>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">
              Column Mapping ({mappedRequiredCount}/5 required fields mapped)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {preview.headers.map((header) => (
                <div key={header} className="flex items-center gap-2 text-sm">
                  <span className="w-36 truncate text-slate-600" title={header}>
                    {header}
                  </span>
                  <span className="text-slate-300">→</span>
                  <select
                    className="flex-1 border border-slate-300 rounded-md px-2 py-1 text-sm"
                    value={mapping[header] || ""}
                    onChange={(e) => updateMapping(header, e.target.value)}
                  >
                    <option value="">— Ignore —</option>
                    {preview.internal_fields.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Preview (first {preview.preview_rows.length} rows)</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    {preview.headers.map((h) => (
                      <th key={h} className="px-2 py-1 text-left whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview_rows.map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {preview.headers.map((h) => (
                        <td key={h} className="px-2 py-1 whitespace-nowrap">
                          {String(row[h] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            disabled={mappedRequiredCount < 5 || importing}
            onClick={confirmImport}
            className="bg-abk-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-abk-navy2 disabled:opacity-40"
          >
            {importing ? "Importing…" : `Confirm Import (${preview.total_rows} rows)`}
          </button>
          {mappedRequiredCount < 5 && (
            <p className="text-xs text-red-600">
              Map all 5 required fields (invoice_number, ship_date, edd_date, shipment_status, state) to continue.
            </p>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex gap-4 text-sm">
            <span className="text-emerald-700 font-semibold">{result.rows_added} added</span>
            <span className="text-amber-700 font-semibold">{result.rows_updated} updated</span>
            <span className="text-slate-500 font-semibold">{result.rows_unchanged} unchanged</span>
            <span className="text-red-700 font-semibold">{result.rows_failed} failed</span>
          </div>
          {result.errors?.length > 0 && (
            <div className="text-xs text-red-600 max-h-32 overflow-y-auto">
              {result.errors.map((e, i) => (
                <div key={i}>
                  Row {e.row} ({e.invoice_number || "—"}): {e.error}
                </div>
              ))}
            </div>
          )}
          <button onClick={reset} className="text-sm bg-abk-navy text-white px-4 py-2 rounded-md font-semibold hover:bg-abk-navy2">
            Upload Another File
          </button>
        </div>
      )}
    </div>
  );
}
