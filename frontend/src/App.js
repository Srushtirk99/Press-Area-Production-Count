import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";

// ✅ Fast load pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";


// ✅ Lazy loaded pages
const RealTime = lazy(() => import("./pages/RealTime"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminProfile = lazy(() => import("./pages/AdminProfile"));
const MachineLogs = lazy(() => import("./pages/MachineLogs"));
const Alarms = lazy(() => import("./pages/Alarms"));
const WorkOrder = lazy(() => import("./pages/WorkOrder"));   // ✅ NEW PAGE

// 🔒 Protected Route
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/" />;
  return children;
}

function App() {
  return (
    <Router>

      {/* ✅ Lazy loading fallback */}
      <Suspense fallback={<div style={{ color: "white", padding: "20px" }}>Loading...</div>}>

        <Routes>

          {/* PUBLIC */}
          <Route path="/" element={<Login />} />

          {/* DASHBOARD */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* MACHINE LOGS */}
          <Route
            path="/machine/:id"
            element={
              <ProtectedRoute>
                <MachineLogs />
              </ProtectedRoute>
            }
          />

          {/* REAL TIME */}
          <Route
            path="/real-time"
            element={
              <ProtectedRoute>
                <RealTime />
              </ProtectedRoute>
            }
          />

          {/* REPORTS */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />

          {/* ✅ NEW WORK ORDER PAGE */}
          <Route
            path="/workorders"
            element={
              <ProtectedRoute>
                <WorkOrder />
              </ProtectedRoute>
            }
          />

          {/* ALARMS */}
          <Route
            path="/alarms"
            element={
              <ProtectedRoute>
                <Alarms />
              </ProtectedRoute>
            }
          />

          {/* SETTINGS */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* ADMIN */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminProfile />
              </ProtectedRoute>
            }
          />

          {/* FALLBACK ROUTE */}
          <Route path="*" element={<Navigate to="/dashboard" />} />

        </Routes>

      </Suspense>

    </Router>
  );
}

export default App;