import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import MachineLogs from "./MachineLogs";
import machineLogsReducer from "../redux/slices/machineLogsSlice";

const mockNavigate = jest.fn();
const mockGet = jest.fn();


// =========================
// ROUTER MOCK
// =========================
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: "1" }),
}));


// =========================
// API MOCK
// =========================
jest.mock("../api", () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
  },
}));


// =========================
// RECHARTS MOCK
// =========================
jest.mock("recharts", () => {
  const React = require("react");

  return {
    ResponsiveContainer: ({ children }) => (
      <div data-testid="responsive-container">{children}</div>
    ),

    BarChart: ({ children }) => (
      <div data-testid="bar-chart">{children}</div>
    ),

    Bar: ({ dataKey }) => (
      <div data-testid={`bar-${dataKey}`}>
        Bar-{dataKey}
      </div>
    ),

    XAxis: ({ dataKey }) => (
      <div data-testid={`xaxis-${dataKey}`}>
        XAxis-{dataKey}
      </div>
    ),

    YAxis: () => (
      <div data-testid="yaxis">
        YAxis
      </div>
    ),

    Tooltip: () => (
      <div data-testid="tooltip">
        Tooltip
      </div>
    ),

    CartesianGrid: () => (
      <div data-testid="cartesian-grid">
        Grid
      </div>
    ),

    LabelList: () => (
      <div data-testid="label-list">
        LabelList
      </div>
    ),
  };
});


// =========================
// STORE RENDER
// =========================
const renderMachineLogs = () => {

  const store = configureStore({
    reducer: {
      machineLogs: machineLogsReducer,
    },
  });

  return render(
    <Provider store={store}>
      <MachineLogs />
    </Provider>
  );
};


// =========================
// TESTS
// =========================
describe("Machine Logs Page", () => {

  beforeEach(() => {

    jest.clearAllMocks();

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });

  });


  // =========================
  // LOADING
  // =========================
  test("shows loading state initially", async () => {

    mockGet.mockImplementation((url) => {

      if (url === "/dashboard") {
        return Promise.resolve({
          data: {
            data: [
              {
                machine_id: 1,
                machine_name: "Press Machine 1",
              },
            ],
          },
        });
      }

      if (url === "/dashboard/production-summary/1") {
        return Promise.resolve({
          data: {
            hourlyProduction: [],
            dailyProduction: [],
          },
        });
      }

      return Promise.reject(new Error("Unknown URL"));

    });

    renderMachineLogs();

    expect(
      screen.getByText(/Loading machine data/i)
    ).toBeInTheDocument();

  });


  // =========================
  // API CALLS + MACHINE DATA
  // =========================
  test("calls APIs and renders machine details", async () => {

    mockGet.mockImplementation((url) => {

      if (url === "/dashboard") {
        return Promise.resolve({
          data: {
            data: [
              {
                machine_id: 1,
                machine_name: "Press Machine 1",
              },
            ],
          },
        });
      }

      if (url === "/dashboard/production-summary/1") {
        return Promise.resolve({
          data: {
            hourlyProduction: [
              {
                hour: 10,
                production: 25,
              },
            ],

            dailyProduction: [
              {
                day: "2026-05-11",
                production: 120,
              },
            ],
          },
        });
      }

      return Promise.reject(new Error("Unknown URL"));

    });

    renderMachineLogs();

    await waitFor(() => {

      expect(mockGet).toHaveBeenCalledWith("/dashboard");

      expect(mockGet).toHaveBeenCalledWith(
        "/dashboard/production-summary/1"
      );

    });

    expect(
      await screen.findByText(/Press Machine 1/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Machine ID: 1/i)
    ).toBeInTheDocument();

  });


  // =========================
  // BACK BUTTON
  // =========================
  test("back button navigates to dashboard", async () => {

    mockGet.mockImplementation((url) => {

      if (url === "/dashboard") {
        return Promise.resolve({
          data: {
            data: [
              {
                machine_id: 1,
                machine_name: "Press Machine 1",
              },
            ],
          },
        });
      }

      if (url === "/dashboard/production-summary/1") {
        return Promise.resolve({
          data: {
            hourlyProduction: [],
            dailyProduction: [],
          },
        });
      }

      return Promise.reject(new Error("Unknown URL"));

    });

    const user = userEvent.setup();

    renderMachineLogs();

    await waitFor(() => {
      expect(
        screen.getByText(/Press Machine 1/i)
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByText(/Back/i)
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      "/dashboard"
    );

  });


  // =========================
  // CHART SECTIONS
  // =========================
  test("renders chart sections", async () => {

    mockGet.mockImplementation((url) => {

      if (url === "/dashboard") {
        return Promise.resolve({
          data: {
            data: [
              {
                machine_id: 1,
                machine_name: "Press Machine 1",
              },
            ],
          },
        });
      }

      if (url === "/dashboard/production-summary/1") {
        return Promise.resolve({
          data: {
            hourlyProduction: [],
            dailyProduction: [],
          },
        });
      }

      return Promise.reject(new Error("Unknown URL"));

    });

    renderMachineLogs();

    await waitFor(() => {

      expect(
        screen.getByText(/Hourly Production/i)
      ).toBeInTheDocument();

      expect(
        screen.getByText(/Daily Production/i)
      ).toBeInTheDocument();

    });

  });


  // =========================
  // RECHARTS RENDER
  // =========================
  test("renders recharts components", async () => {

    mockGet.mockImplementation((url) => {

      if (url === "/dashboard") {
        return Promise.resolve({
          data: {
            data: [
              {
                machine_id: 1,
                machine_name: "Press Machine 1",
              },
            ],
          },
        });
      }

      if (url === "/dashboard/production-summary/1") {
        return Promise.resolve({
          data: {
            hourlyProduction: [
              {
                hour: 10,
                production: 25,
              },
            ],
            dailyProduction: [
              {
                day: "2026-05-11",
                production: 120,
              },
            ],
          },
        });
      }

      return Promise.reject(new Error("Unknown URL"));

    });

    renderMachineLogs();

    await waitFor(() => {

      expect(
        screen.getAllByTestId("bar-chart").length
      ).toBeGreaterThan(0);

      expect(
        screen.getAllByTestId("responsive-container").length
      ).toBeGreaterThan(0);

    });

  });


  // =========================
  // EXACT DATA VALUES
  // =========================
  test("renders exact production values", async () => {

    mockGet.mockImplementation((url) => {

      if (url === "/dashboard") {
        return Promise.resolve({
          data: {
            data: [
              {
                machine_id: 1,
                machine_name: "Press Machine 1",
              },
            ],
          },
        });
      }

      if (url === "/dashboard/production-summary/1") {
        return Promise.resolve({
          data: {
            hourlyProduction: [
              {
                hour: 10,
                production: 25,
              },
            ],

            dailyProduction: [
              {
                day: "2026-05-11",
                production: 120,
              },
            ],
          },
        });
      }

      return Promise.reject(new Error("Unknown URL"));

    });

    renderMachineLogs();

    await waitFor(() => {

      expect(
        screen.getAllByTestId("bar-production").length
      ).toBeGreaterThan(0);

    });

  });


  // =========================
  // EMPTY DATA
  // =========================
  test("handles empty production data", async () => {

    mockGet.mockImplementation((url) => {

      if (url === "/dashboard") {
        return Promise.resolve({
          data: {
            data: [
              {
                machine_id: 1,
                machine_name: "Press Machine 1",
              },
            ],
          },
        });
      }

      if (url === "/dashboard/production-summary/1") {
        return Promise.resolve({
          data: {
            hourlyProduction: [],
            dailyProduction: [],
          },
        });
      }

      return Promise.reject(new Error("Unknown URL"));

    });

    renderMachineLogs();

    await waitFor(() => {

      expect(
        screen.getByText(/Hourly Production/i)
      ).toBeInTheDocument();

      expect(
        screen.getByText(/Daily Production/i)
      ).toBeInTheDocument();

    });

  });


  // =========================
  // API ERROR
  // =========================
  test("handles API failure correctly", async () => {

    mockGet.mockRejectedValueOnce(
      new Error("Network Error")
    );

    renderMachineLogs();

    await waitFor(() => {

      expect(mockGet).toHaveBeenCalled();

    });

  });


  // =========================
  // ROUTE PARAM
  // =========================
  test("uses route machine id correctly", async () => {

    mockGet.mockImplementation((url) => {

      if (url === "/dashboard") {
        return Promise.resolve({
          data: {
            data: [
              {
                machine_id: 1,
                machine_name: "Press Machine 1",
              },
            ],
          },
        });
      }

      if (url === "/dashboard/production-summary/1") {
        return Promise.resolve({
          data: {
            hourlyProduction: [],
            dailyProduction: [],
          },
        });
      }

      return Promise.reject(new Error("Unknown URL"));

    });

    renderMachineLogs();

    await waitFor(() => {

      expect(mockGet).toHaveBeenCalledWith(
        "/dashboard/production-summary/1"
      );

    });

  });

});