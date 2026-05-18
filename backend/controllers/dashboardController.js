const db = require("../config/db");

const getLogTable = (machineId) => `machine_${machineId}_logs`;

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const computeMetrics = ({ pieces5min, cycleTimeSeconds }) => {
  const safePieces     = Math.max(0, toNum(pieces5min, 0));
  const safeCycleTime  = Math.max(0, toNum(cycleTimeSeconds, 0));

  // Max rate: theoretical pieces per hour at 0% idle
  const maxRate = safeCycleTime > 0 ? Math.floor(3600 / safeCycleTime) : 0;

  // Current rate: extrapolate the last 5 min to an hourly rate.
  // Capped at maxRate — a machine physically cannot exceed its rated cycle time.
  const rawCurrentRate = Math.round((safePieces / 5) * 60);
  const currentRate    = Math.min(rawCurrentRate, maxRate);

  // Efficiency: current rate as % of max (0–100%)
  const rawEfficiency = maxRate > 0 ? (currentRate / maxRate) * 100 : 0;
  const efficiency    = Number(Math.min(rawEfficiency, 100).toFixed(1));

  // Idle seconds: time lost in the last 5 min window
  const idealPieces5min = safeCycleTime > 0 ? 300 / safeCycleTime : 0;
  const idlePieces      = Math.max(0, idealPieces5min - safePieces);
  const idleSeconds     = Math.round(idlePieces * safeCycleTime);
  return { maxRate, currentRate, efficiency, idleSeconds };
};


exports.getDashboard = (req, res) => {
  db.query(
    "SELECT id, machine_name, image, cycle_time_seconds FROM machines ORDER BY id ASC",

    (err, machines) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false });
      }

      if (!machines || machines.length === 0)
        return res.json({ success: true, data: [] });

      const enrichedData = [];
      let completed = 0;

      machines.forEach((machine) => {
        const table = getLogTable(machine.id);

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
            if (err2) console.error(`[dashboard] Query failed for machine ${machine.id}:`, err2.message);
            const base = (!err2 && rows && rows[0])
              ? rows[0]
              : { total_today: 0, window_30min_count: 0 };

            // window_5min_count from recent_presses table:
            // Each production event (button press or auto-tick) inserts one row there.
            db.query(
              `SELECT IFNULL(SUM(count), 0) AS window_5min_count
               FROM recent_presses
               WHERE machine_id = ?
                 AND pressed_at >= NOW() - INTERVAL 5 MINUTE`,

              [machine.id],

              (err3, recentRows) => {
                const window_5min_count = (!err3 && recentRows && recentRows[0])
                  ? toNum(recentRows[0].window_5min_count)
                  : 0;

                const { maxRate, currentRate, efficiency, idleSeconds } = computeMetrics({
                  pieces5min:       window_5min_count,
                  cycleTimeSeconds: machine.cycle_time_seconds,
                });

                db.query(
                  `SELECT IFNULL(SUM(quantity), 0) AS unallocated_total
                   FROM unallocated_production
                   WHERE machine_id = ?`,

                  [machine.id],

                  (err4, extraRows) => {
                    const unallocatedTotal =
                      !err4 && extraRows && extraRows[0]
                        ? toNum(extraRows[0].unallocated_total)
                        : 0;

                    enrichedData.push({
                      machine_id:         machine.id,
                      machine_name:       machine.machine_name,
                      image:              machine.image,
                      cycle_time_sec:     machine.cycle_time_seconds,
                      total_today:        toNum(base.total_today),
                      window_5min_count,                              
                      window_30min_count: toNum(base.window_30min_count),  
                      max_rate:           maxRate,                   
                      current_rate:       currentRate,                
                      efficiency:         efficiency,                 
                      idle_seconds:       idleSeconds,              
                      unallocated_total:  unallocatedTotal,
                    });

                    completed++;

                    if (completed === machines.length) {
                      enrichedData.sort((a, b) => a.machine_id - b.machine_id);
                      res.json({ success: true, data: enrichedData });
                    }});
              });
          });
      });
    });
};



// Returns per-hour efficiency for today
// Each DB row = one hour. For completed hours, use actual piece count.
// For the current (incomplete) hour, use the 5-min rolling rate extrapolated.
exports.getEfficiencyHistory = (req, res) => {
  const machineId = req.params.machineId;
  const table     = getLogTable(machineId);

  const query = `
    SELECT
      DATE_FORMAT(created_at, '%H:%i')  AS time_slot,
      production_count                  AS pieces_this_hour,
      CASE
        WHEN HOUR(created_at) < HOUR(NOW()) THEN 60
        ELSE GREATEST(TIMESTAMPDIFF(MINUTE, created_at, NOW()), 1)
      END                               AS mins_in_hour
    FROM \`${table}\`
    WHERE DATE(created_at) = CURDATE()
    ORDER BY created_at ASC
  `;

  db.query(query, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }

    db.query(
      "SELECT cycle_time_seconds FROM machines WHERE id = ?",

      [machineId],

      (err2, machineData) => {
        if (err2 || !machineData || machineData.length === 0)
          return res.status(500).json({ success: false });

        const cycleTime = toNum(machineData[0].cycle_time_seconds, 0);
        const maxRate   = cycleTime > 0 ? Math.floor(3600 / cycleTime) : 0;

        const history = result.map((row) => {
          const hourlyRate    = Math.round((toNum(row.pieces_this_hour) / toNum(row.mins_in_hour, 1)) * 60);
          const rawEfficiency = maxRate > 0 ? (hourlyRate / maxRate) * 100 : 0;
          const efficiency    = Number(Math.min(rawEfficiency, 100).toFixed(1));

          return {
            time:        row.time_slot,
            hourly_rate: hourlyRate,
            efficiency:  efficiency,
          };
        });

        res.json({
          success:            true,
          machine_id:         Number(machineId),
          max_rate:           maxRate,
          efficiency_history: history,
        });
      });
  });
};


exports.getProductionSummary = (req, res) => {
  const machineId = req.params.machineId;
  const table     = getLogTable(machineId);
  const hourlyQuery = `
    SELECT
      HOUR(created_at)                 AS hour,
      IFNULL(SUM(production_count), 0) AS production
    FROM \`${table}\`
    WHERE DATE(created_at) = CURDATE()
    GROUP BY HOUR(created_at)
    ORDER BY hour ASC
  `;

  const dailyQuery = `
    SELECT
      DATE_FORMAT(created_at, '%Y-%m-%d') AS day,
      IFNULL(SUM(production_count), 0)    AS production
    FROM \`${table}\`
    WHERE created_at >= CURDATE() - INTERVAL 7 DAY
    GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
    ORDER BY day ASC
  `;

  db.query(hourlyQuery, (err, hourlyResult) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }

    db.query(dailyQuery, (err2, dailyResult) => {
      if (err2) {
        console.error(err2);
        return res.status(500).json({ success: false });
      }

      res.json({
        machine_id: machineId,

        hourlyProduction: (hourlyResult || []).map((row) => ({
          hour:       row.hour,
          production: row.production,
        })),

        dailyProduction: (dailyResult || []).map((row) => ({
          day:        row.day,
          production: row.production,
        })),
      });
    });
  });
};