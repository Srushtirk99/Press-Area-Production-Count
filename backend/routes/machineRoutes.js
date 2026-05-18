const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
// const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const machineController = require("../controllers/machineController");
const { protect } = require("../middleware/authMiddleware");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

router.get("/", protect, machineController.getMachines);
router.get("/:id", protect, machineController.getMachineById);
router.post("/", protect, upload.single("image"), machineController.addMachine);
router.put("/:id", protect, upload.single("image"), machineController.updateMachine);
router.delete("/:id", protect, machineController.deleteMachine);
module.exports = router;