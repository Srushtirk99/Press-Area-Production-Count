const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware");
const { protect } = require("../middleware/authMiddleware");


router.post("/login", authController.login);
router.post("/logout", protect, authController.logout);
router.post("/change-password", verifyToken, authController.changePassword); // ← added verifyToken
router.post("/forgot-password", authController.forgotPassword);
router.post("/verify-otp", authController.verifyOtpAndReset);

module.exports = router;