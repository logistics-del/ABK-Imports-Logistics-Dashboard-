import React, { useEffect, useState, useCallback } from "react";

/**
 * Live countdown + "Last Updated" display. Calls onRefresh() every
 * `intervalMinutes` and whenever the user clicks "Refresh now".
 */
export default function LiveRefreshTimer({ intervalMinutes = 20, onRefresh, lastUpdated }) {
  const intervalSeconds = intervalMinutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(intervalSeconds);

  const triggerRefresh = useCallback(() => {
    onRefresh?.();
    setSecondsLeft(intervalSeconds);
  }, [onRefresh, intervalSeconds]);

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          triggerRefresh();
          return intervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [triggerRefresh, intervalSeconds]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="text-slate-500">
        Last Updated:{" "}
        <span className="font-medium text-slate-700">
          {lastUpdated ? new Date(lastUpdated).toLocaleString() : "—"}
        </span>
      </div>
      <div className="text-slate-500">
        Next refresh in:{" "}
        <span className="font-mono font-semibold text-abk-navy">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
      </div>
      <button
        onClick={triggerRefresh}
        className="px-2.5 py-1 rounded-md bg-abk-navy text-white text-xs font-semibold hover:bg-abk-navy2"
      >
        Refresh now
      </button>
    </div>
  );
}
