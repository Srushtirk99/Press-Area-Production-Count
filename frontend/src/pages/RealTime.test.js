import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

import RealTime from "./RealTime";
import dashboardReducer from "../redux/slices/dashboardSlice";

const mockNavigate = jest.fn();

let mockSocketInstance = null;
let mockDashboardDataHandler = null;
let mockConnectShouldReturnSocket = true;


// =========================
// SOCKET MOCK FACTORY
// =========================
const createMockSocket = () => ({
  on: jest.fn((event, handler) => {

    if (event === "dashboardData") {
      mockDashboardDataHandler = handler;
    }

  }),

  off: jest.fn(),

  disconnect: jest.fn(),
});


// =========================
// ROUTER MOCK
// =========================
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),

  useNavigate: () => mockNavigate,
}));


// =========================
// SOCKET MOCK
// =========================
jest.mock("../socket", () => ({

  connectSocket: () =>
    (mockConnectShouldReturnSocket
      ? mockSocketInstance
      : null),

  getSocket: () => mockSocketInstance,

}));


// =========================
// STORE RENDER
// =========================
const renderRealTime = (preloadedState) => {

  const store = configureStore({
    reducer: {
      dashboard: dashboardReducer,
    },

    preloadedState,
  });

  return render(
    <Provider store={store}>
      <RealTime />
    </Provider>
  );
};


// =========================
// TESTS
// =========================
describe("RealTime Page", () => {

  beforeEach(() => {

    jest.clearAllMocks();

    mockDashboardDataHandler = null;

    mockConnectShouldReturnSocket = true;

    mockSocketInstance = createMockSocket();

  });


  // =========================
  // PAGE RENDER
  // =========================
  test("renders realtime page title", () => {

    renderRealTime({
      dashboard: {
        machines: [],
        loading: false,
      },
    });

    expect(
      screen.getByText(/Real-Time Production Monitoring/i)
    ).toBeInTheDocument();

  });


  // =========================
  // BACK BUTTON
  // =========================
  test("back button navigates to dashboard", async () => {

    const user = userEvent.setup();

    renderRealTime({
      dashboard: {
        machines: [],
        loading: false,
      },
    });

    await user.click(
      screen.getByRole("button", { name: /back/i })
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      "/dashboard"
    );

  });


  // =========================
  // SOCKET CONNECT
  // =========================
  test("connects socket on mount", async () => {

    renderRealTime({
      dashboard: {
        machines: [],
        loading: false,
      },
    });

    await waitFor(() => {

      expect(mockSocketInstance.on).toHaveBeenCalled();

    });

  });


  // =========================
  // SOCKET EVENT LISTENER
  // =========================
  test("registers dashboardData listener", async () => {

    renderRealTime({
      dashboard: {
        machines: [],
        loading: false,
      },
    });

    await waitFor(() => {

      expect(mockSocketInstance.on).toHaveBeenCalledWith(
        "dashboardData",
        expect.any(Function)
      );

    });

  });


  // =========================
  // LIVE SOCKET → REDUX UPDATE
  // =========================
  test("updates UI when socket sends dashboard data", async () => {

    renderRealTime({
      dashboard: {
        machines: [],
        loading: false,
      },
    });

    await waitFor(() => {

      expect(mockDashboardDataHandler)
        .toEqual(expect.any(Function));

    });

    const liveMachines = [

      {
        machine_id: 1,
        machine_name: "Press Machine 1",
        total_today: 120,
        current_rate: 60,
        max_rate: 100,
        efficiency: 60,
      },

      {
        machine_id: 2,
        machine_name: "Press Machine 2",
        total_today: 40,
        current_rate: 0,
        max_rate: 80,
        efficiency: 0,
      },

    ];

    await act(async () => {

      mockDashboardDataHandler(liveMachines);

    });

    expect(
      await screen.findByText(/Press Machine 1/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Press Machine 2/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText("120")
    ).toBeInTheDocument();

    expect(
      screen.getByText("60")
    ).toBeInTheDocument();

    expect(
      screen.getByText("100")
    ).toBeInTheDocument();

    expect(
      screen.getByText("60%")
    ).toBeInTheDocument();

  });


  // =========================
  // RUNNING STATUS
  // =========================
  test("shows running status correctly", () => {

    renderRealTime({
      dashboard: {
        loading: false,

        machines: [
          {
            machine_id: 1,
            machine_name: "Running Machine",
            total_today: 50,
            current_rate: 25,
            max_rate: 80,
            efficiency: 31,
          },
        ],
      },
    });

    const statusDot =
      document.querySelector(".status-dot.running");

    expect(statusDot).toBeInTheDocument();

  });


  // =========================
  // STOPPED STATUS
  // =========================
  test("shows stopped status correctly", () => {

    renderRealTime({
      dashboard: {
        loading: false,

        machines: [
          {
            machine_id: 2,
            machine_name: "Stopped Machine",
            total_today: 0,
            current_rate: 0,
            max_rate: 80,
            efficiency: 0,
          },
        ],
      },
    });

    const statusDot =
      document.querySelector(".status-dot.stopped");

    expect(statusDot).toBeInTheDocument();

  });


  // =========================
  // MULTIPLE MACHINES
  // =========================
  test("renders multiple machine panels", () => {

    renderRealTime({
      dashboard: {
        loading: false,

        machines: [

          {
            machine_id: 1,
            machine_name: "Machine 1",
            total_today: 100,
            current_rate: 40,
            max_rate: 80,
            efficiency: 50,
          },

          {
            machine_id: 2,
            machine_name: "Machine 2",
            total_today: 200,
            current_rate: 60,
            max_rate: 120,
            efficiency: 50,
          },

        ],
      },
    });

    expect(
      screen.getByText(/Machine 1/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Machine 2/i)
    ).toBeInTheDocument();

  });


  // =========================
  // EMPTY MACHINE LIST
  // =========================
  test("handles empty machines list", () => {

    renderRealTime({
      dashboard: {
        machines: [],
        loading: false,
      },
    });

    expect(
      screen.getByText(/Real-Time Production Monitoring/i)
    ).toBeInTheDocument();

  });


  // =========================
  // RESPONSIVE / MOBILE
  // =========================
  test("renders correctly on small viewport", () => {

    const originalWidth = window.innerWidth;

    window.innerWidth = 375;

    window.dispatchEvent(new Event("resize"));

    renderRealTime({
      dashboard: {
        loading: false,

        machines: [
          {
            machine_id: 1,
            machine_name: "Mobile Machine",
            total_today: 10,
            current_rate: 5,
            max_rate: 20,
            efficiency: 25,
          },
        ],
      },
    });

    expect(
      screen.getByText(/Mobile Machine/i)
    ).toBeInTheDocument();

    window.innerWidth = originalWidth;

    window.dispatchEvent(new Event("resize"));

  });


  // =========================
  // SOCKET CLEANUP
  // =========================
  test("removes socket listener on unmount", () => {

    const { unmount } = renderRealTime({
      dashboard: {
        machines: [],
        loading: false,
      },
    });

    unmount();

    expect(mockSocketInstance.off)
      .toHaveBeenCalledWith(
        "dashboardData",
        expect.any(Function)
      );

  });


  // =========================
  // SOCKET FAILURE
  // =========================
  test("renders safely if socket connection fails", () => {

    mockConnectShouldReturnSocket = false;

    renderRealTime({
      dashboard: {
        machines: [],
        loading: false,
      },
    });

    expect(
      screen.getByText(/Real-Time Production Monitoring/i)
    ).toBeInTheDocument();

  });

});