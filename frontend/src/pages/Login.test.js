import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "./Login";

const mockNavigate = jest.fn();
const mockPost = jest.fn();
const mockConnectSocket = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../api", () => ({
  __esModule: true,
  default: {
    post: (...args) => mockPost(...args),
  },
}));

jest.mock("../socket", () => ({
  __esModule: true,
  connectSocket: (...args) => mockConnectSocket(...args),
}));

describe("Login page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.alert = jest.fn();
  });

  test("renders login form", () => {
    render(<Login />);

    expect(screen.getByText(/PressBoard Login/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Login/i })).toBeInTheDocument();
  });

  test("allows typing in email and password", async () => {
    const user = userEvent.setup();

    render(<Login />);

    await user.type(screen.getByPlaceholderText(/Email/i), "test@gmail.com");
    await user.type(screen.getByPlaceholderText(/Password/i), "123456");

    expect(screen.getByDisplayValue("test@gmail.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123456")).toBeInTheDocument();
  });

  test("opens forgot password screen", async () => {
    const user = userEvent.setup();

    render(<Login />);

    await user.click(screen.getByText(/Forgot Password/i));

    expect(screen.getByText(/Reset Password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send OTP/i })).toBeInTheDocument();
  });

  test("returns back to login page", async () => {
    const user = userEvent.setup();

    render(<Login />);

    await user.click(screen.getByText(/Forgot Password/i));
    await user.click(screen.getByText(/Back to Login/i));

    expect(screen.getByText(/PressBoard Login/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Email/i)).toBeInTheDocument();
  });

  test("calls login API, stores token, and navigates on successful login", async () => {
    const user = userEvent.setup();

    mockPost.mockResolvedValueOnce({
      data: {
        token: "fake-token",
        user: {
          name: "Admin",
          email: "admin@test.com",
          role: "admin",
        },
      },
    });

    render(<Login />);

    await user.type(screen.getByPlaceholderText(/Email/i), "admin@test.com");
    await user.type(screen.getByPlaceholderText(/Password/i), "123456");
    await user.click(screen.getByRole("button", { name: /Login/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/auth/login", {
        email: "admin@test.com",
        password: "123456",
      });
    });

    await waitFor(() => {
      expect(localStorage.getItem("token")).toBe("fake-token");
      expect(localStorage.getItem("adminName")).toBe("Admin");
      expect(localStorage.getItem("adminEmail")).toBe("admin@test.com");
      expect(localStorage.getItem("role")).toBe("admin");
      expect(mockConnectSocket).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
      expect(window.alert).toHaveBeenCalledWith("Login Successful");
    });
  });

  test("shows error message when login API fails", async () => {
    const user = userEvent.setup();

    mockPost.mockRejectedValueOnce({
      response: {
        data: {
          message: "Invalid credentials",
        },
      },
    });

    render(<Login />);

    await user.type(screen.getByPlaceholderText(/Email/i), "wrong@test.com");
    await user.type(screen.getByPlaceholderText(/Password/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /Login/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/auth/login", {
        email: "wrong@test.com",
        password: "wrongpass",
      });
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Invalid credentials");
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(localStorage.getItem("token")).toBeNull();
    });
  });

  test("calls forgot password API and moves to OTP step", async () => {
    const user = userEvent.setup();

    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        message: "OTP sent to email",
      },
    });

    render(<Login />);

    await user.click(screen.getByText(/Forgot Password/i));

    await user.type(
      screen.getByPlaceholderText(/Enter your email/i),
      "admin@test.com"
    );

    await user.click(screen.getByRole("button", { name: /Send OTP/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password", {
        email: "admin@test.com",
      });
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("OTP sent to your email");
      expect(screen.getByText(/Reset Password/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter OTP/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/New Password/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Confirm Password/i)).toBeInTheDocument();
    });
  });

  test("shows error when forgot password API fails", async () => {
    const user = userEvent.setup();

    mockPost.mockRejectedValueOnce({
      response: {
        data: {
          message: "User not found",
        },
      },
    });

    render(<Login />);

    await user.click(screen.getByText(/Forgot Password/i));
    await user.type(
      screen.getByPlaceholderText(/Enter your email/i),
      "wrong@test.com"
    );
    await user.click(screen.getByRole("button", { name: /Send OTP/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password", {
        email: "wrong@test.com",
      });
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("User not found");
      expect(screen.getByText(/Reset Password/i)).toBeInTheDocument();
    });
  });

  test("verifies OTP and resets password successfully", async () => {
    const user = userEvent.setup();

    mockPost
      .mockResolvedValueOnce({
        data: {
          success: true,
          message: "OTP sent to email",
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          message: "Password reset successful",
        },
      });

    render(<Login />);

    await user.click(screen.getByText(/Forgot Password/i));

    await user.type(
      screen.getByPlaceholderText(/Enter your email/i),
      "admin@test.com"
    );
    await user.click(screen.getByRole("button", { name: /Send OTP/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter OTP/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Enter OTP/i), "123456");
    await user.type(screen.getByPlaceholderText(/New Password/i), "newpass123");
    await user.type(
      screen.getByPlaceholderText(/Confirm Password/i),
      "newpass123"
    );

    await user.click(screen.getByRole("button", { name: /Verify & Reset/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/auth/verify-otp", {
        email: "admin@test.com",
        otp: "123456",
        newPassword: "newpass123",
      });
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Password reset successful");
      expect(screen.getByText(/PressBoard Login/i)).toBeInTheDocument();
    });
  });

  test("shows error when OTP verification fails", async () => {
    const user = userEvent.setup();

    mockPost
      .mockResolvedValueOnce({
        data: {
          success: true,
          message: "OTP sent to email",
        },
      })
      .mockRejectedValueOnce({
        response: {
          data: {
            message: "Invalid OTP",
          },
        },
      });

    render(<Login />);

    await user.click(screen.getByText(/Forgot Password/i));
    await user.type(
      screen.getByPlaceholderText(/Enter your email/i),
      "admin@test.com"
    );
    await user.click(screen.getByRole("button", { name: /Send OTP/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter OTP/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Enter OTP/i), "111111");
    await user.type(screen.getByPlaceholderText(/New Password/i), "newpass123");
    await user.type(
      screen.getByPlaceholderText(/Confirm Password/i),
      "newpass123"
    );

    await user.click(screen.getByRole("button", { name: /Verify & Reset/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/auth/verify-otp", {
        email: "admin@test.com",
        otp: "111111",
        newPassword: "newpass123",
      });
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Invalid OTP");
      expect(screen.getByText(/Reset Password/i)).toBeInTheDocument();
    });
  });
});