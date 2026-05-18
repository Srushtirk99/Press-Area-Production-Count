// controllers/workorderController.js
const {
  getAllWorkOrders,
  getActiveWorkOrders,
  createWorkOrder,
  updateWorkOrder,
  closeWorkOrder,
  reopenWorkOrder,
  deleteWorkOrder,
  getProductionLogs,
  getProductionLogsByWorkOrder,
  getDailyProductionSummary,
} = require("../db/workorderQueries");

// GET /api/workorders — all work orders
exports.getAll = (req, res) => {
  getAllWorkOrders((err, rows) => {
    if (err) return res.status(500).json({ error: "Failed to fetch work orders" });
    res.json(rows);
  });
};

// GET /api/workorders/active — only active ones
exports.getActive = (req, res) => {
  getActiveWorkOrders((err, rows) => {
    if (err) return res.status(500).json({ error: "Failed to fetch active work orders" });
    res.json(rows);
  });
};

// POST /api/workorders — create new work order
// body: { product_name, workorder_number, machine_id, target_quantity }
exports.create = (req, res) => {
  const { product_name, workorder_number, machine_id, target_quantity } = req.body;

  if (
  product_name == null ||
  workorder_number == null ||
  machine_id == null ||
  target_quantity == null
) {
  return res.status(400).json({
    error: "All fields required: product_name, workorder_number, machine_id, target_quantity",
  });
}

  // Validate target_quantity is a positive integer
  const qty = parseInt(target_quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: "target_quantity must be a positive number" });
  }

  createWorkOrder(product_name, workorder_number, parseInt(machine_id), qty, (err) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY")
        return res.status(409).json({ error: "Work order number already exists" });
      return res.status(500).json({ error: "Failed to create work order" });
    }
    res.status(201).json({ success: true, message: "Work order created" });
  });
};

// PUT /api/workorders/:id — update work order (part name, WO number, quantity)
// body: { product_name, workorder_number, target_quantity }
exports.update = (req, res) => {
  const { id } = req.params;
  const { product_name, workorder_number, target_quantity } = req.body;

  if (!product_name && !workorder_number && !target_quantity) {
    return res.status(400).json({
      error: "Provide at least one field to update: product_name, workorder_number, target_quantity",
    });
  }

  // If target_quantity is provided, validate it
  let qty = undefined;
  if (target_quantity !== undefined) {
    qty = parseInt(target_quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: "target_quantity must be a positive number" });
    }
  }

  updateWorkOrder(id, { product_name, workorder_number, target_quantity: qty }, (err) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY")
        return res.status(409).json({ error: "Work order number already exists" });
      return res.status(500).json({ error: "Failed to update work order" });
    }
    res.json({ success: true, message: "Work order updated" });
  });
};

// PATCH /api/workorders/:workorder_number/close
exports.close = (req, res) => {
  closeWorkOrder(req.params.workorder_number, (err) => {
    if (err) return res.status(500).json({ error: "Failed to close work order" });
    res.json({ success: true, message: "Work order closed" });
  });
};

// PATCH /api/workorders/:workorder_number/reopen
exports.reopen = (req, res) => {
  reopenWorkOrder(req.params.workorder_number, (err) => {
    if (err) return res.status(500).json({ error: "Failed to reopen work order" });
    res.json({ success: true, message: "Work order reopened" });
  });
};

// DELETE /api/workorders/:id
exports.remove = (req, res) => {
  deleteWorkOrder(req.params.id, (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Failed to delete work order" });
    }

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ error: "Work order not found" });
    }

    res.json({ success: true, message: "Work order deleted" });
  });
};

// GET /api/workorders/production — all production log entries
exports.getProductionLogs = (req, res) => {
  getProductionLogs((err, rows) => {
    if (err) return res.status(500).json({ error: "Failed to fetch production logs" });
    res.json(rows);
  });
};

// GET /api/workorders/production/:workorder_number — logs for one WO
exports.getProductionLogsByWO = (req, res) => {
  getProductionLogsByWorkOrder(req.params.workorder_number, (err, rows) => {
    if (err) return res.status(500).json({ error: "Failed to fetch logs" });
    res.json(rows);
  });
};

// GET /api/workorders/summary — daily production summary
exports.getSummary = (req, res) => {
  getDailyProductionSummary((err, rows) => {
    if (err) return res.status(500).json({ error: "Failed to fetch summary" });
    res.json(rows);
  });
};








