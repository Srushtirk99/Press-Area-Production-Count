require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not defined");
  process.exit(1);
}

const express    = require("express");
const cors       = require("cors");
const http       = require("http");
const { Server } = require("socket.io");
const jwt        = require("jsonwebtoken");

const {
  insertTodayHourlyRowsIfMissing,
  insertNewHourRow,
  incrementHourlyCount,
  createRecentPressesTable,
  logRecentPress,
  cleanOldRecentPresses,
} = require("./db/queries");

const {
  getActiveWorkOrderByMachine,
  incrementWorkOrderCount,
  insertProductionEntry,
  activateWorkOrder,
  deactivateWorkOrder,
  logUnallocatedProduction,
  BUTTON_MACHINES,   // machines 1–5 — ESP32 button operated, defined in workorderQueries.js
} = require("./db/workorderQueries");

const db     = require("./config/db");
const app    = express();
const server = http.createServer(app);

// Auto-tick registry 
const autoTickActive = new Set();
const lastPressTime   = {};
const DEBOUNCE_MS     = 500;
const SIMULTANEOUS_MS = 500;
const pressWindow     = {};
const idleTimers      = {};
const IDLE_TIMEOUT_MS = 90000;

function resetIdleTimer(machineId) {
  if (idleTimers[machineId]) clearTimeout(idleTimers[machineId]);
  idleTimers[machineId] = setTimeout(() => {
    deactivateWorkOrder(machineId, () => {});
  }, IDLE_TIMEOUT_MS);
}

/*SOCKET.IO*/
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Auth error"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error("Auth error"));
  }
});

/* DASHBOARD DATA BUILDER */
const getLogTable = (machineId) => `machine_${machineId}_logs`;

const _toNum = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

const _computeMetrics = ({ pieces5min, cycleTimeSeconds }) => {
  const safePieces    = Math.max(0, _toNum(pieces5min, 0));
  const safeCycleTime = Math.max(0, _toNum(cycleTimeSeconds, 0));
  const maxRate        = safeCycleTime > 0 ? Math.floor(3600 / safeCycleTime) : 0;
  const rawCurrentRate = Math.round((safePieces / 5) * 60);
  const currentRate    = Math.min(rawCurrentRate, maxRate); 
  const rawEfficiency  = maxRate > 0 ? (currentRate / maxRate) * 100 : 0;
  const efficiency     = Number(Math.min(rawEfficiency, 100).toFixed(1));
  const idealPieces5min = safeCycleTime > 0 ? 300 / safeCycleTime : 0;
  const idleSeconds     = Math.round(Math.max(0, idealPieces5min - safePieces) * safeCycleTime);
  return { maxRate, currentRate, efficiency, idleSeconds };
};

const fetchDashboardData = (callback) => {
  db.query(
    "SELECT id, machine_name, image, cycle_time_seconds FROM machines ORDER BY id ASC",

    (err, machines) => {
      if (err || !machines || machines.length === 0) return callback([]);

      const promises = machines.map((m) =>
        new Promise((resolve) => {
          const table = getLogTable(m.id);

          db.query(
            `SELECT
              IFNULL(SUM(
                CASE WHEN DATE(created_at) = CURDATE()
                THEN production_count END
              ), 0) AS total_today,

              IFNULL(SUM(
                CASE WHEN created_at >= NOW() - INTERVAL 30 MINUTE
                THEN production_count END
              ), 0) AS window_30min_count
            FROM \`${table}\``,

            (err2, rows) => {
              if (err2) console.error(`[dashboard] Query failed for machine ${m.id}:`, err2.message);

              const base = (!err2 && rows && rows[0])
                ? rows[0]
                : { total_today: 0, window_30min_count: 0 };


              db.query(
                `SELECT IFNULL(SUM(count), 0) AS window_5min_count
                 FROM recent_presses
                 WHERE machine_id = ?
                   AND pressed_at >= NOW() - INTERVAL 5 MINUTE`,

                [m.id],

                (err3, recentRows) => {
                  const window_5min_count = (!err3 && recentRows && recentRows[0])
                    ? _toNum(recentRows[0].window_5min_count)
                    : 0;

                  const { maxRate, currentRate, efficiency, idleSeconds } = _computeMetrics({
                    pieces5min:       window_5min_count,
                    cycleTimeSeconds: m.cycle_time_seconds,
                  });

                  db.query(
                    `SELECT IFNULL(SUM(quantity), 0) AS unallocated_total
                     FROM unallocated_production
                     WHERE machine_id = ?`,

                    [m.id],

                    (err4, extraRows) => {
                      const unallocatedTotal =
                        !err4 && extraRows && extraRows[0]
                          ? _toNum(extraRows[0].unallocated_total)

                          : 0;

                      resolve({
                        machine_id:         m.id,
                        machine_name:       m.machine_name,
                        image:              m.image,
                        cycle_time_sec:     m.cycle_time_seconds,
                        total_today:        _toNum(base.total_today),
                        window_5min_count,
                        window_30min_count: _toNum(base.window_30min_count),
                        max_rate:           maxRate,
                        current_rate:       currentRate,
                        efficiency:         efficiency,
                        idle_seconds:       idleSeconds,
                        unallocated_total:  unallocatedTotal,
                      });
                    }
                  );
                }
              );
            }
          );
        })
      );

      Promise.all(promises).then((enriched) => {
        enriched.sort((a, b) => a.machine_id - b.machine_id);
        callback(enriched);
      });
    }
  );
};

/* SOCKET */
io.on("connection", (socket) => {
  let dashboardDebounceTimer = null;

  socket.on("request_dashboard_data", () => {
    if (dashboardDebounceTimer) clearTimeout(dashboardDebounceTimer);

    dashboardDebounceTimer = setTimeout(() => {
      dashboardDebounceTimer = null;
      fetchDashboardData((data) => socket.emit("dashboardData", data));
    }, 100);
  });

  socket.on("disconnect", () => {
    if (dashboardDebounceTimer) clearTimeout(dashboardDebounceTimer);
  });
});

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use("/uploads", express.static("uploads"));


function recordProduction(machineId, count, cb) {
 
  if (BUTTON_MACHINES.includes(machineId)) {
    activateWorkOrder(machineId, () => {
      resetIdleTimer(machineId);
      _doRecord(machineId, count, cb);
    });

  } else {
    _doRecord(machineId, count, cb);
  }
}

function _doRecord(machineId, count, cb) {
  logRecentPress(machineId, count, () => {});

  getActiveWorkOrderByMachine(machineId, (err, rows) => {
    if (err || !rows || rows.length === 0) {
      logUnallocatedProduction(machineId, count, "No active work order", (logErr) => {
        if (logErr) console.error(`[unallocated] INSERT failed for machine ${machineId}:`, logErr.message, logErr.sqlMessage);


      });
      incrementHourlyCount(machineId, count, () => {});
      return cb(null);
    }

    const wo = rows[0];

    if (wo.produced_so_far >= wo.target_quantity) {
      console.log(`[prod] Machine ${machineId} WO ${wo.workorder_number} complete — logging as unallocated.`);
      db.query("UPDATE active_workorders SET status = 0 WHERE id = ?", [wo.id], () => {});
      logUnallocatedProduction(machineId, count, `WO ${wo.workorder_number} already completed`, (logErr) => {
        if (logErr) console.error(`[unallocated] INSERT failed for machine ${machineId}:`, logErr.message, logErr.sqlMessage);

        else        console.log(`[unallocated] Logged ${count} unallocated pcs for machine ${machineId} (WO complete)`);

      });

      incrementHourlyCount(machineId, count, () => {});
      return cb(null);
    }

    incrementHourlyCount(machineId, count, (err) => {
      if (err) return cb(err);

      incrementWorkOrderCount(machineId, count, (err2, targetReached, actualCount) => {
        if (err2) return cb(null);

        if (targetReached) {
          console.log(`[WO] Machine ${machineId} completed WO: ${wo.workorder_number} (${wo.product_name})`);

          io.emit("workorder_completed", {
            machine_id:       machineId,
            workorder_number: wo.workorder_number,
            product_name:     wo.product_name,
            target_quantity:  wo.target_quantity,
          });
        }

        const logCount = (typeof actualCount === "number" && actualCount > 0) ? actualCount : count;

        if (logCount > 0) {
          insertProductionEntry(wo.workorder_number, wo.product_name, machineId, logCount, () => {});
        }
        cb(null);
      });
    });
  });
}

/* ESP32 BUTTON INPUT (Machines 1–5)*/

app.get("/press:machineId/input", (req, res) => {
  const machineId = parseInt(req.params.machineId);

  if (!machineId || isNaN(machineId))
    return res.status(400).json({ error: "Invalid machine ID" });

  const now = Date.now();

  if (lastPressTime[machineId] && (now - lastPressTime[machineId]) < DEBOUNCE_MS)
    return res.status(200).json({ success: true, message: "Debounced, ignored" });
  lastPressTime[machineId] = now;
  const otherMachines = Object.keys(pressWindow).filter((id) => parseInt(id) !== machineId);
  if (otherMachines.length > 0) {
    otherMachines.forEach((id) => { clearTimeout(pressWindow[id]); delete pressWindow[id]; });
    if (pressWindow[machineId]) { clearTimeout(pressWindow[machineId]); delete pressWindow[machineId]; }
    return res.status(200).json({ success: true, message: "Simultaneous press ignored" });
  }
  if (!pressWindow[machineId]) {
    pressWindow[machineId] = setTimeout(() => {
      delete pressWindow[machineId];
      recordProduction(machineId, 1, (err) => {
        if (err) return;
        fetchDashboardData((data) => io.emit("dashboardData", data));
      });
    }, SIMULTANEOUS_MS);
  }
  res.status(200).json({ success: true, machine_id: machineId });
});

/* POST: Manual trigger  */
app.post("/api/production/update", (req, res) => {
  try {
    const { machine, status } = req.body;
    const machineId = parseInt(machine);

    if (!machineId || isNaN(machineId) || status !== "pressed")
      return res.status(400).json({ error: "Invalid data" });

   
    recordProduction(machineId, 1, (err) => {
      if (err) return res.status(500).json({ error: "Database error" });
      fetchDashboardData((data) => io.emit("dashboardData", data));
      res.status(200).json({ success: true, machine: machineId });
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});



const CYCLE_REFRESH_EVERY = 60;

const machineTickState = {};

function scheduleAutoTick(machineId) {
  if (!autoTickActive.has(machineId)) return;
  const state = machineTickState[machineId];
  const needsFetch = !state || (state.tickCount % CYCLE_REFRESH_EVERY === 0);
  if (needsFetch) {
    db.query(
      "SELECT cycle_time_seconds FROM machines WHERE id = ?",
      [machineId],
      (err, rows) => {
        if (!autoTickActive.has(machineId)) return; // deleted while querying
        if (err || !rows || rows.length === 0) {
          // Machine no longer exists — stop
          autoTickActive.delete(machineId);
          delete machineTickState[machineId];
          return;
        }
        const cycleMs = Math.max(1000, rows[0].cycle_time_seconds * 1000);
        machineTickState[machineId] = { cycleMs, tickCount: state ? state.tickCount : 0 };
        _doTick(machineId);
      }
    );
  } else {
    _doTick(machineId);
  }
}

function _doTick(machineId) {
  if (!autoTickActive.has(machineId)) return;
  const state   = machineTickState[machineId];
  const cycleMs = state ? state.cycleMs : 10000;

  // ── REALISTIC MACHINE BEHAVIOUR ───────────────────────────────────────────
  //   70% of cycles → normal speed      (cycle time ± 5%  variance)
  //   20% of cycles → slightly slow     (cycle time × 1.2 — minor slowdown)
  //    7% of cycles → short micro-stop  (cycle time × 2.5 — operator check)
  //    3% of cycles → longer stop       (cycle time × 5   — tool adjust)

  const roll = Math.random();
  let delay;

  if (roll < 0.70) {
    const variance = cycleMs * 0.05;
    delay = Math.round(cycleMs + (Math.random() * variance * 2) - variance);
  } else if (roll < 0.90) {
    const variance = cycleMs * 0.05;
    delay = Math.round(cycleMs * 1.2 + (Math.random() * variance * 2) - variance);
  } else if (roll < 0.97) {
    delay = Math.round(cycleMs * 2.5);
  } else {
    delay = Math.round(cycleMs * 5);
  }
  setTimeout(() => {
    if (!autoTickActive.has(machineId)) return;
    if (machineTickState[machineId]) machineTickState[machineId].tickCount++;

    recordProduction(machineId, 1, (err) => {
      if (!err) fetchDashboardData((data) => io.emit("dashboardData", data));
    });
    scheduleAutoTick(machineId);
  }, delay);
}


function startAutoTick(machineId) {
  if (BUTTON_MACHINES.includes(machineId)) return; 
  if (autoTickActive.has(machineId)) return;        
  autoTickActive.add(machineId);
  delete machineTickState[machineId];               
  activateWorkOrder(machineId, () => {});
  scheduleAutoTick(machineId);
  console.log(`[autoTick] Started tick for machine ${machineId}`);
}


function stopAutoTick(machineId) {
  autoTickActive.delete(machineId);
  delete machineTickState[machineId];
  console.log(`[autoTick] Stopped tick for machine ${machineId}`);
}


function onMachineAdded(machineId) {
  insertTodayHourlyRowsIfMissing(machineId, () => {
    console.log(`[server] Hourly row initialised for new machine ${machineId}`);
  });
  startAutoTick(machineId);
}

function onMachineDeleted(machineId) {
  stopAutoTick(machineId);
  if (idleTimers[machineId]) {
    clearTimeout(idleTimers[machineId]);
    delete idleTimers[machineId];
  }

  if (pressWindow[machineId]) {
    clearTimeout(pressWindow[machineId]);
    delete pressWindow[machineId];
  }
  delete lastPressTime[machineId];
  console.log(`[server] Cleaned up runtime state for deleted machine ${machineId}`);
}


app.set("onMachineAdded",   onMachineAdded);
app.set("onMachineDeleted", onMachineDeleted);


let lastTrackedHour = -1;

function startHourlyRowScheduler() {
  setInterval(() => {
    const hr = new Date().getHours();
    if (hr !== lastTrackedHour) {
      lastTrackedHour = hr;

      db.query("SELECT id FROM machines ORDER BY id ASC", (err, machines) => {
        if (err || !machines) return;
        machines.forEach((m) => insertNewHourRow(m.id, hr, () => {}));
      });
    }
  }, 60000);
}

/* RECENT PRESSES CLEANUP JOB*/
// Deletes rows older than 5 minutes every 5 minutes.
// Keeps the recent_presses table lean — only last 5 min of data lives here.
function startRecentPressesCleanup() {
  setInterval(() => {
    cleanOldRecentPresses(() => {});
  }, 5 * 60 * 1000); // every 5 minutes
}

/* ROUTES  */
app.use("/api/workorders", require("./routes/workorderRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/machines", require("./routes/machineRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/production", require("./routes/ProductionLogs"));   
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/report", require("./routes/reportRoutes"));
app.use("/api/alarms", require("./routes/alarmRoutes"));
app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.use((err, req, res, next) => res.status(500).json({ error: "Something went wrong" }));

//START //
function initTodayRows(callback) {
  db.query("SELECT id FROM machines ORDER BY id ASC", (err, machines) => {
    if (err || !machines || machines.length === 0) {
      console.warn("[init] No machines found in DB");
      return callback && callback();
    }
    let completed = 0;
    machines.forEach((m) => {
      insertTodayHourlyRowsIfMissing(m.id, () => {
        completed++;
        if (completed === machines.length && callback) callback();
      });
    });
  });
}

server.listen(5000, "0.0.0.0", () => {
  console.log("Server running");

  createRecentPressesTable((err) => {
    if (err) console.error("[init] recent_presses table creation failed:", err.message);
    initTodayRows(() => {
      db.query("SELECT id FROM machines ORDER BY id ASC", (err, machines) => {
        if (err || !machines) return;
        machines.forEach((m) => startAutoTick(m.id));
        startHourlyRowScheduler();
        startRecentPressesCleanup();
      });
    });
  });
});