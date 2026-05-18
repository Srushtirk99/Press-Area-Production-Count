import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import AdminProfile from "./AdminProfile";

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
const renderAdminProfile = () => {

  return render(
    <MemoryRouter>
      <AdminProfile />
    </MemoryRouter>
  );

};


// =========================
// TESTS
// =========================
describe("AdminProfile Page", () => {

  beforeEach(() => {

    jest.clearAllMocks();

    localStorage.setItem("adminName", "Super Admin");

    localStorage.setItem(
      "adminEmail",
      "admin@test.com"
    );

    localStorage.setItem(
      "lastLogin",
      "2026-05-11 10:00 AM"
    );

    mockGet.mockResolvedValue({
      data: {
        users: [
          {
            id: 1,
            name: "John",
            email: "john@test.com",
            role: "operator",
          },

          {
            id: 2,
            name: "Alice",
            email: "alice@test.com",
            role: "admin",
          },
        ],
      },
    });

  });


  // =========================
  // PAGE RENDER
  // =========================
  test("renders admin panel correctly", async () => {

    renderAdminProfile();

    expect(
      screen.getByText(/Admin Panel/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Admin Information/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Security/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/User Management/i)
    ).toBeInTheDocument();

  });


  // =========================
  // LOCAL STORAGE ADMIN DATA
  // =========================
  test("renders admin info from localStorage", async () => {

    renderAdminProfile();

    expect(
      screen.getByText(/Super Admin/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/admin@test.com/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/2026-05-11 10:00 AM/i)
    ).toBeInTheDocument();

  });


  // =========================
  // FETCH USERS API
  // =========================
  test("fetches and renders users", async () => {

    renderAdminProfile();

    await waitFor(() => {

      expect(mockGet).toHaveBeenCalledWith(
        "/users"
      );

    });

    expect(
      await screen.findByText("John")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Alice")
    ).toBeInTheDocument();

  });


  // =========================
  // SEARCH USERS
  // =========================
  test("filters users using search", async () => {

    const user = userEvent.setup();

    renderAdminProfile();

    await screen.findByText("John");

    await user.type(
      screen.getByPlaceholderText(/Search users/i),
      "Alice"
    );

    await waitFor(() => {

      expect(
        screen.getByText("Alice")
      ).toBeInTheDocument();

    });

  });


  // =========================
  // ADD USER
  // =========================
  test("adds new user", async () => {

    const user = userEvent.setup();

    mockPost.mockResolvedValue({
      data: {
        success: true,
      },
    });

    renderAdminProfile();

    await user.type(
      screen.getByPlaceholderText(/^Name$/i),
      "David"
    );

    await user.type(
      screen.getByPlaceholderText(/^Email$/i),
      "david@test.com"
    );

    await user.click(
      screen.getByText(/Add User/i)
    );

    await waitFor(() => {

      expect(mockPost).toHaveBeenCalledWith(
        "/users/add",
        {
          name: "David",
          email: "david@test.com",
          password: "123456",
          role: "operator",
        }
      );

    });

  });


  // =========================
  // VALIDATION
  // =========================
  test("shows validation alert for empty fields", async () => {

    const user = userEvent.setup();

    window.alert = jest.fn();

    renderAdminProfile();

    await user.click(
      screen.getByText(/Add User/i)
    );

    expect(window.alert)
      .toHaveBeenCalledWith(
        "Name and Email required"
      );

  });


  // =========================
  // EDIT USER
  // =========================
  test("loads user data into form on edit", async () => {

    const user = userEvent.setup();

    renderAdminProfile();

    await screen.findByText("John");

    const editButtons =
      screen.getAllByText(/Edit/i);

    await user.click(editButtons[0]);

    expect(
      screen.getByDisplayValue("John")
    ).toBeInTheDocument();

    expect(
      screen.getByDisplayValue("john@test.com")
    ).toBeInTheDocument();

  });


  // =========================
  // UPDATE USER
  // =========================
  test("updates user successfully", async () => {

    const user = userEvent.setup();

    mockPut.mockResolvedValue({
      data: {
        success: true,
      },
    });

    renderAdminProfile();

    await screen.findByText("John");

    const editButtons =
      screen.getAllByText(/Edit/i);

    await user.click(editButtons[0]);

    const nameInput =
      screen.getByDisplayValue("John");

    await user.clear(nameInput);

    await user.type(
      nameInput,
      "John Updated"
    );

    await user.click(
      screen.getByText(/Update/i)
    );

    await waitFor(() => {

      expect(mockPut).toHaveBeenCalled();

    });

  });


  // =========================
  // DELETE USER
  // =========================
  test("deletes user successfully", async () => {

    const user = userEvent.setup();

    window.confirm = jest.fn(() => true);

    mockDelete.mockResolvedValue({
      data: {
        success: true,
      },
    });

    renderAdminProfile();

    await screen.findByText("John");

    const deleteButtons =
      screen.getAllByText(/Delete/i);

    await user.click(deleteButtons[0]);

    await waitFor(() => {

      expect(mockDelete).toHaveBeenCalledWith(
        "/users/delete/1"
      );

    });

  });


  // =========================
  // CHANGE PASSWORD
  // =========================
  test("changes password successfully", async () => {

    const user = userEvent.setup();

    window.alert = jest.fn();

    mockPost.mockResolvedValue({
      data: {
        success: true,
      },
    });

    renderAdminProfile();

    const passwordInputs =
      screen.getAllByPlaceholderText(/Password/i);

    await user.type(
      passwordInputs[0],
      "oldpass"
    );

    await user.type(
      passwordInputs[1],
      "newpass"
    );

    await user.click(
      screen.getByText(/Change Password/i)
    );

    await waitFor(() => {

      expect(mockPost).toHaveBeenCalledWith(
        "/auth/change-password",
        {
          currentPassword: "oldpass",
          newPassword: "newpass",
        }
      );

    });

    expect(window.alert)
      .toHaveBeenCalledWith(
        "Password changed"
      );

  });


  // =========================
  // PASSWORD ERROR
  // =========================
  test("handles password change failure", async () => {

    const user = userEvent.setup();

    window.alert = jest.fn();

    mockPost.mockRejectedValue(
      new Error("Failed")
    );

    renderAdminProfile();

    const passwordInputs =
      screen.getAllByPlaceholderText(/Password/i);

    await user.type(
      passwordInputs[0],
      "wrong"
    );

    await user.type(
      passwordInputs[1],
      "newpass"
    );

    await user.click(
      screen.getByText(/Change Password/i)
    );

    await waitFor(() => {

      expect(window.alert)
        .toHaveBeenCalledWith(
          "Password change failed"
        );

    });

  });


  // =========================
  // BACK BUTTON
  // =========================
  test("back button navigates to dashboard", async () => {

    const user = userEvent.setup();

    renderAdminProfile();

    await user.click(
      screen.getByText(/Back/i)
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      "/dashboard"
    );

  });


  // =========================
  // NON ADMIN USER
  // =========================
  test("hides admin actions for non-admin users", async () => {

    mockUser.role = "operator";

    renderAdminProfile();

    await screen.findByText("John");

    expect(
      screen.queryByText(/Add User/i)
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText(/Edit/i)
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText(/Delete/i)
    ).not.toBeInTheDocument();

    mockUser.role = "admin";

  });

});