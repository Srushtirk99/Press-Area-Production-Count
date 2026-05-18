const express = require("express");
const router = express.Router();
const productionController = require("../controllers/productionController");
const { verifyToken } = require("../middleware/authMiddleware");

// PROTECTED
router.get("/machine/:id/logs", verifyToken, productionController.getLogs);

module.exports = router;