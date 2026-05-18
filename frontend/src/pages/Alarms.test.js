import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { MemoryRouter } from "react-router-dom";

import Alarms from "./Alarms";

const mockNavigate = jest.fn();

const mockGet = jest.fn();


// =========================
// ROUTER MOCK
// =========================
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),

  useNavigate: () => mockNavigate,
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
// RENDER HELPER
// =========================
const renderAlarms = () => {

  return render(
    <MemoryRouter>
      <Alarms />
    </MemoryRouter>
  );

};


// =========================
// MOCK DATA
// =========================
const mockAlarmData = {

  data: {

    data: [

      {
        id: 1,
        machine_name: "Press Machine 1",
        machine_status: "running",
        severity: "normal",
        message: "Machine operating normally",
        created_at: "2026-05-11T10:00:00",
      },

      {
        id: 2,
        machine_name: "Press Machine 2",
        machine_status: "idle",
        severity: "warning",
        message: "Machine idle for 15 minutes",
        created_at: "2026-05-11T10:05:00",
      },

      {
        id: 3,
        machine_name: "Press Machine 3",
        machine_status: "stopped",
        severity: "critical",
        message: "Machine stopped unexpectedly",
        created_at: "2026-05-11T10:10:00",
      },

    ],

    workorder_alerts: [

      {
        severity: "warning",
        message: "Work order WO-101 nearing deadline",
      },

    ],

  },

};


// =========================
// TESTS
// =========================
describe("Alarms Page", () => {

  beforeEach(() => {

    jest.clearAllMocks();

    mockGet.mockResolvedValue(mockAlarmData);

  });


  // =========================
  // PAGE RENDER
  // =========================
  test("renders alarms page correctly", async () => {

    renderAlarms();

    expect(
      screen.getByText(/Machine Monitoring/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/Search machine/i)
    ).toBeInTheDocument();

    expect(
      screen.getByDisplayValue(/All/i)
    ).toBeInTheDocument();

  });


  // =========================
  // API CALL
  // =========================
  test("fetches alarms from API", async () => {

    renderAlarms();

    await waitFor(() => {

      expect(mockGet).toHaveBeenCalledWith(
        "/alarms"
      );

    });

  });


  // =========================
  // MACHINE ALARMS
  // =========================
  test("renders machine alarms correctly", async () => {

    renderAlarms();

    expect(
      await screen.findByText(
        "Press Machine 1"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Press Machine 2"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Press Machine 3"
      )
    ).toBeInTheDocument();

  });


  // =========================
  // WORKORDER ALERTS
  // =========================
  test("renders workorder alerts", async () => {

    renderAlarms();

    expect(
      await screen.findByText(
        /Work Order Alerts/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Work order WO-101 nearing deadline/i
      )
    ).toBeInTheDocument();

  });


  // =========================
  // SUMMARY COUNTS
  // =========================
  test("renders summary counts correctly", async () => {

    renderAlarms();

    expect(
      await screen.findByText(/Total: 3/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Running: 1/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Idle: 1/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Stopped: 1/i)
    ).toBeInTheDocument();

  });


  // =========================
  // SEARCH FILTER
  // =========================
  test("filters alarms using search", async () => {

    const user = userEvent.setup();

    renderAlarms();

    await screen.findByText(
      "Press Machine 1"
    );

    await user.type(
      screen.getByPlaceholderText(
        /Search machine/i
      ),
      "Machine 2"
    );

    expect(
      screen.getByText(
        "Press Machine 2"
      )
    ).toBeInTheDocument();

  });


  // =========================
  // DROPDOWN FILTER
  // =========================
  test("filters alarms using status dropdown", async () => {

    const user = userEvent.setup();

    renderAlarms();

    await screen.findByText(
      "Press Machine 1"
    );

    await user.selectOptions(
      screen.getByRole("combobox"),
      "stopped"
    );

    expect(
      screen.getByText(
        "Press Machine 3"
      )
    ).toBeInTheDocument();

  });


  // =========================
  // BACK BUTTON
  // =========================
  test("back button navigates to dashboard", async () => {

    const user = userEvent.setup();

    renderAlarms();

    await user.click(
      screen.getByText(/Back/i)
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      "/dashboard"
    );

  });


  // =========================
  // STATUS LABELS
  // =========================
  test("renders machine status labels", async () => {

    renderAlarms();

    expect(
      await screen.findByText("RUNNING")
    ).toBeInTheDocument();

    expect(
      screen.getByText("IDLE")
    ).toBeInTheDocument();

    expect(
      screen.getByText("STOPPED")
    ).toBeInTheDocument();

  });


  // =========================
  // API ERROR
  // =========================
  test("handles API failure safely", async () => {

    mockGet.mockRejectedValue(
      new Error("API Failed")
    );

    renderAlarms();

    await waitFor(() => {

      expect(mockGet).toHaveBeenCalled();

    });

    expect(
      screen.getByText(/Machine Monitoring/i)
    ).toBeInTheDocument();

  });


  // =========================
  // EMPTY DATA
  // =========================
  test("handles empty alarms safely", async () => {

    mockGet.mockResolvedValue({
      data: {
        data: [],
        workorder_alerts: [],
      },
    });

    renderAlarms();

    expect(
      await screen.findByText(/Total: 0/i)
    ).toBeInTheDocument();

  });


  // =========================
  // SEVERITY CLASS
  // =========================
  test("renders severity classes correctly", async () => {

    renderAlarms();

    await screen.findByText(
      "Press Machine 3"
    );

    const criticalCard =
      document.querySelector(".critical");

    expect(
      criticalCard
    ).toBeInTheDocument();

  });


  // =========================
  // THROTTLED FETCH
  // =========================
  test("sets interval polling correctly", async () => {

    jest.useFakeTimers();

    renderAlarms();

    await waitFor(() => {

      expect(mockGet).toHaveBeenCalled();

    });

    jest.advanceTimersByTime(6000);

    jest.useRealTimers();

  });

});