const express    = require("express");
const router     = express.Router();
const controller = require("../controllers/workorderController");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

// Work order CRUD
router.get("/",                              verifyToken, controller.getAll);
router.get("/active",                        verifyToken, controller.getActive);
router.get("/summary",                       verifyToken, controller.getSummary);
router.post("/",                             verifyToken, isAdmin, controller.create);

// UPDATE: change product_name, workorder_number, or target_quantity
router.put("/:id",                           verifyToken, isAdmin, controller.update);

router.patch("/:workorder_number/close",     verifyToken, isAdmin, controller.close);
router.patch("/:workorder_number/reopen",    verifyToken, isAdmin, controller.reopen);
router.delete("/:id",                        verifyToken, isAdmin, controller.remove);

// Production log routes
router.get("/production",                    verifyToken, controller.getProductionLogs);
router.get("/production/:workorder_number",  verifyToken, controller.getProductionLogsByWO);

module.exports = router;