import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { MemoryRouter } from "react-router-dom";

import Reports from "./Reports";

const mockNavigate = jest.fn();

const mockGet = jest.fn();

const mockOpen = jest.fn();


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

  BASE_URL: "http://localhost:5000",

  default: {
    get: (...args) => mockGet(...args),
  },

}));


// =========================
// RENDER HELPER
// =========================
const renderReports = () => {

  return render(
    <MemoryRouter>
      <Reports />
    </MemoryRouter>
  );

};


// =========================
// MOCK DATA
// =========================
const mockMachines = {

  data: {
    data: [

      {
        id: 1,
        machine_name: "Press Machine 1",
      },

      {
        id: 2,
        machine_name: "Press Machine 2",
      },

    ],
  },

};


const mockReportData = {

  data: [

    {
      date: "2026-05-11",
      totalProduction: 120,
    },

    {
      date: "2026-05-12",
      totalProduction: 150,
    },

  ],

};


// =========================
// TESTS
// =========================
describe("Reports Page", () => {

  beforeEach(() => {

    jest.clearAllMocks();

    window.open = mockOpen;

    mockGet.mockImplementation((url) => {

      if (url === "/machines") {
        return Promise.resolve(mockMachines);
      }

      return Promise.resolve(mockReportData);

    });

  });


  test("renders reports page correctly", async () => {

    renderReports();

    expect(
      screen.getByText(/Production Reports/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Download Excel/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Download PDF/i)
    ).toBeInTheDocument();

  });


  test("fetches machines from API", async () => {

    renderReports();

    await waitFor(() => {

      expect(mockGet).toHaveBeenCalledWith(
        "/machines"
      );

    });

  });


  test("renders machine dropdown options", async () => {

    renderReports();

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

  });


  test("fetches daily combined report by default", async () => {

    renderReports();

    await waitFor(() => {

      expect(mockGet).toHaveBeenCalledWith(
        "/report/combined/daily"
      );

    });

  });


  test("changes report type correctly", async () => {

    const user = userEvent.setup();

    renderReports();

    const selects =
      screen.getAllByRole("combobox");

    await user.selectOptions(
      selects[0],
      "weekly"
    );

    await waitFor(() => {

      expect(mockGet).toHaveBeenCalledWith(
        "/report/combined/weekly"
      );

    });

  });


  test("changes machine correctly", async () => {

    const user = userEvent.setup();

    renderReports();

    await screen.findByText("Press Machine 1");

    const selects =
      screen.getAllByRole("combobox");

    await user.selectOptions(
      selects[1],
      "1"
    );

    await waitFor(() => {

      expect(mockGet).toHaveBeenCalledWith(
        "/report/machine/1/daily"
      );

    });

  });


  test("shows date range inputs for yearly reports", async () => {

    const user = userEvent.setup();

    renderReports();

    const selects =
      screen.getAllByRole("combobox");

    await user.selectOptions(
      selects[0],
      "yearly"
    );

    expect(
      screen.getAllByDisplayValue("").length
    ).toBeGreaterThan(0);

  });


  test("fetches yearly report with dates", async () => {

    const user = userEvent.setup();

    renderReports();

    const selects =
      screen.getAllByRole("combobox");

    await user.selectOptions(
      selects[0],
      "yearly"
    );

    const dateInputs =
      screen.getAllByDisplayValue("");

    await user.type(
      dateInputs[0],
      "2026-01-01"
    );

    await user.type(
      dateInputs[1],
      "2026-12-31"
    );

    await waitFor(() => {

      expect(mockGet).toHaveBeenCalled();

    });

  });


  test("renders report table data", async () => {

    renderReports();

    expect(
      await screen.findByText("120")
    ).toBeInTheDocument();

    expect(
      screen.getByText("150")
    ).toBeInTheDocument();

  });


  test("renders no data state", async () => {

    mockGet.mockImplementation((url) => {

      if (url === "/machines") {
        return Promise.resolve(mockMachines);
      }

      return Promise.resolve({
        data: [],
      });

    });

    renderReports();

    expect(
      await screen.findByText(/No Data/i)
    ).toBeInTheDocument();

  });


  test("downloads excel report", async () => {

    const user = userEvent.setup();

    renderReports();

    await user.click(
      screen.getByText(/Download Excel/i)
    );

    expect(mockOpen)
      .toHaveBeenCalled();

  });


  test("downloads pdf report", async () => {

    const user = userEvent.setup();

    renderReports();

    await user.click(
      screen.getByText(/Download PDF/i)
    );

    expect(mockOpen)
      .toHaveBeenCalled();

  });


  test("shows alert if yearly dates missing", async () => {

    const user = userEvent.setup();

    window.alert = jest.fn();

    renderReports();

    const selects =
      screen.getAllByRole("combobox");

    await user.selectOptions(
      selects[0],
      "yearly"
    );

    await user.click(
      screen.getByText(/Download Excel/i)
    );

    expect(window.alert)
      .toHaveBeenCalledWith(
        "Select date range"
      );

  });


  test("back button navigates to dashboard", async () => {

    const user = userEvent.setup();

    renderReports();

    await user.click(
      screen.getByText(/Back/i)
    );

    expect(mockNavigate)
      .toHaveBeenCalledWith(
        "/dashboard"
      );

  });


  test("handles API failure safely", async () => {

    mockGet.mockRejectedValue(
      new Error("API Failed")
    );

    renderReports();

    await waitFor(() => {

      expect(mockGet)
        .toHaveBeenCalled();

    });

    expect(
      screen.getByText(/Production Reports/i)
    ).toBeInTheDocument();

  });

});