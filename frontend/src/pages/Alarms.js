import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "./Alarms.css";

// =========================
// THROTTLE
// =========================
function throttle(fn, limit) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  };
}

// =========================
// SEARCH
// =========================
const normalize = (str) =>
  str?.toLowerCase().replace(/\s+/g, "");

const isFuzzyMatch = (text, query) => {
  if (!query) return true;
  return normalize(text).includes(normalize(query));
};

function Alarms() {
  const navigate = useNavigate();

  const [alarms, setAlarms] = useState([]);
  const [workAlerts, setWorkAlerts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  // =========================
  // FETCH
  // =========================
  const fetchAlarms = async () => {
    try {
      const res = await API.get("/alarms");

      setAlarms(res.data.data || []);
      setWorkAlerts(res.data.workorder_alerts || []);
    } catch (err) {
      console.error("Failed to fetch alarms", err);
    }
  };

  const throttledFetch = useCallback(throttle(fetchAlarms, 5000), []);

  useEffect(() => {
    fetchAlarms();
    const interval = setInterval(throttledFetch, 3000);
    return () => clearInterval(interval);
  }, [throttledFetch]);

  // =========================
  // FILTER
  // =========================
  const filteredAlarms = useMemo(() => {
    return alarms.filter((a) => {
      return (
        (filter === "all" || a.machine_status === filter) &&
        isFuzzyMatch(a.machine_name, search)
      );
    });
  }, [alarms, filter, search]);

  // =========================
  // SUMMARY
  // =========================
  const summary = useMemo(() => {
    return {
      total: alarms.length,
      running: alarms.filter((a) => a.machine_status === "running").length,
      idle: alarms.filter((a) => a.machine_status === "idle").length,
      stopped: alarms.filter((a) => a.machine_status === "stopped").length,
    };
  }, [alarms]);

  // =========================
  // HELPERS
  // =========================
  const getIcon = (status) => {
    if (status === "running") return "🟢";
    if (status === "idle") return "🟠";
    return "🔴";
  };

  const getSeverityClass = (severity) => {
    if (severity === "critical") return "critical";
    if (severity === "warning") return "warning";
    return "normal";
  };

  const handleBack = () => {
    navigate("/dashboard");
  };

  return (
    <div className="alarms-page">
      <div className="top-bar">
        <button className="back-btn" onClick={handleBack}>
          ← Back
        </button>
      </div>

      {/* HEADER */}
      <div className="alarms-header">
        <h2>⚠ Machine Monitoring</h2>

        <div className="filters">
          <input
            type="text"
            placeholder="Search machine..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="running">Running</option>
            <option value="idle">Idle</option>
            <option value="stopped">Stopped</option>
          </select>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="alarm-summary">
        <div className="card total">Total: {summary.total}</div>
        <div className="card running">Running: {summary.running}</div>
        <div className="card idle">Idle: {summary.idle}</div>
        <div className="card stopped">Stopped: {summary.stopped}</div>
      </div>

      {/* MACHINE STATUS */}
      <div className="alarm-list">
        {filteredAlarms.map((a) => (
          <div
            key={a.id}
            className={`alarm-card ${getSeverityClass(a.severity)}`}
          >
            <div className="left">
              {getIcon(a.machine_status)}
            </div>

            <div className="middle">
              <h4>{a.machine_name}</h4>
              <p>{a.message}</p>
            </div>

            <div className="right">
              <span className={`status ${a.machine_status}`}>
                {a.machine_status.toUpperCase()}
              </span>

              <span className="time">
                {new Date(a.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* WORKORDER ALERTS */}
      {workAlerts.length > 0 && (
        <div className="workorder-alerts">
          <h3>⚠ Work Order Alerts</h3>

          {workAlerts.map((w, i) => (
            <div key={i} className={`wo-alert ${getSeverityClass(w.severity)}`}>
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Alarms;