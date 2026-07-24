import React from "react";

const STATUS_OPTIONS = ["HIT", "MISS", "RTS", "INTRANSIT", "OFD", "DELIVERED", "EXCEPTION", "NDR"];
const PAYMENT_OPTIONS = ["COD", "CASH", "PREPAID"];

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands",
  "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

export default function FilterBar({ filters, setFilters, onSearch }) {
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const toggleStatus = (status) => {
    setFilters((prev) => {
      const current = new Set(prev.status || []);
      current.has(status) ? current.delete(status) : current.add(status);
      return { ...prev, status: Array.from(current) };
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Ship Date From</label>
          <input
            type="date"
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.ship_date_from || ""}
            onChange={(e) => update("ship_date_from", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Ship Date To</label>
          <input
            type="date"
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.ship_date_to || ""}
            onChange={(e) => update("ship_date_to", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">State</label>
          <select
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm min-w-[160px]"
            value={filters.state || ""}
            onChange={(e) => update("state", e.target.value)}
          >
            <option value="">All States</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Mode of Payment</label>
          <select
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.mode_of_payment || ""}
            onChange={(e) => update("mode_of_payment", e.target.value)}
          >
            <option value="">All Modes</option>
            {PAYMENT_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Search Invoice # or Mobile Number
          </label>
          <input
            type="text"
            placeholder="e.g. INV-10023 or 9876543210"
            className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.search || ""}
            onChange={(e) => update("search", e.target.value)}
          />
        </div>

        <button
          onClick={onSearch}
          className="bg-abk-navy text-white px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-abk-navy2"
        >
          Apply Filters
        </button>
        <button
          onClick={() => {
            setFilters({});
            onSearch({});
          }}
          className="border border-slate-300 text-slate-600 px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-slate-50"
        >
          Clear
        </button>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((status) => {
            const active = (filters.status || []).includes(status);
            return (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                  active
                    ? "bg-abk-navy text-white border-abk-navy"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
