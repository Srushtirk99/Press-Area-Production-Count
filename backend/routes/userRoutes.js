const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");


//  ADMIN ONLY
router.post("/add", verifyToken, isAdmin, userController.addUser);
router.put("/update/:id", verifyToken, isAdmin, userController.updateUser);
router.delete("/delete/:id", verifyToken, isAdmin, userController.deleteUser);

// ANY LOGGED-IN USER
router.get("/", verifyToken, isAdmin, userController.getUsers);

module.exports = router;