import { useEffect, useRef, useMemo, memo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchMachineLogs } from "../redux/slices/machineLogsSlice";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList
} from "recharts";

import "./MachineLogs.css";

// =======================
// WINDOW WIDTH HOOK
// =======================
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
}

// =======================
// ✅ CUSTOM LABEL (hide 0 values)
// =======================
const RenderLabel = (props) => {
  const { x, y, width, value } = props;

  if (!value || Number(value) === 0) return null;

  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      fill="#e5e7eb"
      fontSize={12}
    >
      {value}
    </text>
  );
};

// =======================
// ✅ MEMOIZED CHART
// =======================
const ProductionChart = memo(({ data, type, isMobile }) => {
  const chartHeight = isMobile ? 260 : 220;

  const safeMax = Math.max(
    ...data.map((item) => Number(item.production) || 0),
    1
  );

  const xAxisInterval =
    type === "daily"
      ? isMobile
        ? 3
        : 0
      : isMobile
      ? 1
      : 0;

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        margin={{
          top: 20,
          right: 15,
          left: 0,
          bottom: isMobile ? 30 : 20
        }}
      >
        <CartesianGrid stroke="#1e293b" />

        <XAxis
          dataKey={type === "hourly" ? "hour" : "day"}
          stroke="#94a3b8"
          interval={xAxisInterval}
          tick={{ fontSize: isMobile ? 10 : 12 }}
          axisLine={true}
          tickLine={true}
        />

        <YAxis
          stroke="#94a3b8"
          width={isMobile ? 30 : 40}
          tick={{ fontSize: isMobile ? 10 : 12 }}
          domain={[0, safeMax + safeMax * 0.2]}
          allowDecimals={false}
          axisLine={true}
          tickLine={true}
        />

        <Tooltip />

        <Bar
          dataKey="production"
          fill={type === "hourly" ? "#38bdf8" : "#d8ae23"}
        >
          <LabelList content={<RenderLabel />} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});
// =======================
// MAIN COMPONENT
// =======================
function MachineLogs() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;

  const { machine, hourly, daily, loading } = useSelector(
    (state) => state.machineLogs
  );

  const intervalRef = useRef(null);

  // =======================
  // FETCH DATA (SMART)
  // =======================
  const loadData = () => {
    if (document.visibilityState === "visible") {
      dispatch(fetchMachineLogs(id));
    }
  };

  useEffect(() => {
    loadData();

    intervalRef.current = setInterval(loadData, 10000);

    return () => clearInterval(intervalRef.current);
  }, [id, dispatch]);

  // =======================
  // ✅ MEMOIZED HOURLY DATA
  // =======================
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      production: 0
    }));

    hourly.forEach((item) => {
      if (hours[item.hour]) {
        hours[item.hour].production = Number(item.production);
      }
    });

    return hours;
  }, [hourly]);

  // =======================
  // ✅ MEMOIZED DAILY DATA
  // =======================
  const dailyData = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days = Array.from({ length: daysInMonth }, (_, i) => ({
      day: `${String(i + 1).padStart(2, "0")}`,
      production: 0
    }));

    daily.forEach((d) => {
      const parts = d.day.split("-");
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const day = parseInt(parts[2]);

      if (year === currentYear && month === currentMonth) {
        const index = day - 1;
        if (index >= 0 && index < days.length) {
          days[index].production = Number(d.production);
        }
      }
    });

    return days;
  }, [daily]);

  if (loading || !machine) {
    return <div className="machine-logs-loading">Loading machine data...</div>;
  }

  return (
    <div className="machine-logs-page">
      {/* HEADER */}
      <div className="machine-logs-top-bar">
        <button className="machine-logs-back-btn" onClick={() => navigate("/dashboard")}>
          ← Back
        </button>

        <div className="machine-info">
          <h2>{machine.machine_name}</h2>
          <span>Machine ID: {machine.machine_id}</span>
        </div>
      </div>

      {/* HOURLY */}
      <div className="machine-logs-chart-card">
        <h3>Hourly Production (Today)</h3>
        <div className="machine-logs-chart-wrapper">
          <ProductionChart data={hourlyData} type="hourly" isMobile={isMobile} />
        </div>
      </div>

      {/* DAILY */}
      <div className="machine-logs-chart-card">
        <h3>Daily Production (This Month)</h3>
        <div className="machine-logs-chart-wrapper">
          <ProductionChart data={dailyData} type="daily" isMobile={isMobile} />
        </div>
      </div>
    </div>
  );
}

export default MachineLogs;