// controllers/alarmController.js
const db = require("../config/db");
const { getWorkOrdersNearTarget, NEAR_TARGET_THRESHOLD } = require("../db/workorderQueries");

const getLogTable = (machineId) => `machine_${machineId}_logs`;


const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });


//Produced in last 5 mins	-> running
//No production in 5 mins but yes in 30 mins ->	idle
//No production in 30 mins->	stopped  
const buildAlarmEntry = (machine, stats) => {
  const { total_today, window_5min_count, window_30min_count } = stats;

  let machine_status, severity, message;

  if (window_5min_count > 0) {
    machine_status = "running";
    severity       = "normal";
    message        = `Running  •  Today: ${total_today} pcs`;
  } else if (window_30min_count > 0) {
    machine_status = "idle";
    severity       = "warning";
    message        = `Idle  •  No output in last 5 min`;
  } else {
    machine_status = "stopped";
    severity       = "critical";
    message        = total_today > 0
      ? `Stopped  •  No output in last 30 min`
      : `Stopped  •  No production today`;
  }

  return {
    id:               `${machine.id}-status`,
    machine_id:       machine.id,
    machine_name:     machine.machine_name,
    machine_status,
    message,
    severity,
    status:           machine_status === "running" ? "resolved" : "active",
    created_at:       new Date(),
    today_production: total_today,
  };
};



exports.getAlarms = async (req, res) => {
  try {
    const machines = await query(
      "SELECT id, machine_name FROM machines ORDER BY id ASC"
    );

    if (!machines.length) {
      return res.json({ success: true, data: [], workorder_alerts: [] });
    }

    // ── 1. Machine status alarms (running / idle / stopped) ──
    const alarmPromises = machines.map(async (machine) => {
      const table = getLogTable(machine.id);
      try {
        const rows = await query(
          `SELECT
            IFNULL(SUM(
              CASE WHEN DATE(production_end_time) = CURDATE()
              THEN production_count END
            ), 0) AS total_today,

            IFNULL(SUM(
              CASE WHEN production_end_time >= NOW() - INTERVAL 5 MINUTE
              THEN production_count END
            ), 0) AS window_5min_count,

            IFNULL(SUM(
              CASE WHEN production_end_time >= NOW() - INTERVAL 30 MINUTE
              THEN production_count END
            ), 0) AS window_30min_count

          FROM \`${table}\``
        );

        const stats = rows[0] ?? { total_today: 0, window_5min_count: 0, window_30min_count: 0 };
        return buildAlarmEntry(machine, stats);

      } catch (tableErr) {
        console.warn(`[alarms] Could not query ${table}:`, tableErr.message);
        return buildAlarmEntry(machine, { total_today: 0, window_5min_count: 0, window_30min_count: 0 });
      }
    });

    const alarms = await Promise.all(alarmPromises);

    // Sort: stopped → idle → running (critical first)
    const ORDER = { stopped: 0, idle: 1, running: 2 };
    alarms.sort((a, b) => ORDER[a.machine_status] - ORDER[b.machine_status]);

    // ── 2. Work order alerts (near target + completed/exceeded) ──
    // Fetch ALL work orders so we can flag both near-target and exceeded
    const workorders = await query(
      `SELECT wo.*, m.machine_name
       FROM active_workorders wo
       JOIN machines m ON wo.machine_id = m.id
       ORDER BY wo.machine_id ASC`
    );

    const workorder_alerts = [];

    workorders.forEach((wo) => {
      const percent = wo.target_quantity > 0
        ? (wo.produced_so_far / wo.target_quantity) * 100
        : 0;

      // Exceeded target (should be status=0, but catch any edge cases too)
      if (wo.produced_so_far > wo.target_quantity) {
        workorder_alerts.push({
          type:             "exceeded",
          severity:         "critical",
          machine_id:       wo.machine_id,
          machine_name:     wo.machine_name,
          workorder_number: wo.workorder_number,
          product_name:     wo.product_name,
          produced_so_far:  wo.produced_so_far,
          target_quantity:  wo.target_quantity,
          percent:          percent.toFixed(1),
          message:          `Target EXCEEDED: ${wo.produced_so_far}/${wo.target_quantity} (${percent.toFixed(1)}%) on ${wo.machine_name}`,
        });
      }
      // Exactly at target and now closed
      else if (wo.produced_so_far >= wo.target_quantity && wo.status === 0) {
        workorder_alerts.push({
          type:             "completed",
          severity:         "info",
          machine_id:       wo.machine_id,
          machine_name:     wo.machine_name,
          workorder_number: wo.workorder_number,
          product_name:     wo.product_name,
          produced_so_far:  wo.produced_so_far,
          target_quantity:  wo.target_quantity,
          percent:          "100.0",
          message:          `Work order complete: ${wo.workorder_number} (${wo.product_name}) on ${wo.machine_name}. Assign next WO to resume.`,
        });
      }
      // Approaching target (≥ NEAR_TARGET_THRESHOLD, still active)
      else if (
        wo.status === 1 &&
        wo.produced_so_far >= wo.target_quantity * NEAR_TARGET_THRESHOLD
      ) {
        const remaining = wo.target_quantity - wo.produced_so_far;
        workorder_alerts.push({
          type:             "near_target",
          severity:         "warning",
          machine_id:       wo.machine_id,
          machine_name:     wo.machine_name,
          workorder_number: wo.workorder_number,
          product_name:     wo.product_name,
          produced_so_far:  wo.produced_so_far,
          target_quantity:  wo.target_quantity,
          percent:          percent.toFixed(1),
          message:          `Approaching target: ${wo.produced_so_far}/${wo.target_quantity} (${percent.toFixed(1)}%) — ${remaining} pcs remaining on ${wo.machine_name}`,
        });
      }
    });

    // -- 3. Unallocated production alerts ---------------------------
    // Presses that happened with no active WO or after WO completed
    const unallocatedRows = await query(
      `SELECT u.machine_id, m.machine_name,
              SUM(u.quantity) AS total_unallocated,
              MAX(u.pressed_at) AS last_pressed,
              u.reason
       FROM unallocated_production u
       JOIN machines m ON u.machine_id = m.id
       WHERE DATE(u.pressed_at) = CURDATE()
       GROUP BY u.machine_id, m.machine_name, u.reason
       ORDER BY last_pressed DESC`
    );


    // production without WO
    const unallocated_alerts = unallocatedRows.map((row) => ({
      type:             "unallocated",
      severity:         "warning",
      machine_id:       row.machine_id,
      machine_name:     row.machine_name,
      total_unallocated: row.total_unallocated,
      last_pressed:     row.last_pressed,
      reason:           row.reason,
      message:          `Unallocated: ${row.total_unallocated} pcs pressed on ${row.machine_name} with no active WO today`,
    }));

    return res.json({
      success:          true,
      data:             alarms,          // machine status alarms (existing)
      workorder_alerts:   workorder_alerts,  // work order alerts
      unallocated_alerts: unallocated_alerts // presses with no active WO
    });

  } catch (err) {
    console.error("[alarms] getAlarms error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};