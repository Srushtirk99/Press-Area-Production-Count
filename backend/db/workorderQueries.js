const db = require("../config/db");

const BUTTON_MACHINES = [1, 2, 3, 4, 5];

// WORK ORDERS
const getAllWorkOrders = (cb) =>
  db.query(
    `SELECT wo.*, m.machine_name
     FROM active_workorders wo
     JOIN machines m ON wo.machine_id = m.id
     ORDER BY wo.status DESC, wo.created_at DESC`,
    cb
  );

const getActiveWorkOrders = (cb) =>
  db.query(
    `SELECT wo.*, m.machine_name
     FROM active_workorders wo
     JOIN machines m ON wo.machine_id = m.id
     WHERE wo.status = 1
     ORDER BY wo.created_at DESC`,
    cb
  );

const getActiveWorkOrderByMachine = (machineId, cb) =>
  db.query(
    `SELECT * FROM active_workorders
     WHERE machine_id = ? AND status = 1
     LIMIT 1`,
    [machineId], cb
  );

// Button machines start INACTIVE (status=0) — operator activates on first press
// Auto machines start ACTIVE  (status=1) — they run continuously
const createWorkOrder = (product_name, workorder_number, machine_id, target_quantity, cb) => {
  const initialStatus = BUTTON_MACHINES.includes(Number(machine_id)) ? 0 : 1;

  db.query(
    `INSERT INTO active_workorders
       (product_name, workorder_number, machine_id, target_quantity, status)
     VALUES (?, ?, ?, ?, ?)`,
    [product_name, workorder_number, machine_id, target_quantity, initialStatus],
    cb
  );
};

const updateWorkOrder = (id, data, cb) => {
  const fields = [];
  const values = [];

  if (data.product_name !== undefined) {
    fields.push("product_name = ?");
    values.push(data.product_name);
  }

  if (data.workorder_number !== undefined) {
    fields.push("workorder_number = ?");
    values.push(data.workorder_number);
  }

  if (data.target_quantity !== undefined) {
    fields.push("target_quantity = ?");
    values.push(data.target_quantity);
  }

  if (fields.length === 0) {
    return cb(new Error("No fields to update"));
  }

  values.push(id);

  const sql = `UPDATE active_workorders SET ${fields.join(", ")} WHERE id = ?`;
  db.query(sql, values, cb);
};

// INCREMENT WO COUNT 
// Fully atomic — uses LEAST() to cap produced_so_far and IF() to flip status
const incrementWorkOrderCount = (machineId, quantity, cb) => {
  db.query(
    `UPDATE active_workorders
     SET
       produced_so_far = LEAST(produced_so_far + ?, target_quantity),
       last_updated    = NOW(),
       status          = IF(produced_so_far + ? >= target_quantity, 0, 1)
     WHERE machine_id = ? AND status = 1`,
    [quantity, quantity, machineId],
    (err, result) => {
      if (err) return cb(err, false, 0);
      if (!result || result.affectedRows === 0) return cb(null, false, 0);

      db.query(
        `SELECT produced_so_far, target_quantity
         FROM active_workorders
         WHERE machine_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [machineId],
        (err2, rows) => {
          if (err2 || !rows || rows.length === 0) return cb(null, false, quantity);

          const wo            = rows[0];
          const targetReached = wo.produced_so_far >= wo.target_quantity;
          const actualCount   = Math.min(quantity, wo.target_quantity - (wo.produced_so_far - quantity));

          cb(null, targetReached, Math.max(actualCount, 0));
        }
      );
    }
  );
};

const NEAR_TARGET_THRESHOLD = 0.90;

const getWorkOrdersNearTarget = (cb) =>
  db.query(
    `SELECT wo.*, m.machine_name
     FROM active_workorders wo
     JOIN machines m ON wo.machine_id = m.id
     WHERE wo.status = 1
       AND wo.produced_so_far >= wo.target_quantity * ?
     ORDER BY (wo.produced_so_far / wo.target_quantity) DESC`,
    [NEAR_TARGET_THRESHOLD],
    cb
  );

const closeWorkOrder = (workorder_number, cb) =>
  db.query(
    `UPDATE active_workorders SET status = 0 WHERE workorder_number = ?`,
    [workorder_number], cb
  );

const reopenWorkOrder = (workorder_number, cb) =>
  db.query(
    `UPDATE active_workorders SET status = 1 WHERE workorder_number = ?`,
    [workorder_number], cb
  );

const deleteWorkOrder = (id, cb) =>
  db.query(`DELETE FROM active_workorders WHERE id = ?`, [id], cb);

const activateWorkOrder = (machineId, cb) =>
  db.query(
    `UPDATE active_workorders
     SET status = 1, last_updated = NOW()
     WHERE machine_id = ? AND status = 0`,
    [machineId], cb
  );

const deactivateWorkOrder = (machineId, cb) =>
  db.query(
    `UPDATE active_workorders SET status = 0
     WHERE machine_id = ? AND status = 1`,
    [machineId], cb
  );

// PRODUCTION LOGS
const insertProductionEntry = (workorder_number, part_name, machine_id, quantity, cb) => {
  const now      = new Date();
  const today    = now.toISOString().slice(0, 10);
  const hh       = String(now.getHours()).padStart(2, "0");
  const hourTime = today + " " + hh + ":00:00";

  db.query(
    "INSERT INTO production_logs (workorder_number, part_name, machine_id, quantity, hour_time, produced_at) " +
    "VALUES (?, ?, ?, ?, ?, NOW()) " +
    "ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), produced_at = NOW()",
    [workorder_number, part_name, machine_id, quantity, hourTime], cb
  );
};


const initHourlyRowsForAllActiveWO = (hr, cb) => {
  const today    = new Date().toISOString().slice(0, 10);
  const hh       = String(hr).padStart(2, "0");
  const hourTime = today + " " + hh + ":00:00";

  db.query(
    "SELECT workorder_number, product_name, machine_id FROM active_workorders WHERE status = 1",
    (err, workorders) => {
      if (err || !workorders || workorders.length === 0) return cb && cb(null);

      let completed = 0;

      workorders.forEach((wo) => {
        db.query(
          "INSERT IGNORE INTO production_logs (workorder_number, part_name, machine_id, quantity, hour_time, produced_at) " +
          "VALUES (?, ?, ?, 0, ?, NOW())",
          [wo.workorder_number, wo.product_name, wo.machine_id, hourTime],
          () => {
            completed++;
            if (completed === workorders.length && cb) cb(null);
          }
        );
      });
    }
  );
};

const getProductionLogs = (cb) =>
  db.query(
    `SELECT pl.*, m.machine_name
     FROM production_logs pl
     JOIN machines m ON pl.machine_id = m.id
     ORDER BY pl.produced_at DESC
     LIMIT 100`,
    cb
  );

const getProductionLogsByWorkOrder = (workorder_number, cb) =>
  db.query(
    `SELECT pl.*, m.machine_name
     FROM production_logs pl
     JOIN machines m ON pl.machine_id = m.id
     WHERE pl.workorder_number = ?
     ORDER BY pl.produced_at DESC`,
    [workorder_number], cb
  );

const getProductionLogsByMachineToday = (machine_id, cb) =>
  db.query(
    `SELECT * FROM production_logs
     WHERE machine_id = ? AND DATE(produced_at) = CURDATE()
     ORDER BY produced_at DESC`,
    [machine_id], cb
  );

const getDailyProductionSummary = (cb) =>
  db.query(
    `SELECT
       workorder_number, part_name, machine_id,
       SUM(quantity)      AS total_produced,
       DATE(produced_at)  AS production_date
     FROM production_logs
     GROUP BY workorder_number, part_name, machine_id, DATE(produced_at)
     ORDER BY production_date DESC`,
    cb
  );

// UNALLOCATED PRODUCTION 
// Called when operator presses button but no active WO exists.
const logUnallocatedProduction = (machineId, quantity, reason, cb) => {
  const now      = new Date();
  const today    = now.toISOString().slice(0, 10);
  const hh       = String(now.getHours()).padStart(2, "0");
  const hourTime = today + " " + hh + ":00:00";

  db.query(
    `INSERT INTO unallocated_production (machine_id, quantity, reason, hour_time, pressed_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       quantity   = quantity + VALUES(quantity),
       reason     = VALUES(reason),
       pressed_at = NOW()`,
    [machineId, quantity, reason || "No active work order", hourTime],
    cb
  );
};

const getUnallocatedProduction = (cb) =>
  db.query(
    `SELECT u.machine_id, u.reason, u.hour_time,
            u.quantity, u.pressed_at, m.machine_name
     FROM unallocated_production u
     JOIN machines m ON u.machine_id = m.id
     WHERE DATE(u.pressed_at) = CURDATE()
     ORDER BY u.pressed_at DESC`,
    cb
  );

module.exports = {
  BUTTON_MACHINES,
  activateWorkOrder,
  deactivateWorkOrder,
  getAllWorkOrders,
  getActiveWorkOrders,
  getActiveWorkOrderByMachine,
  getWorkOrdersNearTarget,
  createWorkOrder,
  updateWorkOrder,
  incrementWorkOrderCount,
  closeWorkOrder,
  reopenWorkOrder,
  deleteWorkOrder,
  insertProductionEntry,
  initHourlyRowsForAllActiveWO,
  getProductionLogs,
  getProductionLogsByWorkOrder,
  getProductionLogsByMachineToday,
  getDailyProductionSummary,
  logUnallocatedProduction,
  getUnallocatedProduction,
  NEAR_TARGET_THRESHOLD,
};