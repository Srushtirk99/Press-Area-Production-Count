// socket.js
import { io } from "socket.io-client";
import { BASE_URL } from "./api";

// 🔥 Persist socket across hot reloads
let socket = window.__socket || null;

// =======================
// CONNECT SOCKET (JWT AUTH)
// =======================
export const connectSocket = () => {
  const token = localStorage.getItem("token");

  if (!token) {
    console.warn("⚠️ No token found. Socket not connected.");
    return null;
  }

  // ✅ Reuse existing connection (prevents duplicates)
  if (socket && socket.connected) {
    return socket;
  }

  // 🔥 Extra safety (cleanup old ghost socket if any)
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  // =======================
  // CREATE NEW SOCKET
  // =======================
  socket = io(BASE_URL, {
    auth: {
      token: token, // ✅ JWT sent during handshake
    },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  // 🔥 Store globally so HMR won't lose it
  window.__socket = socket;

  // =======================
  // EVENTS
  // =======================
  socket.on("connect", () => {
    console.log("🔌 Socket connected:", socket.id);

    // request initial data once
    socket.emit("request_dashboard_data");
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.error("❌ Connection error:", err.message);
  });

  return socket;
};

// =======================
// GET EXISTING SOCKET
// =======================
export const getSocket = () => socket;