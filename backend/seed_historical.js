/**
 * seed_historical.js
 * ─────────────────────────────────────────────────────────────
 * ONE-TIME SCRIPT — Run once from your project root:
 *   node seed_historical.js
 *
 * What it does:
 *  1. Deletes ALL existing rows from machine_1_logs through machine_8_logs.
 *  2. Inserts ONE row per machine per day from 2023-04-29 to 2026-04-28 (yesterday).
 *     - production_count    = random between 200 and 800
 *     - production_end_time = that day at 23:59:59
 *     - created_at          = that day at 00:00:01
 *  3. Today (2026-04-29) gets NO row — created on first real event.
 * ─────────────────────────────────────────────────────────────
 */
require("dotenv").config();
const db = require("./config/db");

const MACHINES   = [1, 2, 3, 4, 5, 6, 7, 8];
const START_DATE = new Date("2023-04-29"); // 3 years ago
const END_DATE   = new Date("2026-04-28"); // yesterday
const MIN_PROD   = 200;
const MAX_PROD   = 800;
const BATCH_SIZE = 500;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)))
  );
}

/** Array of "YYYY-MM-DD" strings from start to end inclusive */
function dateRange(start, end) {
  const dates = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

async function seed() {
  console.log("Starting historical data seed...\n");

  // Clear existing data 
  console.log(" Clearing existing data from all machine tables...");
  for (const id of MACHINES) {
    const table = `machine_${id}_logs`;
    try {
      const result = await runQuery(`DELETE FROM \`${table}\``);
      console.log(`  ${table} — ${result.affectedRows} rows deleted`);
    } catch (e) {
      console.warn(`   ${table} error:`, e.message);
    }
  }

  // STEP 2: Seed one row per machine per day 
  const dates = dateRange(START_DATE, END_DATE);
  const totalRows = dates.length * MACHINES.length;
  console.log(`\n ${dates.length} days  ${MACHINES.length} machines = ${totalRows} rows to insert...\n`);

  for (const machineId of MACHINES) {
    const table = `machine_${machineId}_logs`;
    process.stdout.write(`   Machine ${machineId} (${table})... `);

    // Build rows: [production_count, production_end_time, created_at]
    const rows = dates.map((day) => [
      randomInt(MIN_PROD, MAX_PROD),
      `${day} 23:59:59`,   // production_end_time — end of that working day
      `${day} 00:00:01`,   // created_at          — start of that day
    ]);

    // Batch insert
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch        = rows.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => "(?, ?, ?)").join(", ");
      await runQuery(
        `INSERT INTO \`${table}\` (production_count, production_end_time, created_at)
         VALUES ${placeholders}`,
        batch.flat()
      );
      inserted += batch.length;
    }
    console.log(` ${inserted} rows`);
  }

  console.log("\n Seed complete!");
  console.log("    Today (2026-04-29) intentionally has NO row.");
  console.log("    First button press / auto-tick will INSERT today's row.");
  console.log("    Every subsequent event will UPDATE that same row.\n");
  process.exit(0);
}

seed().catch((err) => {
  console.error("\n Seed failed:", err);
  process.exit(1);
});