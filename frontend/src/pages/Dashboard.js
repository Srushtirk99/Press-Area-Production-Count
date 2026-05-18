import { useEffect, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setMachines } from "../redux/slices/dashboardSlice";
import { connectSocket, getSocket } from "../socket";
import { UPLOADS_URL } from "../api";
import "./Dashboard.css";

// =======================
// MEMOIZED MACHINE CARD
// =======================
const MachineCard = memo(({ machine, onClick }) => {
  const getStatus = (machine) => {
    if (Number(machine.window_5min_count) > 0) {
      return { text: "🟢 Running", className: "running" };
    }
    if (Number(machine.window_30min_count) > 0) {
      return { text: "🟠 Idle", className: "idle" };
    }
    return { text: "🔴 Stopped", className: "stopped" };
  };

  const status = getStatus(machine);

  return (
    <div className="machine-card" onClick={() => onClick(machine.machine_id)}>
      <img
        src={`${UPLOADS_URL}/${machine.image}`}
        alt={machine.machine_name}
        className="machine-image"
      />

      <h3 className="machine-title">{machine.machine_name}</h3>

      <div className="machine-stats">
        <div className="stat">
          <span>Total Production Today</span>
          <strong>{machine.total_today}</strong>
        </div>

        <div className="stat">
          <span>Production in Last 5 Min</span>
          <strong>{machine.window_5min_count}</strong>
        </div>

        <div className="stat">
          <span>Current Run Rate/hr</span>
          <strong>{machine.current_rate}</strong>
        </div>

        <div className="stat">
          <span>Max Run Rate</span>
          <strong>{machine.max_rate}</strong>
        </div>

        <div className="stat">
          <span>Efficiency</span>
          <strong>{machine.efficiency}%</strong>
        </div>

        <div className="stat">
          <span>Extra Production</span>
          <strong>{machine.unallocated_total ?? 0}</strong>
        </div>
      </div>

      <div className={`machine-status ${status.className}`}>
        Status: {status.text}
      </div>
    </div>
  );
});

// =======================
// DASHBOARD COMPONENT
// =======================
function Dashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { machines, loading } = useSelector((state) => state.dashboard);

  const [time, setTime] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);

  // PROTECT ROUTE
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/");
  }, [navigate]);

  // SOCKET CONNECTION
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const handleData = (data) => {
      console.log("✅ Dashboard received:", data.length, "machines");
      dispatch(setMachines(data));
    };

    const handleDisconnect = (reason) => {
      console.log("❌ Disconnected:", reason);
    };

    socket.on("dashboardData", handleData);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("dashboardData", handleData);
      socket.off("disconnect", handleDisconnect);
    };
  }, [dispatch]);

  // LIVE CLOCK
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // LOGOUT
  const handleLogout = () => {
    localStorage.clear();
    const socket = getSocket();
    if (socket) socket.disconnect();
    navigate("/", { replace: true });
  };

  // NAVIGATION
  const handleMachineClick = (id) => {
    navigate(`/machine/${id}`);
  };

  return (
    <div className="dashboard-layout">
      <button
        className="menu-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
        type="button"
        aria-label="Toggle menu"
      >
        ☰
      </button>

      {/* SIDEBAR */}
      <div className={`sidebar ${menuOpen ? "open" : ""}`}>
        <h3 className="sidebar-title">MAIN</h3>

        <button className="sidebar-item active">Dashboard</button>

        <button
          className="sidebar-item"
          onClick={() => navigate("/real-time")}
        >
          Real-Time
        </button>

        <button className="sidebar-item" onClick={() => navigate("/reports")}>
          Reports
        </button>

        <button
          className="sidebar-item"
          onClick={() => navigate("/workorders")}
        >
          Work Orders
        </button>

        <h3 className="sidebar-title">MONITORING</h3>

        <button className="sidebar-item" onClick={() => navigate("/alarms")}>
          Alarms
        </button>

        <h3 className="sidebar-title">SETTINGS</h3>

        <button className="sidebar-item" onClick={() => navigate("/settings")}>
          Settings
        </button>
      </div>

      {/* MAIN */}
      <div className="dashboard-container">
        {/* TOPBAR */}
        <div className="topbar">
          <h2 className="logo">Press Dashboard</h2>

          <div className="topbar-right">
            <span className="live-dot"></span>
            <span className="clock">{time.toLocaleTimeString()}</span>

            <span
              className="user"
              onClick={() => navigate("/admin")}
              style={{ cursor: "pointer" }}
            >
              👤 {localStorage.getItem("adminName")}
            </span>

            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        {/* HEADER */}
        <div className="page-header">
          <h2>Machines</h2>
        </div>

        {/* LOADING */}
        {loading && <div className="loading">Waiting for live data...</div>}

        {/* GRID */}
        <div className="machine-grid">
          {machines.map((machine) => (
            <MachineCard
              key={machine.machine_id}
              machine={machine}
              onClick={handleMachineClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;