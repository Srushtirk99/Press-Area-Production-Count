const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { verifyToken } = require("../middleware/authMiddleware");

//  PROTECTED ROUTES
router.get("/", verifyToken, dashboardController.getDashboard);
router.get("/history/:machineId", verifyToken, dashboardController.getEfficiencyHistory);
router.get("/production-summary/:machineId", verifyToken, dashboardController.getProductionSummary);

module.exports = router;