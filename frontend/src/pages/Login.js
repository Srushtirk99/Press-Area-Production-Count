import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import { connectSocket } from "../socket"; 

function Login() {

  const navigate = useNavigate();

  // =========================
  // STATE MANAGEMENT
  // =========================

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showForgot, setShowForgot] = useState(false);
  const [step, setStep] = useState(1);

  const [resetEmail, setResetEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // =========================
  // LOGIN FUNCTION (MEMOIZED)
  // =========================
  const handleLogin = useCallback(async () => {

    if (!email || !password) {
      alert("Email and password required");
      return;
    }

    try {

      setLoading(true);

      const res = await API.post("/auth/login", { email, password });

const user = res.data.user;

localStorage.setItem("token", res.data.token);
localStorage.setItem("adminName", user.name);
localStorage.setItem("adminEmail", user.email);
localStorage.setItem("role", user.role);
localStorage.setItem("lastLogin", new Date().toLocaleString());

try {
  connectSocket();
} catch (socketErr) {
  console.warn("Socket connection failed:", socketErr);
}

alert("Login Successful");
navigate("/dashboard");

    } catch (err) {

      alert(err.response?.data?.message || "Invalid credentials");

    } finally {
      setLoading(false);
    }

  }, [email, password, navigate]);

  // =========================
  // SEND OTP (MEMOIZED)
  // =========================
  const handleSendOTP = useCallback(async () => {

    if (!resetEmail) {
      alert("Enter email");
      return;
    }

    try {

      setLoading(true);

      await API.post("/auth/forgot-password", { email: resetEmail });

      alert("OTP sent to your email");
      setStep(2);

    } catch (err) {

      alert(err.response?.data?.message || "Failed to send OTP");

    } finally {
      setLoading(false);
    }

  }, [resetEmail]);

  // =========================
  // VERIFY OTP + RESET PASSWORD (MEMOIZED)
  // =========================
  const handleVerifyOTP = useCallback(async () => {

    if (!otp || !newPassword || !confirmPassword) {
      alert("All fields required");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {

      setLoading(true);

      const res = await API.post("/auth/verify-otp", {
        email: resetEmail,
        otp,
        newPassword
      });

      alert(res.data.message || "Password reset successful");

      // RESET FLOW
      setResetEmail("");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setStep(1);
      setShowForgot(false);

    } catch (err) {

      alert(err.response?.data?.message || "Invalid OTP");

    } finally {
      setLoading(false);
    }

  }, [otp, newPassword, confirmPassword, resetEmail]);

  // =========================
  // UI
  // =========================

  return (
    <div style={{ padding: "40px" }}>

      {!showForgot ? (

        <>
          <h2>PressBoard Login</h2>

          {/* CONTROLLED INPUT */}
          <input
            style={{ width: "300px", padding: "10px" }}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <br /><br />

          <input
            style={{ width: "300px", padding: "10px" }}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <br /><br />

          <button onClick={handleLogin} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>

          <br /><br />

          <p
            style={{ cursor: "pointer", color: "white" }}
            onClick={() => setShowForgot(true)}
          >
            Forgot Password?
          </p>
        </>

      ) : (

        <>
          <h2>Reset Password</h2>

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <input
                style={{ width: "300px", padding: "10px" }}
                type="email"
                placeholder="Enter your email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
              <br /><br />

              <button onClick={handleSendOTP} disabled={loading}>
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <input
                style={{ width: "300px", padding: "10px" }}
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <br /><br />

              <input
                style={{ width: "300px", padding: "10px" }}
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <br /><br />

              <input
                style={{ width: "300px", padding: "10px" }}
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <br /><br />

              <button onClick={handleVerifyOTP} disabled={loading}>
                {loading ? "Verifying..." : "Verify & Reset"}
              </button>
            </>
          )}

          <br /><br />

          <p
            style={{ cursor: "pointer", color: "white" }}
            onClick={() => {
              setShowForgot(false);
              setStep(1);
            }}
          >
            Back to Login
          </p>
        </>

      )}

    </div>
  );
}

export default Login;