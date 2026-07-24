import React, { useEffect, useState } from "react";
import api from "../utils/api";
import DataUploadPanel from "../components/DataUploadPanel";

const EMPTY_API_FORM = {
  name: "", source_type: "api", api_endpoint_url: "", api_auth_token: "",
  api_auth_header: "Authorization", sync_interval_minutes: 20, field_mapping: "{}",
};
const EMPTY_GSHEET_FORM = {
  name: "", source_type: "gsheet", gsheet_id: "", gsheet_worksheet_name: "Sheet1",
  sync_interval_minutes: 20, field_mapping: "{}",
};

function SourceForm({ type, onCreated }) {
  const [form, setForm] = useState(type === "api" ? EMPTY_API_FORM : EMPTY_GSHEET_FORM);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let payload;
      let headers = {};
      if (type === "gsheet" && file) {
        payload = new FormData();
        Object.entries(form).forEach(([k, v]) => payload.append(k, v));
        payload.append("gsheet_service_account_json", file);
        headers = { "Content-Type": "multipart/form-data" };
      } else {
        payload = { ...form, field_mapping: JSON.parse(form.field_mapping || "{}") };
      }
      await api.post("/ingestion/sources/", payload, { headers });
      setForm(type === "api" ? EMPTY_API_FORM : EMPTY_GSHEET_FORM);
      setFile(null);
      onCreated();
    } catch (err) {
      alert(`Could not save source: ${JSON.stringify(err.response?.data || err.message)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Source Name</label>
        <input
          required
          className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder={type === "api" ? "e.g. ERP Shipment Feed" : "e.g. Ops Team Master Sheet"}
        />
      </div>

      {type === "api" ? (
        <>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">API Endpoint URL</label>
            <input
              required
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              value={form.api_endpoint_url}
              onChange={(e) => update("api_endpoint_url", e.target.value)}
              placeholder="https://api.example.com/shipments"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Auth Token / Key</label>
              <input
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                value={form.api_auth_token}
                onChange={(e) => update("api_auth_token", e.target.value)}
                placeholder="Bearer token or API key"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Auth Header Name</label>
              <input
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                value={form.api_auth_header}
                onChange={(e) => update("api_auth_header", e.target.value)}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Google Sheet ID</label>
            <input
              required
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              value={form.gsheet_id}
              onChange={(e) => update("gsheet_id", e.target.value)}
              placeholder="1AbCDeFGhijKLmnoPQRstuv... (from the sheet URL)"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Worksheet Name</label>
            <input
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              value={form.gsheet_worksheet_name}
              onChange={(e) => update("gsheet_worksheet_name", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Service Account JSON Key</label>
            <input type="file" accept=".json" onChange={(e) => setFile(e.target.files?.[0])} className="text-sm" />
          </div>
        </>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">
          Field Mapping (JSON: {"{"}"External Field": "internal_field"{"}"})
        </label>
        <textarea
          className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs font-mono h-20"
          value={form.field_mapping}
          onChange={(e) => update("field_mapping", e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Sync Interval (minutes)</label>
        <input
          type="number"
          min={15}
          max={30}
          className="w-24 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
          value={form.sync_interval_minutes}
          onChange={(e) => update("sync_interval_minutes", e.target.value)}
        />
      </div>

      {testResult && (
        <div className={`text-xs p-2 rounded-md ${testResult.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {testResult.success ? "Connection successful." : `Connection failed: ${testResult.error}`}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="bg-abk-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-abk-navy2 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Source"}
      </button>
    </form>
  );
}

function SourceList({ sources, onChanged }) {
  const [busyId, setBusyId] = useState(null);
  const [testResults, setTestResults] = useState({});

  const testConnection = async (id) => {
    setBusyId(id);
    try {
      const { data } = await api.post(`/ingestion/sources/${id}/test-connection/`);
      setTestResults((prev) => ({ ...prev, [id]: { success: true, ...data } }));
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [id]: { success: false, error: err.response?.data?.error || err.message } }));
    } finally {
      setBusyId(null);
    }
  };

  const syncNow = async (id) => {
    setBusyId(id);
    try {
      const { data } = await api.post(`/ingestion/sources/${id}/sync-now/`);
      alert(`Sync complete: ${data.rows_added} added, ${data.rows_updated} updated, ${data.rows_failed} failed.`);
      onChanged();
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (source) => {
    await api.patch(`/ingestion/sources/${source.id}/`, { is_active: !source.is_active });
    onChanged();
  };

  if (!sources.length) return <p className="text-sm text-slate-400">No sources configured yet.</p>;

  return (
    <div className="space-y-2">
      {sources.map((s) => (
        <div key={s.id} className="border border-slate-200 rounded-md p-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-medium text-sm text-abk-navy">
              {s.name} <span className="text-xs text-slate-400 uppercase">({s.source_type})</span>
            </div>
            <div className="text-xs text-slate-500">
              Every {s.sync_interval_minutes} min · Last synced:{" "}
              {s.last_synced_at ? new Date(s.last_synced_at).toLocaleString() : "never"}
            </div>
            {testResults[s.id] && (
              <div className={`text-xs mt-1 ${testResults[s.id].success ? "text-emerald-600" : "text-red-600"}`}>
                {testResults[s.id].success ? "Connection OK" : testResults[s.id].error}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleActive(s)}
              className={`text-xs px-2 py-1 rounded-full font-semibold ${s.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
            >
              {s.is_active ? "Active" : "Paused"}
            </button>
            <button
              disabled={busyId === s.id}
              onClick={() => testConnection(s.id)}
              className="text-xs border border-slate-300 px-2 py-1 rounded-md hover:bg-slate-50"
            >
              Test Connection
            </button>
            <button
              disabled={busyId === s.id}
              onClick={() => syncNow(s.id)}
              className="text-xs bg-abk-navy text-white px-2 py-1 rounded-md hover:bg-abk-navy2"
            >
              Sync Now
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SyncLogPanel({ logs }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-100">
          <tr>
            {["Source", "Type", "Status", "Added", "Updated", "Failed", "By", "When"].map((h) => (
              <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="px-2 py-1.5">{l.source_name || "—"}</td>
              <td className="px-2 py-1.5 uppercase">{l.source_type}</td>
              <td className="px-2 py-1.5">
                <span
                  className={`px-2 py-0.5 rounded-full font-semibold ${
                    l.status === "success"
                      ? "bg-emerald-100 text-emerald-700"
                      : l.status === "partial"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {l.status}
                </span>
              </td>
              <td className="px-2 py-1.5 text-emerald-700 font-medium">{l.rows_added}</td>
              <td className="px-2 py-1.5 text-amber-700 font-medium">{l.rows_updated}</td>
              <td className="px-2 py-1.5 text-red-700 font-medium">{l.rows_failed}</td>
              <td className="px-2 py-1.5">{l.triggered_by_username || "scheduler"}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DataManagement() {
  const [sources, setSources] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState("excel");

  const refresh = async () => {
    const [{ data: sourceData }, { data: logData }] = await Promise.all([
      api.get("/ingestion/sources/"),
      api.get("/ingestion/sync-logs/"),
    ]);
    setSources(sourceData.results || sourceData);
    setLogs((logData.results || logData).slice(0, 20));
  };

  useEffect(() => {
    refresh();
  }, []);

  const apiSources = sources.filter((s) => s.source_type === "api");
  const gsheetSources = sources.filter((s) => s.source_type === "gsheet");

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <h1 className="text-xl font-bold text-abk-navy">Data Management</h1>

      <div className="flex gap-2 border-b border-slate-200">
        {[
          ["excel", "Excel / CSV Upload"],
          ["api", "REST API Integration"],
          ["gsheet", "Google Sheets Integration"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 ${
              tab === key ? "border-abk-navy text-abk-navy" : "border-transparent text-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "excel" && <DataUploadPanel onImported={refresh} />}

      {tab === "api" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-abk-navy mb-3">New REST API Source</h3>
            <SourceForm type="api" onCreated={refresh} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-abk-navy mb-3">Configured API Sources</h3>
            <SourceList sources={apiSources} onChanged={refresh} />
          </div>
        </div>
      )}

      {tab === "gsheet" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-abk-navy mb-3">New Google Sheets Source</h3>
            <SourceForm type="gsheet" onCreated={refresh} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-abk-navy mb-3">Configured Google Sheets Sources</h3>
            <SourceList sources={gsheetSources} onChanged={refresh} />
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="font-semibold text-abk-navy mb-3">Recent Sync Log</h3>
        <SyncLogPanel logs={logs} />
      </div>
    </div>
  );
}
