import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import API from "../../api";

// ✅ FETCH MACHINE + SUMMARY
export const fetchMachineLogs = createAsyncThunk(
  "machineLogs/fetchMachineLogs",
  async (machineId, { rejectWithValue }) => {
    try {
      const dashRes = await API.get("/dashboard");

      const machine = dashRes.data.data.find(
        (m) => String(m.machine_id) === String(machineId)
      );

      const summaryRes = await API.get(
        `/dashboard/production-summary/${machineId}`
      );

      return {
        machine,
        hourly: summaryRes.data.hourlyProduction,
        daily: summaryRes.data.dailyProduction,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data || "Error fetching logs");
    }
  }
);

const machineLogsSlice = createSlice({
  name: "machineLogs",
  initialState: {
    machine: null,
    hourly: [],
    daily: [],
    loading: false,
    error: null,
  },
  reducers: {},

  extraReducers: (builder) => {
    builder
      .addCase(fetchMachineLogs.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMachineLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.machine = action.payload.machine;
        state.hourly = action.payload.hourly;
        state.daily = action.payload.daily;
      })
      .addCase(fetchMachineLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default machineLogsSlice.reducer;