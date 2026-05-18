import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import Dashboard from "./Dashboard";
import dashboardReducer from "../redux/slices/dashboardSlice";

const mockNavigate = jest.fn();

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../socket", () => ({
  connectSocket: () => mockSocket,
  getSocket: () => mockSocket,
}));

jest.mock("../api", () => ({
  UPLOADS_URL: "http://localhost:5000/uploads",
}));


// =========================
// RENDER WITH STORE
// =========================
const renderDashboard = (preloadedState) => {

  const store = configureStore({
    reducer: {
      dashboard: dashboardReducer,
    },
    preloadedState,
  });

  return render(
    <Provider store={store}>
      <Dashboard />
    </Provider>
  );
};


describe("Dashboard Page", () => {

  beforeEach(() => {

    jest.clearAllMocks();

    localStorage.setItem("token", "fake-token");

    localStorage.setItem("adminName", "Admin");

  });


  // =========================
  // PAGE RENDER
  // =========================
  test("renders dashboard title", () => {

    renderDashboard({
      dashboard: {
        machines: [],
        loading: false,
      },
    });

    expect(
      screen.getByText(/Press Dashboard/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Machines/i)
    ).toBeInTheDocument();

  });


  // =========================
  // LOADING STATE
  // =========================
  test("shows loading state", () => {

    renderDashboard({
      dashboard: {
        machines: [],
        loading: true,
      },
    });

    expect(
      screen.getByText(/Waiting for live data/i)
    ).toBeInTheDocument();

  });


  // =========================
  // MACHINE CARDS
  // =========================
  test("renders machine cards correctly", () => {

    renderDashboard({
      dashboard: {
        loading: false,
        machines: [
          {
            machine_id: 1,
            machine_name: "Press Machine 1",
            image: "machine1.png",
            total_today: 120,
            window_5min_count: 5,
            window_30min_count: 10,
            current_rate: 60,
            max_rate: 100,
            efficiency: 60,
            unallocated_total: 15,
          },
        ],
      },
    });

    expect(
      screen.getByText(/Press Machine 1/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Total Production Today/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText("120")
    ).toBeInTheDocument();

    expect(
      screen.getByText("15")
    ).toBeInTheDocument();

  });


  // =========================
  // MACHINE STATUS
  // =========================
  test("shows running status correctly", () => {

    renderDashboard({
      dashboard: {
        loading: false,
        machines: [
          {
            machine_id: 1,
            machine_name: "Machine A",
            image: "m1.png",
            total_today: 100,
            window_5min_count: 5,
            window_30min_count: 10,
            current_rate: 50,
            max_rate: 80,
            efficiency: 62,
            unallocated_total: 5,
          },
        ],
      },
    });

    expect(
      screen.getByText(/Running/i)
    ).toBeInTheDocument();

  });


  // =========================
  // MACHINE CLICK NAVIGATION
  // =========================
  test("navigates to machine logs page on card click", async () => {

    const user = userEvent.setup();

    renderDashboard({
      dashboard: {
        loading: false,
        machines: [
          {
            machine_id: 10,
            machine_name: "Machine 10",
            image: "m10.png",
            total_today: 50,
            window_5min_count: 0,
            window_30min_count: 0,
            current_rate: 0,
            max_rate: 80,
            efficiency: 0,
            unallocated_total: 0,
          },
        ],
      },
    });

    await user.click(
      screen.getByText(/Machine 10/i)
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      "/machine/10"
    );

  });


  // =========================
  // SIDEBAR NAVIGATION
  // =========================
  test("sidebar buttons navigate correctly", async () => {

    const user = userEvent.setup();

    renderDashboard({
      dashboard: {
        machines: [],
        loading: false,
      },
    });

    await user.click(
      screen.getByText(/Real-Time/i)
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      "/real-time"
    );

  });


  // =========================
  // LOGOUT
  // =========================
  test("logout clears localStorage and navigates", async () => {

    const user = userEvent.setup();

    renderDashboard({
      dashboard: {
        machines: [],
        loading: false,
      },
    });

    await user.click(
      screen.getByText(/Logout/i)
    );

    expect(
      localStorage.getItem("token")
    ).toBeNull();

    expect(mockSocket.disconnect).toHaveBeenCalled();

    expect(mockNavigate).toHaveBeenCalledWith(
      "/",
      { replace: true }
    );

  });


  // =========================
  // SOCKET CONNECTION
  // =========================
  test("connects socket on mount", async () => {

    renderDashboard({
      dashboard: {
        machines: [],
        loading: false,
      },
    });

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalled();
    });

  });


  // =========================
  // PROTECTED ROUTE
  // =========================
  test("redirects to login if token missing", async () => {

    localStorage.clear();

    renderDashboard({
      dashboard: {
        machines: [],
        loading: false,
      },
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

  });

});