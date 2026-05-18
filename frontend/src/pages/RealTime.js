import { useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setMachines } from "../redux/slices/dashboardSlice";
import { connectSocket, getSocket } from "../socket";
import "./RealTime.css";

// =======================
// ✅ MEMOIZED MACHINE PANEL
// =======================
const MachinePanel = memo(({ machine }) => {
  const status = machine.current_rate > 0 ? "running" : "stopped";

  return (
    <div className="machine-panel">
      <div className="machine-header">
        <h3>{machine.machine_name}</h3>
        <div className={`status-dot ${status}`} />
      </div>

      <div className="kpi-grid">
        <div className="kpi-box">
          <label>Total production today</label>
          <span>{machine.total_today}</span>
        </div>

        <div className="kpi-box">
          <label>Current Rate /hr</label>
          <span>{machine.current_rate}</span>
        </div>

        <div className="kpi-box">
          <label>Max Rate</label>
          <span>{machine.max_rate}</span>
        </div>

        <div className="kpi-box">
          <label>Efficiency</label>
          <span>{machine.efficiency}%</span>
        </div>
      </div>
    </div>
  );
});

// =======================
// MAIN COMPONENT
// =======================
function RealTime() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { machines } = useSelector((state) => state.dashboard);

  // =======================
  // 🔥 SOCKET CONNECTION
  // =======================
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const handleData = (data) => {
      dispatch(setMachines(data));
    };

    socket.on("dashboardData", handleData);

    return () => {
      socket.off("dashboardData", handleData);
    };
  }, [dispatch]);

  const handleBack = () => {
    navigate("/dashboard");
  };

  return (
    <div className="realtime-page">
      <div className="top-bar">
        <button className="back-btn" onClick={handleBack}>
          ← Back
        </button>
      </div>

      <div className="realtime-header">
        Real-Time Production Monitoring
      </div>

      <div className="machine-grid">
        {machines.map((machine) => (
          <MachinePanel
            key={machine.machine_id}
            machine={machine}
          />
        ))}
      </div>
    </div>
  );
}

export default RealTime;