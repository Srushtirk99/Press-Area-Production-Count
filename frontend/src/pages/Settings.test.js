import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { MemoryRouter } from "react-router-dom";

import Settings from "./Settings";

const mockNavigate = jest.fn();

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

const mockUser = {
  role: "admin",
};


// =========================
// ROUTER MOCK
// =========================
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),

  useNavigate: () => mockNavigate,
}));


// =========================
// AUTH CONTEXT MOCK
// =========================
jest.mock("../context/AuthContext", () => ({

  useAuth: () => ({
    user: mockUser,
  }),

}));


// =========================
// API MOCK
// =========================
jest.mock("../api", () => ({

  __esModule: true,

  UPLOADS_URL: "http://localhost:5000/uploads",

  default: {

    get: (...args) => mockGet(...args),

    post: (...args) => mockPost(...args),

    put: (...args) => mockPut(...args),

    delete: (...args) => mockDelete(...args),

  },

}));


// =========================
// RENDER HELPER
// =========================
const renderSettings = () => {

  return render(
    <MemoryRouter>
      <Settings />
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
        cycle_time: 10,
        image: "machine1.jpg",
      },

      {
        id: 2,
        machine_name: "Press Machine 2",
        cycle_time: 20,
        image: "machine2.jpg",
      },

    ],

  },

};


// =========================
// TESTS
// =========================
describe("Settings Page", () => {

  beforeEach(() => {

    jest.clearAllMocks();

    mockGet.mockResolvedValue(
      mockMachines
    );

  });


  // =========================
  // PAGE RENDER
  // =========================
  test("renders settings page correctly", async () => {

    renderSettings();

    expect(
      screen.getByText(/Machine Configuration/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Machine Settings/i)
    ).toBeInTheDocument();

  });


  // =========================
  // FETCH MACHINES
  // =========================
  test("fetches machines from API", async () => {

    renderSettings();

    await waitFor(() => {

      expect(mockGet).toHaveBeenCalledWith(
        "/machines"
      );

    });

  });


  // =========================
  // MACHINE LIST
  // =========================
  test("renders machine list correctly", async () => {

    renderSettings();

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


  // =========================
  // SELECT MACHINE
  // =========================
  test("selects machine correctly", async () => {

    const user = userEvent.setup();

    renderSettings();

    await screen.findByText(
      "Press Machine 1"
    );

    await user.click(
      screen.getByText(
        "Press Machine 1"
      )
    );

    expect(
      screen.getByDisplayValue(
        "Press Machine 1"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByDisplayValue(
        "10"
      )
    ).toBeInTheDocument();

  });


  // =========================
  // ADD MACHINE
  // =========================
  test("adds machine successfully", async () => {

    const user = userEvent.setup();

    window.alert = jest.fn();

    mockPost.mockResolvedValue({
      data: {
        success: true,
      },
    });

    renderSettings();

    const textInputs =
      screen.getAllByRole("textbox");

    await user.type(
      textInputs[0],
      "New Machine"
    );

    const numberInput =
      screen.getByRole("spinbutton");

    await user.type(
      numberInput,
      "15"
    );

    await user.click(
      screen.getByText(/Add Machine/i)
    );

    await waitFor(() => {

      expect(mockPost)
        .toHaveBeenCalled();

    });

    expect(window.alert)
      .toHaveBeenCalledWith(
        "Machine Added Successfully"
      );

  });


  // =========================
  // ADD VALIDATION
  // =========================
  test("shows validation for empty add fields", async () => {

    const user = userEvent.setup();

    window.alert = jest.fn();

    renderSettings();

    await user.click(
      screen.getByText(/Add Machine/i)
    );

    expect(window.alert)
      .toHaveBeenCalledWith(
        "Please enter machine name and cycle time"
      );

  });


  // =========================
  // UPDATE MACHINE
  // =========================
  test("updates machine successfully", async () => {

    const user = userEvent.setup();

    window.alert = jest.fn();

    mockPut.mockResolvedValue({
      data: {
        success: true,
      },
    });

    renderSettings();

    await screen.findByText(
      "Press Machine 1"
    );

    await user.click(
      screen.getByText(
        "Press Machine 1"
      )
    );

    const textInput =
      screen.getByDisplayValue(
        "Press Machine 1"
      );

    await user.clear(textInput);

    await user.type(
      textInput,
      "Updated Machine"
    );

    await user.click(
      screen.getByText(/Update/i)
    );

    await waitFor(() => {

      expect(mockPut)
        .toHaveBeenCalled();

    });

    expect(window.alert)
      .toHaveBeenCalledWith(
        "Machine Updated Successfully"
      );

  });


  // =========================
  // UPDATE VALIDATION
  // =========================
  test("shows validation if no machine selected for update", async () => {

    const user = userEvent.setup();

    window.alert = jest.fn();

    renderSettings();

    await user.click(
      screen.getByText(/Update/i)
    );

    expect(window.alert)
      .toHaveBeenCalledWith(
        "Select a machine first"
      );

  });


  // =========================
  // DELETE MACHINE
  // =========================
  test("deletes machine successfully", async () => {

    const user = userEvent.setup();

    window.alert = jest.fn();

    window.confirm = jest.fn(() => true);

    mockDelete.mockResolvedValue({
      data: {
        success: true,
      },
    });

    renderSettings();

    await screen.findByText(
      "Press Machine 1"
    );

    await user.click(
      screen.getByText(
        "Press Machine 1"
      )
    );

    await user.click(
      screen.getByText(/Delete/i)
    );

    await waitFor(() => {

      expect(mockDelete)
        .toHaveBeenCalledWith(
          "/machines/1"
        );

    });

    expect(window.alert)
      .toHaveBeenCalledWith(
        "Machine Deleted Successfully"
      );

  });


  // =========================
  // DELETE VALIDATION
  // =========================
  test("shows validation if delete clicked without selection", async () => {

    const user = userEvent.setup();

    window.alert = jest.fn();

    renderSettings();

    await user.click(
      screen.getByText(/Delete/i)
    );

    expect(window.alert)
      .toHaveBeenCalledWith(
        "Select a machine first"
      );

  });


  // =========================
  // DELETE CANCEL
  // =========================
  test("does not delete if confirmation cancelled", async () => {

    const user = userEvent.setup();

    window.confirm = jest.fn(() => false);

    renderSettings();

    await screen.findByText(
      "Press Machine 1"
    );

    await user.click(
      screen.getByText(
        "Press Machine 1"
      )
    );

    await user.click(
      screen.getByText(/Delete/i)
    );

    expect(mockDelete)
      .not.toHaveBeenCalled();

  });


  // =========================
  // BACK BUTTON
  // =========================
  test("back button navigates to dashboard", async () => {

    const user = userEvent.setup();

    renderSettings();

    await user.click(
      screen.getByText(/Back/i)
    );

    expect(mockNavigate)
      .toHaveBeenCalledWith(
        "/dashboard"
      );

  });


  // =========================
  // IMAGE PREVIEW
  // =========================
  test("renders image preview for selected machine", async () => {

    const user = userEvent.setup();

    renderSettings();

    await screen.findByText(
      "Press Machine 1"
    );

    await user.click(
      screen.getByText(
        "Press Machine 1"
      )
    );

    const preview =
      screen.getByAltText(
        /preview/i
      );

    expect(preview)
      .toBeInTheDocument();

  });


  // =========================
  // NON ADMIN USER
  // =========================
  test("hides admin settings for non admin user", async () => {

    mockUser.role = "operator";

    renderSettings();

    expect(
      screen.queryByText(
        /Machine Settings/i
      )
    ).not.toBeInTheDocument();

    mockUser.role = "admin";

  });


  // =========================
  // API FAILURE
  // =========================
  test("handles API failure safely", async () => {

    mockGet.mockRejectedValue(
      new Error("API Failed")
    );

    renderSettings();

    await waitFor(() => {

      expect(mockGet)
        .toHaveBeenCalled();

    });

    expect(
      screen.getByText(
        /Machine Configuration/i
      )
    ).toBeInTheDocument();

  });

});