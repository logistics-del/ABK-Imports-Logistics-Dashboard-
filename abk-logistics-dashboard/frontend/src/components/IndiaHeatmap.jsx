import React, { useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { exportStateExcel } from "../utils/exportExcel";

// Public India-states TopoJSON/GeoJSON used widely with react-simple-maps.
// Swap for a self-hosted copy in /public if you need offline/air-gapped use.
const GEO_URL =
  "https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson";

export default function IndiaHeatmap({ data, metric, onMetricChange }) {
  const [hovered, setHovered] = useState(null);
  const [exporting, setExporting] = useState(null);

  const byState = Object.fromEntries((data || []).map((d) => [d.state.toLowerCase(), d]));

  // Darker = worse performance (per spec): for hit_rate, low value = dark;
  // for miss_rate, high value = dark.
  const colorScale =
    metric === "hit_rate"
      ? scaleLinear().domain([0, 100]).range(["#6D0F35", "#28a745"])
      : scaleLinear().domain([0, 100]).range(["#28a745", "#DC143C"]);

  const handleClick = async (stateName) => {
    try {
      setExporting(stateName);
      await exportStateExcel(stateName);
    } catch (err) {
      alert(`Could not export pending cases for ${stateName}: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-abk-navy">India — State-wise Performance</h3>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => onMetricChange("hit_rate")}
            className={`px-2.5 py-1 rounded-md font-medium ${
              metric === "hit_rate" ? "bg-abk-navy text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            HIT Rate
          </button>
          <button
            onClick={() => onMetricChange("miss_rate")}
            className={`px-2.5 py-1 rounded-md font-medium ${
              metric === "miss_rate" ? "bg-abk-navy text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            MISS Rate
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 mb-2">
        Click any state to export its pending / active cases to Excel. Darker shading = weaker performance.
      </p>

      <div className="relative">
        <ComposableMap projection="geoMercator" projectionConfig={{ scale: 1000, center: [82, 22] }} height={430}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const name = geo.properties.NAME_1 || geo.properties.st_nm || geo.properties.name;
                const stateData = byState[(name || "").toLowerCase()];
                const value = stateData?.value;
                const fill = value === null || value === undefined ? "#E5E7EB" : colorScale(value);
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => setHovered({ name, stateData })}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleClick(name)}
                    style={{
                      default: { fill, stroke: "#FFFFFF", strokeWidth: 0.5, outline: "none", cursor: "pointer" },
                      hover: { fill: "#D4A017", stroke: "#FFFFFF", strokeWidth: 0.75, outline: "none", cursor: "pointer" },
                      pressed: { fill: "#13233F", outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>

        {hovered && (
          <div className="absolute top-2 left-2 bg-white shadow-lg rounded-md px-3 py-2 text-xs border border-slate-200">
            <div className="font-semibold text-abk-navy">{hovered.name}</div>
            {hovered.stateData ? (
              <>
                <div>Total: {hovered.stateData.total}</div>
                <div>HIT Rate: {hovered.stateData.hit_rate ?? "—"}%</div>
                <div>MISS Rate: {hovered.stateData.miss_rate ?? "—"}%</div>
              </>
            ) : (
              <div className="text-slate-400">No shipments in current filter</div>
            )}
          </div>
        )}

        {exporting && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <div className="flex items-center gap-2 text-abk-navy text-sm font-medium">
              <span className="w-4 h-4 border-2 border-abk-navy border-t-transparent rounded-full animate-spin" />
              Generating export for {exporting}…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
