const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const db = require("../config/db");

const {
  getUserByEmail,
  getUserById,
  updatePassword,
  updateOtp,
  resetPasswordByEmail,
} = require("../db/queries");

//LOGIN
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ success: false, message: "Email and password are required" });

  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM users WHERE email = ?", [email]
    );

    if (!rows.length)
      return res.status(404).json({ message: "User not found" });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
};

exports.logout = (req, res) => {
  return res.json({
    success: true,
    message: "Logged out successfully",
  });
};


// CHANGE PASSWORD
exports.changePassword = (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword)
    return res.status(400).json({ message: "All fields are required" });

  getUserById(userId, async (err, result) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (!result.length) return res.status(404).json({ message: "User not found" });

    const user = result[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: "Wrong current password" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    updatePassword(hashedPassword, userId, (err) => {
      if (err) return res.status(500).json({ message: "Password update failed" });

      res.json({ success: true, message: "Password updated successfully" });
    });
  });
};


// FORGOT PASSWORD (SENDING OTP)
exports.forgotPassword = (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ message: "Email is required" });

  getUserByEmail(email, async (err, result) => {

    if (err) return res.status(500).json({ message: "Database error" });
    if (!result.length) return res.status(404).json({ message: "User not found" });

    //  Generate OTP (string)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    //  Correct datetime format for MySQL
    const expiry = new Date(Date.now() + 5 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    updateOtp(otp, expiry, email, async (err) => {

      if (err) return res.status(500).json({ message: "Failed to generate OTP" });

      const html = `
        <div style="font-family: Arial; padding: 20px;">
          <h2>PressBoard</h2>
          <p>Your OTP is:</p>
          <h1>${otp}</h1>
          <p>Valid for 5 minutes</p>
        </div>
      `;

      await sendEmail(email, "Password Reset OTP", html);

      res.json({ success: true, message: "OTP sent to email" });
    });
  });
};


// VERIFY OTP + RESET PASSWORD
exports.verifyOtpAndReset = (req, res) => {

  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword)
    return res.status(400).json({ message: "All fields are required" });

  const cleanOtp = String(otp).trim();

  //  Correct current time format
  const now = new Date()
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  const query = `
    SELECT * FROM users 
    WHERE email = ? 
    AND otp = ? 
    AND otp_expiry > ?
  `;

  db.query(query, [email, cleanOtp, now], async (err, result) => {

    if (err) return res.status(500).json({ message: "Database error" });

    if (!result.length) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    try {

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      //  Update password + clear OTP
      db.query(
        "UPDATE users SET password=?, otp=NULL, otp_expiry=NULL WHERE email=?",
        [hashedPassword, email],
        (err) => {

          if (err)
            return res.status(500).json({ message: "Password reset failed" });

          res.json({ success: true, message: "Password reset successful" });
        }
      );

    } catch (error) {
      return res.status(500).json({ message: "Error resetting password" });
    }

  });

};