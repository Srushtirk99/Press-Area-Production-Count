const express = require("express");
const router = express.Router();
const alarmController = require("../controllers/alarmController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/", verifyToken, alarmController.getAlarms);

module.exports = router;