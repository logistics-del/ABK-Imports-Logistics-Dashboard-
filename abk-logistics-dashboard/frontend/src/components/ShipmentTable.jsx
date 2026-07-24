import React, { useState } from "react";
import api from "../utils/api";
import { STATUS_COLORS } from "./KPICards";

const COMPLIANCE_OPTIONS = [
  { value: "", label: "—" },
  { value: "CUSTOMER_ISSUE", label: "Customer Issue" },
  { value: "VENDOR_ISSUE", label: "Vendor Issue" },
  { value: "OTHER_ISSUE", label: "Other Issue" },
];

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || "#64748b";
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
      style={{ backgroundColor: color }}
    >
      {status}
    </span>
  );
}

function EditableCell({ shipment, field, canEdit, onSaved }) {
  const [value, setValue] = useState(shipment[field] || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const commit = async () => {
    if (value === (shipment[field] || "")) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/shipments/shipments/${shipment.id}/inline-edit/`, {
        [field]: value,
      });
      onSaved(data.shipment);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(`Could not save: ${err.response?.data?.detail || err.message}`);
      setValue(shipment[field] || "");
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return <span className="text-sm text-slate-600">{shipment[field] || "—"}</span>;
  }

  if (field === "compliance") {
    return (
      <div className="flex items-center gap-1">
        <select
          className="text-sm border border-slate-300 rounded-md px-1.5 py-1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
        >
          {COMPLIANCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {saving && <span className="text-xs text-slate-400">Saving…</span>}
        {saved && <span className="text-xs text-emerald-600 font-semibold">Saved ✓</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        className="text-sm border border-slate-300 rounded-md px-1.5 py-1 w-40"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        placeholder="Add remarks…"
      />
      {saving && <span className="text-xs text-slate-400">Saving…</span>}
      {saved && <span className="text-xs text-emerald-600 font-semibold">Saved ✓</span>}
    </div>
  );
}

export default function ShipmentTable({ shipments, loading, canEdit, onShipmentUpdated, page, totalPages, onPageChange }) {
  if (loading) {
    return <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400">Loading shipments…</div>;
  }

  if (!shipments?.length) {
    return <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400">No shipments match the current filters.</div>;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-abk-navy text-white">
            <tr>
              {["Invoice #", "Status", "Vendor", "Ship Date", "EDD", "Delivery", "Ageing (d)", "City", "State", "Mobile", "Payment", "Remarks", "Compliance"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shipments.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-abk-navy whitespace-nowrap">{s.invoice_number}</td>
                <td className="px-3 py-2"><StatusBadge status={s.shipment_status} /></td>
                <td className="px-3 py-2 whitespace-nowrap">{s.vendor || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{s.ship_date}</td>
                <td className="px-3 py-2 whitespace-nowrap">{s.edd_date}</td>
                <td className="px-3 py-2 whitespace-nowrap">{s.delivery_date || "—"}</td>
                <td className="px-3 py-2">{s.ageing_tat}</td>
                <td className="px-3 py-2 whitespace-nowrap">{s.city}</td>
                <td className="px-3 py-2 whitespace-nowrap">{s.state}</td>
                <td className="px-3 py-2 whitespace-nowrap">{s.customer_mobile}</td>
                <td className="px-3 py-2 whitespace-nowrap">{s.mode_of_payment}</td>
                <td className="px-3 py-2">
                  <EditableCell shipment={s} field="remarks" canEdit={canEdit} onSaved={onShipmentUpdated} />
                </td>
                <td className="px-3 py-2">
                  <EditableCell shipment={s} field="compliance" canEdit={canEdit} onSaved={onShipmentUpdated} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 text-sm">
        <span className="text-slate-500">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="px-3 py-1 rounded-md border border-slate-300 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="px-3 py-1 rounded-md border border-slate-300 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
