import React, { useCallback, useEffect, useState } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import KPICards from "../components/KPICards";
import FilterBar from "../components/FilterBar";
import IndiaHeatmap from "../components/IndiaHeatmap";
import ShipmentTable from "../components/ShipmentTable";
import LiveRefreshTimer from "../components/LiveRefreshTimer";

const REFRESH_MINUTES = Number(process.env.REACT_APP_REFRESH_MINUTES || 20);

function buildQueryParams(filters, extra = {}) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return;
    if (key === "status") {
      params.set("status", value.join(","));
    } else {
      params.set(key, value);
    }
  });
  Object.entries(extra).forEach(([key, value]) => params.set(key, value));
  return params;
}

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [filters, setFilters] = useState({});
  const [kpi, setKpi] = useState({ cards: [], total_shipments: 0, last_updated: null });
  const [heatmap, setHeatmap] = useState([]);
  const [metric, setMetric] = useState("hit_rate");
  const [shipments, setShipments] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingKpi, setLoadingKpi] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);

  const fetchKpi = useCallback(async (activeFilters) => {
    setLoadingKpi(true);
    try {
      const { data } = await api.get(`/shipments/kpi-summary/?${buildQueryParams(activeFilters)}`);
      setKpi(data);
    } finally {
      setLoadingKpi(false);
    }
  }, []);

  const fetchHeatmap = useCallback(async (activeFilters, activeMetric) => {
    const { data } = await api.get(
      `/shipments/heatmap/?${buildQueryParams(activeFilters, { metric: activeMetric })}`
    );
    setHeatmap(data.states);
  }, []);

  const fetchTable = useCallback(async (activeFilters, activePage) => {
    setLoadingTable(true);
    try {
      const { data } = await api.get(
        `/shipments/shipments/?${buildQueryParams(activeFilters, { page: activePage })}`
      );
      setShipments(data.results);
      setTotalPages(Math.max(1, Math.ceil(data.count / 50)));
    } finally {
      setLoadingTable(false);
    }
  }, []);

  const refreshAll = useCallback(
    (activeFilters = filters, activePage = page) => {
      fetchKpi(activeFilters);
      fetchHeatmap(activeFilters, metric);
      fetchTable(activeFilters, activePage);
    },
    [filters, page, metric, fetchKpi, fetchHeatmap, fetchTable]
  );

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchHeatmap(filters, metric);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric]);

  const handleSearch = (nextFilters = filters) => {
    setPage(1);
    refreshAll(nextFilters, 1);
  };

  const handlePageChange = (nextPage) => {
    setPage(nextPage);
    fetchTable(filters, nextPage);
  };

  const handleShipmentUpdated = (updated) => {
    setShipments((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-abk-navy">Q1 Logistics Performance Overview</h1>
        <LiveRefreshTimer
          intervalMinutes={REFRESH_MINUTES}
          lastUpdated={kpi.last_updated}
          onRefresh={() => refreshAll()}
        />
      </div>

      <FilterBar filters={filters} setFilters={setFilters} onSearch={handleSearch} />

      <KPICards cards={kpi.cards} loading={loadingKpi} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <IndiaHeatmap data={heatmap} metric={metric} onMetricChange={setMetric} />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="font-semibold text-abk-navy mb-2">Total Shipments</h3>
          <div className="text-4xl font-bold text-abk-navy">{kpi.total_shipments?.toLocaleString()}</div>
          <p className="text-sm text-slate-500 mt-2">
            Matching the current filter selection above. Click a state on the map to export its
            pending/active cases as an Excel report.
          </p>
        </div>
      </div>

      <ShipmentTable
        shipments={shipments}
        loading={loadingTable}
        canEdit={isAdmin}
        onShipmentUpdated={handleShipmentUpdated}
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
