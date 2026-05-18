import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  machines: [],
  loading: true,
};

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    setMachines: (state, action) => {
      state.machines = action.payload;
      state.loading = false;
    },
  },
});

export const { setMachines } = dashboardSlice.actions;
export default dashboardSlice.reducer;