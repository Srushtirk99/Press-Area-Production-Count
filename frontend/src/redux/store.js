import { configureStore } from "@reduxjs/toolkit";
import dashboardReducer from "./slices/dashboardSlice";
import machineLogsReducer from "./slices/machineLogsSlice"; // ✅ ADD THIS

export const store = configureStore({
  reducer: {
    dashboard: dashboardReducer,
    machineLogs: machineLogsReducer, // ✅ ADD THIS
  },
});