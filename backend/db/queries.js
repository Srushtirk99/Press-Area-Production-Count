const db = require("../config/db");
const getLogTable = (machineId) => `machine_${machineId}_logs`;

// Returns the start/end datetime strings for a given hour on today's date.
// Used to find or create the correct hourly row in each machine's log table.
function getHourBounds(hr) {
  const today = new Date().toISOString().slice(0, 10);
  const hh    = String(hr).padStart(2, "0");

  return {
    start: `${today} ${hh}:00:00`,
    end:   `${today} ${hh}:59:59`,
  };
}

// AUTH
const getUserByEmail = (email, cb) =>
  db.query("SELECT * FROM users WHERE email = ?", [email], cb);

const getUserById = (id, cb) =>
  db.query("SELECT * FROM users WHERE id = ?", [id], cb);

const updatePassword = (hashedPassword, userId, cb) =>
  db.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, userId], cb);

const updateOtp = (otp, expiry, email, cb) =>
  db.query(
    "UPDATE users SET otp = ?, otp_expiry = ? WHERE email = ?",
    [otp, expiry, email], cb
  );

const verifyOtp = (email, otp, cb) =>
  db.query(
    "SELECT * FROM users WHERE email = ? AND otp = ? AND otp_expiry > NOW()",
    [email, otp], cb
  );

const resetPasswordByEmail = (hashedPassword, email, cb) =>
  db.query(
    "UPDATE users SET password = ?, otp = NULL, otp_expiry = NULL WHERE email = ?",
    [hashedPassword, email], cb
  );

// USERS
const getAllUsers = (cb) =>
  db.query("SELECT id, name, email, role FROM users", cb);

const insertUser = (name, email, hashedPassword, role, cb) =>
  db.query(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
    [name, email, hashedPassword, role], cb
  );

const updateUser = (name, email, role, userId, cb) =>
  db.query(
    "UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?",
    [name, email, role, userId], cb
  );

const deleteUser = (userId, cb) =>
  db.query("DELETE FROM users WHERE id = ?", [userId], cb);

// MACHINES
const getAllMachines = (cb) =>
  db.query("SELECT id, machine_name, cycle_time_seconds AS cycle_time, image FROM machines", cb);

const getMachineById = (machineId, cb) =>
  db.query("SELECT * FROM machines WHERE id = ?", [machineId], cb);

const createMachineTable = (machineId, cb) => {
  const table = getLogTable(machineId);

  db.query(
    `CREATE TABLE IF NOT EXISTS \`${table}\` (
      id                   INT          NOT NULL AUTO_INCREMENT,
      production_count     INT          NOT NULL DEFAULT 0,
      production_end_time  DATETIME     NULL,
      created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_created_at (created_at),
      INDEX idx_production_end_time (production_end_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    (err) => {
      if (err) {
        console.error(`[DB] Failed to create table ${table}:`, err.message);
        return cb(err);
      }
      console.log(`[DB] Table created: ${table}`);
      cb(null);
    }
  );
};

const dropMachineTable = (machineId, cb) => {
  const table = getLogTable(machineId);
  db.query(
    `DROP TABLE IF EXISTS \`${table}\``,
    (err) => {
      if (err) {
        console.error(`[DB] Failed to drop table ${table}:`, err.message);
        return cb(err);
      }
      console.log(`[DB] Table dropped: ${table}`);
      cb(null);
    }
  );
};

const insertMachine = (name, cycleTime, image, cb) =>
  db.query(
    "INSERT INTO machines (machine_name, cycle_time_seconds, image) VALUES (?, ?, ?)",
    [name, cycleTime, image],
    (err, result) => {
      if (err) return cb(err, null);
      cb(null, result.insertId);
    }
  );

const deleteMachine = (machineId, cb) =>
  db.query("DELETE FROM machines WHERE id = ?", [machineId], cb);

const resetMachineAutoIncrement = (cb) => {
  db.query(
    `SELECT IFNULL(MAX(id), 0) + 1 AS next_id FROM machines`,
    (err, rows) => {
      if (err) return cb(err);
      const nextId = rows[0].next_id;
      db.query(
        `ALTER TABLE machines AUTO_INCREMENT = ?`,
        [nextId],
        (err2) => {
          if (err2) console.error("[DB] Failed to reset AUTO_INCREMENT:", err2.message);
          cb(err2 || null);
        }
      );
    }
  );
};

const deleteProductionLogsByMachine = (machineId, cb) => {
  const table = getLogTable(machineId);
  db.query(`DELETE FROM \`${table}\``, cb);
};


const insertTodayHourlyRowsIfMissing = (machineId, cb) => {
  const hr             = new Date().getHours();
  const table          = getLogTable(machineId);
  const { start, end } = getHourBounds(hr);

  db.query(
    `INSERT INTO \`${table}\` (production_count, production_end_time, created_at)
     SELECT 0, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM \`${table}\` WHERE created_at = ?
     )`,
    [end, start, start],
    (err) => {
      if (err) console.error(`Init row failed for machine ${machineId}:`, err.message);
      cb(null);
    }
  );
};


const incrementHourlyCount = (machineId, count, cb) => {
  const table          = getLogTable(machineId);
  const hr             = new Date().getHours();
  const { start, end } = getHourBounds(hr);

  db.query(
    `SELECT id FROM \`${table}\` WHERE created_at = ? LIMIT 1`,
    [start],
    (err, rows) => {
      if (err) return cb(err);
      if (rows && rows.length > 0) {
        db.query(
          `UPDATE \`${table}\`
           SET production_count    = production_count + ?,
               production_end_time = NOW()
           WHERE id = ?`,
          [count, rows[0].id], cb
        );
      } else {
        db.query(
          `INSERT INTO \`${table}\` (production_count, production_end_time, created_at)
           VALUES (?, NOW(), ?)`,
          [count, start], cb
        );
      }
    }
  );
};


const insertNewHourRow = (machineId, hr, cb) => {
  const table          = getLogTable(machineId);
  const { start, end } = getHourBounds(hr);

  db.query(
    `INSERT INTO \`${table}\` (production_count, production_end_time, created_at)
     SELECT 0, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM \`${table}\` WHERE created_at = ?
     )`,
    [end, start, start], cb
  );
};

// RECENT PRESSES TABLE
// Used exclusively for the "Production in Last 5 Min" dashboard metric.
// Rows older than 5 minutes are cleaned up by a scheduled job in server.js.
const createRecentPressesTable = (cb) => {
  db.query(
    `CREATE TABLE IF NOT EXISTS recent_presses (
      id         INT      NOT NULL AUTO_INCREMENT,
      machine_id INT      NOT NULL,
      count      INT      NOT NULL DEFAULT 1,
      pressed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_machine_pressed (machine_id, pressed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    (err) => {
      if (err) {
        console.error("[DB] Failed to create recent_presses table:", err.message);
        return cb(err);
      }
      cb(null);
    }
  );
};

// Insert one row into recent_presses each time a piece is produced.
const logRecentPress = (machineId, count, cb) => {
  db.query(
    `INSERT INTO recent_presses (machine_id, count) VALUES (?, ?)`,
    [machineId, count],
    (err) => {
      if (err) console.error(`[recent_presses] Insert failed for machine ${machineId}:`, err.message);
      if (cb) cb(err || null);
    }
  );
};

// Delete rows older than 5 minutes — called every 5 minutes by server.js.
const cleanOldRecentPresses = (cb) => {
  db.query(
    `DELETE FROM recent_presses WHERE pressed_at < NOW() - INTERVAL 5 MINUTE`,
    (err) => {
      if (err) console.error("[recent_presses] Cleanup failed:", err.message);
      if (cb) cb(err || null);
    }
  );
};

// Get 5-min count for a single machine from recent_presses.
const getRecentPressCount = (machineId, cb) => {
  db.query(
    `SELECT IFNULL(SUM(count), 0) AS count_5min
     FROM recent_presses
     WHERE machine_id = ?
       AND pressed_at >= NOW() - INTERVAL 5 MINUTE`,
    [machineId],
    (err, rows) => {
      if (err) return cb(err, 0);
      cb(null, rows[0]?.count_5min ?? 0);
    }
  );
};

// DASHBOARD STATS
const getDashboardStats = (machineId, cb) => {
  const table = getLogTable(machineId);
  db.query(
    `SELECT IFNULL(SUM(production_count), 0) AS total_today,
            MAX(production_end_time)          AS last_production_time
     FROM \`${table}\`
     WHERE DATE(created_at) = CURDATE()`,
    (err, rows1) => {
      if (err) return cb(err);
      const total_today          = rows1[0]?.total_today          ?? 0;
      const last_production_time = rows1[0]?.last_production_time ?? null;

      db.query(
        `SELECT production_count,
                GREATEST(TIMESTAMPDIFF(MINUTE, created_at, NOW()), 1) AS mins_elapsed
         FROM \`${table}\`
         WHERE DATE(created_at) = CURDATE()
         ORDER BY created_at DESC
         LIMIT 1`,
        (err, rows2) => {
          if (err) return cb(err);
          const production_count = rows2[0]?.production_count ?? 0;
          const mins_elapsed     = rows2[0]?.mins_elapsed     ?? 1;
          const perMinute        = production_count / mins_elapsed;
          const current_rate     = Math.round(perMinute * 60);

          cb(null, [{
            total_today,
            last_production_time,
            current_hour_count: production_count,
            current_run_rate:   current_rate,
          }]);
        }
      );
    }
  );
};

// PRODUCTION LOGS
const getProductionLogs = (machineId, cb) => {
  const table = getLogTable(machineId);
  db.query(
    `SELECT production_count, production_end_time, created_at
     FROM \`${table}\`
     ORDER BY id DESC
     LIMIT 50`,
    cb
  );
};

// DAILY SUMMARY
const getDailySummary = (machineId, from, to, cb) => {
  const table = getLogTable(machineId);
  db.query(
    `SELECT
       DATE(created_at)         AS day_date,
       SUM(production_count)    AS total_production,
       MIN(created_at)          AS shift_start,
       MAX(production_end_time) AS shift_end
     FROM \`${table}\`
     WHERE DATE(created_at) BETWEEN ? AND ?
     GROUP BY DATE(created_at)
     ORDER BY DATE(created_at) ASC`,
    [from, to], cb
  );
};

// HOURLY SUMMARY
const getHourlySummary = (machineId, from, to, cb) => {
  const table = getLogTable(machineId);
  db.query(
    `SELECT created_at AS hour_time, production_count AS total_production
     FROM \`${table}\`
     WHERE created_at BETWEEN ? AND ?
     ORDER BY created_at ASC`,
    [from, to], cb
  );
};

module.exports = {
  getUserByEmail, getUserById, updatePassword, updateOtp,
  verifyOtp, resetPasswordByEmail,
  getAllUsers, insertUser, updateUser, deleteUser,
  getAllMachines, getMachineById,
  insertMachine,
  createMachineTable,
  dropMachineTable,
  deleteMachine,
  resetMachineAutoIncrement,
  deleteProductionLogsByMachine,
  getProductionLogs,
  insertTodayHourlyRowsIfMissing,
  insertNewHourRow,
  incrementHourlyCount,
  getDashboardStats,
  getDailySummary,
  getHourlySummary,
  createRecentPressesTable,
  logRecentPress,
  cleanOldRecentPresses,
  getRecentPressCount,
};