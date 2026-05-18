// routes/reportRoutes.js

const express          = require("express");
const router           = express.Router();
const reportController = require("../controllers/reportController");
const { verifyToken } = require("../middleware/authMiddleware");
// Data endpoints (used by frontend chart/table)

// Single machine — daily/weekly/monthly/yearly
// ?from=YYYY-MM-DD&to=YYYY-MM-DD  (required for yearly, optional otherwise)
router.get("/machine/:machineId/:type", reportController.getMachineReport);

// All machines combined — daily/weekly/monthly/yearly
router.get("/combined/:type", reportController.getCombinedReport);

// Yearly with explicit date range  (machineId OR "combined")
// ?from=YYYY-MM-DD&to=YYYY-MM-DD  REQUIRED
router.get("/yearly/:machineId", verifyToken, reportController.getYearlyReport);

// Hourly (today only)
router.get("/hourly/machine/:machineId", reportController.getMachineHourlyReport);
router.get("/hourly/combined",           reportController.getCombinedHourlyReport);


// Download endpoints

// Single machine downloads — ?from=&to= forwarded automatically
router.get("/download/machine/excel/:machineId/:type", reportController.downloadMachineExcel);
router.get("/download/machine/pdf/:machineId/:type",   reportController.downloadMachinePDF);

// Combined downloads
router.get("/download/combined/excel/:type", reportController.downloadCombinedExcel);
router.get("/download/combined/pdf/:type",   reportController.downloadCombinedPDF);

module.exports = router;