const bcrypt = require("bcrypt");

const {
  getAllUsers,
  insertUser,
  updateUser,
  deleteUser,
} = require("../db/queries");

// ADD USER
exports.addUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ success: false, message: "All fields required" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || "operator";

    insertUser(name, email, hashedPassword, userRole, (err) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY")
          return res.status(409).json({ success: false, message: "Email already exists" });
        return res.status(500).json({ success: false, message: "User creation failed" });
      }
      res.status(201).json({ success: true, message: "User added successfully" });
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET ALL USERS
exports.getUsers = (req, res) => {
  getAllUsers((err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Failed to fetch users" });
    res.json({ success: true, users: result });
  });
};

// UPDATE USER
exports.updateUser = (req, res) => {
  const userId = req.params.id;
  const { name, email, role } = req.body;

  if (!name || !email)
    return res.status(400).json({ success: false, message: "Name and email required" });

  const userRole = role || "operator";

  updateUser(name, email, userRole, userId, (err) => {
    if (err) return res.status(500).json({ success: false, message: "Update failed" });
    res.json({ success: true, message: "User updated successfully" });
  });
};

// DELETE USER
exports.deleteUser = (req, res) => {
  const userId = req.params.id;

  if (req.user.id == userId)
    return res.status(400).json({ success: false, message: "You cannot delete yourself" });

  deleteUser(userId, (err) => {
    if (err) return res.status(500).json({ success: false, message: "Delete failed" });
    res.json({ success: true, message: "User deleted successfully" });
  });
};