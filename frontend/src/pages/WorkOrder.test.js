import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { MemoryRouter } from "react-router-dom";

import WorkOrder from "./WorkOrder";

const mockNavigate = jest.fn();

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();


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

    post: (...args) => mockPost(...args),

    put: (...args) => mockPut(...args),

    delete: (...args) => mockDelete(...args),

  },

}));


// =========================
// RENDER HELPER
// =========================
const renderWorkOrder = () => {

  return render(
    <MemoryRouter>
      <WorkOrder />
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


const mockWorkorders = [

  {
    id: 1,
    product_name: "Bolt",
    workorder_number: "WO-101",
    machine_id: 1,
    machine_name: "Press Machine 1",
    target_quantity: 100,
    produced_so_far: 0,
  },

  {
    id: 2,
    product_name: "Nut",
    workorder_number: "WO-102",
    machine_id: 2,
    machine_name: "Press Machine 2",
    target_quantity: 200,
    produced_so_far: 100,
  },

];


// =========================
// TESTS
// =========================
describe("WorkOrder Page", () => {

  beforeEach(() => {

    jest.clearAllMocks();

    mockGet.mockImplementation((url) => {

      if (url === "/machines") {
        return Promise.resolve(mockMachines);
      }

      if (url === "/workorders") {
        return Promise.resolve({
          data: mockWorkorders,
        });
      }

      return Promise.resolve({
        data: [],
      });

    });

  });


  // =========================
  // PAGE RENDER
  // =========================
  test("renders workorder page correctly", async () => {

    renderWorkOrder();

    expect(
      screen.getByText(/Work Orders/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(
        /Product Name/i
      )
    ).toBeInTheDocument();

  });


  // =========================
  // FETCH MACHINES
  // =========================
  test("fetches machines from API", async () => {

    renderWorkOrder();

    await waitFor(() => {

      expect(mockGet)
        .toHaveBeenCalledWith(
          "/machines"
        );

    });

  });


  // =========================
  // FETCH WORKORDERS
  // =========================
  test("fetches workorders from API", async () => {

    renderWorkOrder();

    await waitFor(() => {

      expect(mockGet)
        .toHaveBeenCalledWith(
          "/workorders"
        );

    });

  });


  // =========================
  // TABLE DATA
  // =========================
  test("renders workorder table correctly", async () => {

    renderWorkOrder();

    expect(
      await screen.findByText(
        "WO-101"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "WO-102"
      )
    ).toBeInTheDocument();

  });


  // =========================
  // CREATE WORKORDER
  // =========================
  test("creates workorder successfully", async () => {

    const user = userEvent.setup();

    mockPost.mockResolvedValue({
      data: {
        success: true,
      },
    });

    renderWorkOrder();

    await screen.findByText(
      "WO-101"
    );

    const textInputs =
      screen.getAllByRole("textbox");

    await user.type(
      textInputs[0],
      "Gear"
    );

    await user.type(
      textInputs[1],
      "WO-200"
    );

    const select =
      screen.getByRole("combobox");

    await user.selectOptions(
      select,
      "1"
    );

    const numberInput =
      screen.getByRole("spinbutton");

    await user.type(
      numberInput,
      "500"
    );

    await user.click(
      screen.getByText(/Create/i)
    );

    await waitFor(() => {

      expect(mockPost)
        .toHaveBeenCalledWith(
          "/workorders",
          {
            product_name: "Gear",
            workorder_number: "WO-200",
            machine_id: "1",
            target_quantity: "500",
          }
        );

    });

  });


  // =========================
  // NEGATIVE VALUE CHECK
  // =========================
  test("prevents negative target quantity", async () => {

    const user = userEvent.setup();

    renderWorkOrder();

    const numberInput =
      screen.getByRole("spinbutton");

    await user.type(
      numberInput,
      "-10"
    );

    expect(numberInput.value)
      .not.toContain("-");

  });


  // =========================
  // EDIT WORKORDER
  // =========================
  test("loads workorder data into form on edit", async () => {

    const user = userEvent.setup();

    renderWorkOrder();

    await screen.findByText(
      "WO-101"
    );

    const editButton =
      screen.getByText(/Edit/i);

    await user.click(editButton);

    expect(
      screen.getByDisplayValue(
        "Bolt"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByDisplayValue(
        "WO-101"
      )
    ).toBeInTheDocument();

  });


  // =========================
  // UPDATE WORKORDER
  // =========================
  test("updates workorder successfully", async () => {

    const user = userEvent.setup();

    mockPut.mockResolvedValue({
      data: {
        success: true,
      },
    });

    renderWorkOrder();

    await screen.findByText(
      "WO-101"
    );

    await user.click(
      screen.getByText(/Edit/i)
    );

    const productInput =
      screen.getByDisplayValue(
        "Bolt"
      );

    await user.clear(productInput);

    await user.type(
      productInput,
      "Updated Bolt"
    );

    await user.click(
      screen.getByText(/Update/i)
    );

    await waitFor(() => {

      expect(mockPut)
        .toHaveBeenCalled();

    });

  });


  // =========================
  // DELETE WORKORDER
  // =========================
  test("deletes workorder successfully", async () => {

    const user = userEvent.setup();

    window.confirm =
      jest.fn(() => true);

    mockDelete.mockResolvedValue({
      data: {
        success: true,
      },
    });

    renderWorkOrder();

    await screen.findByText(
      "WO-101"
    );

    const deleteButtons =
      screen.getAllByText(/Delete/i);

    await user.click(
      deleteButtons[0]
    );

    await waitFor(() => {

      expect(mockDelete)
        .toHaveBeenCalledWith(
          "/workorders/1"
        );

    });

  });


  // =========================
  // DELETE CANCEL
  // =========================
  test("does not delete if confirmation cancelled", async () => {

    const user = userEvent.setup();

    window.confirm =
      jest.fn(() => false);

    renderWorkOrder();

    await screen.findByText(
      "WO-101"
    );

    const deleteButtons =
      screen.getAllByText(/Delete/i);

    await user.click(
      deleteButtons[0]
    );

    expect(mockDelete)
      .not.toHaveBeenCalled();

  });


  // =========================
  // PROGRESS BAR
  // =========================
  test("renders progress bar correctly", async () => {

    renderWorkOrder();

    await screen.findByText(
      "WO-102"
    );

    const progressBars =
      document.querySelectorAll(
        ".progress-fill"
      );

    expect(progressBars.length)
      .toBeGreaterThan(0);

  });


  // =========================
  // COMPLETED EDIT BLOCK
  // =========================
  test("blocks editing completed workorders", async () => {

    const user = userEvent.setup();

    window.alert = jest.fn();

    mockGet.mockImplementation((url) => {

      if (url === "/machines") {
        return Promise.resolve(mockMachines);
      }

      if (url === "/workorders") {
        return Promise.resolve({
          data: [

            {
              id: 5,
              product_name: "Finished Product",
              workorder_number: "WO-500",
              machine_id: 1,
              machine_name: "Press Machine 1",
              target_quantity: 100,
              produced_so_far: 100,
            },

          ],
        });
      }

    });

    renderWorkOrder();

    await screen.findByText(
      "WO-500"
    );

    expect(
      screen.queryByText(/Edit/i)
    ).not.toBeInTheDocument();

  });


  // =========================
  // AUTO REFRESH
  // =========================
  test("sets auto refresh interval", async () => {

    jest.useFakeTimers();

    renderWorkOrder();

    await waitFor(() => {

      expect(mockGet)
        .toHaveBeenCalled();

    });

    jest.advanceTimersByTime(5000);

    jest.useRealTimers();

  });


  // =========================
  // BACK BUTTON
  // =========================
  test("back button navigates to dashboard", async () => {

    const user = userEvent.setup();

    renderWorkOrder();

    await user.click(
      screen.getByText(/Back/i)
    );

    expect(mockNavigate)
      .toHaveBeenCalledWith(
        "/dashboard"
      );

  });


  // =========================
  // API FAILURE
  // =========================
  test("handles API failure safely", async () => {

    mockGet.mockRejectedValue(
      new Error("API Failed")
    );

    renderWorkOrder();

    await waitFor(() => {

      expect(mockGet)
        .toHaveBeenCalled();

    });

    expect(
      screen.getByText(/Work Orders/i)
    ).toBeInTheDocument();

  });

});