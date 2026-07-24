import React from "react";

// Exact color scheme from the spec.
export const STATUS_COLORS = {
  HIT: "#28a745",
  MISS: "#DC143C",
  RTS: "#FF8C00",
  INTRANSIT: "#FFBF00",
  OFD: "#FFD700",
  DELIVERED: "#28a745",
  EXCEPTION: "#6D0F35",
  NDR: "#6D0F35",
};

const LABELS = {
  HIT: "HIT",
  MISS: "MISS",
  RTS: "RTS",
  INTRANSIT: "Total Intransit",
  OFD: "Out for Delivery",
  DELIVERED: "Delivered",
  EXCEPTION: "Exception",
  NDR: "NDR",
};

function TrendArrow({ trend, trendPercent }) {
  if (trend === "flat" || trendPercent === 0) {
    return <span className="text-slate-400 text-xs font-medium">— 0%</span>;
  }
  const isUp = trend === "up";
  return (
    <span className={`text-xs font-semibold ${isUp ? "text-emerald-700" : "text-red-700"}`}>
      {isUp ? "▲" : "▼"} {Math.abs(trendPercent)}%
    </span>
  );
}

export default function KPICards({ cards, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-white border border-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
      {cards.map((card) => {
        const color = STATUS_COLORS[card.status] || "#64748b";
        return (
          <div
            key={card.status}
            className="rounded-xl bg-white border-l-4 shadow-sm px-4 py-3 flex flex-col justify-between"
            style={{ borderLeftColor: color }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {LABELS[card.status] || card.label}
              </span>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold" style={{ color }}>
                {card.count.toLocaleString()}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-500">{card.percent}% of total</span>
                <TrendArrow trend={card.trend} trendPercent={card.trend_percent} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
