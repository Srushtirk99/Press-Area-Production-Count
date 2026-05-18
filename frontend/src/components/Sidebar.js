import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import "./Sidebar.css";

export default function Layout({ title, children, onLogout }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Sidebar>
      <div className="page-wrapper">
        <div className="topbar">
          <h2 className="logo">{title}</h2>

          <div className="topbar-right">
            <span className="live-dot"></span>
            <span className="clock">{time.toLocaleTimeString()}</span>
            <span className="user">👤 AA</span>
            <button className="logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>

        {children}
      </div>
    </Sidebar>
  );
}