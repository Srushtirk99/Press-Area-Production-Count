// controllers/reportController.js
const db          = require("../config/db");
const ExcelJS     = require("exceljs");
const PDFDocument = require("pdfkit");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");

const isValidDate = (date) => {
  return !isNaN(Date.parse(date));
};


const getLogTable = (machineId) => `machine_${machineId}_logs`;


/**
 * Build SQL-safe from/to date strings.
 * For yearly, caller MUST pass explicit fromDate/toDate (YYYY-MM-DD).
 */
function buildDateRange(type, fromDate, toDate) {
  const to   = new Date();
  const from = new Date();

  if (type === "daily") {
    from.setDate(from.getDate() - 1);
  } else if (type === "weekly") {
    from.setDate(from.getDate() - 7);
  } else if (type === "monthly") {
    from.setMonth(from.getMonth() - 1);
  } else if (type === "yearly") {
    if (fromDate && toDate) {
      return { from: fromDate, to: toDate };
    }
    from.setFullYear(from.getFullYear() - 1);
  }

  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };
}

/** Fetch all machine IDs from the DB */
function getAllMachineIds(cb) {
  db.query("SELECT id FROM machines ORDER BY id ASC", (err, rows) => {
    if (err || !rows) return cb(err || new Error("No machines"), []);
    cb(null, rows.map((r) => r.id));
  });
}

/** Build a UNION ALL query across every machine's log table */
function buildCombinedUnion(machineIds, from, to) {
  const parts = machineIds.map(
    (id) =>
      `SELECT DATE(production_end_time) AS day, SUM(production_count) AS total ` +
      `FROM \`${getLogTable(id)}\` ` +
      `WHERE DATE(production_end_time) BETWEEN '${from}' AND '${to}' ` +
      `GROUP BY DATE(production_end_time)`
  );
  return (
    `SELECT day AS date, SUM(total) AS totalProduction ` +
    `FROM (${parts.join(" UNION ALL ")}) t ` +
    `GROUP BY day ORDER BY day ASC`
  );
}

/**
 * Collapse daily rows into monthly buckets for the chart.
 * Returns [{ key: "2025-04", label: "Apr 2025", total: 12345 }, ...]
 */
function aggregateByMonth(rows) {
  const map = {};
  rows.forEach((r) => {
    const d     = new Date(r.date);
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-IN", { month: "short", year: "numeric" });
    if (!map[key]) map[key] = { key, label, total: 0 };
    map[key].total += Number(r.totalProduction || 0);
  });
  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
}

/** Returns true when the date range spans more than 60 days */
function shouldAggregate(from, to) {
  return (new Date(to) - new Date(from)) / 86_400_000 > 60;
}

// SINGLE MACHINE: date-range daily totals 
exports.getMachineReport = (req, res) => {
  const { machineId, type } = req.params;
  const { from: qFrom, to: qTo } = req.query;
  const { from, to } = buildDateRange(type, qFrom, qTo);
  const table = getLogTable(machineId);

  db.query(
    `SELECT DATE(production_end_time) AS date, SUM(production_count) AS totalProduction
     FROM \`${table}\`
     WHERE DATE(production_end_time) BETWEEN ? AND ?
     GROUP BY DATE(production_end_time)
     ORDER BY DATE(production_end_time) ASC`,
    [from, to],
    (err, result) => {
      if (err) return res.status(500).json({ message: "DB Error", error: err.message });
      res.json(result);
    }
  );
};

//COMBINED: date-range daily totals across all machines
exports.getCombinedReport = (req, res) => {
  const { type } = req.params;
  const { from: qFrom, to: qTo } = req.query;
  const { from, to } = buildDateRange(type, qFrom, qTo);

  getAllMachineIds((err, ids) => {
    if (err || ids.length === 0)
      return res.status(500).json({ message: "No machines found" });

    db.query(buildCombinedUnion(ids, from, to), (err, result) => {
      if (err) return res.status(500).json({ message: "DB Error", error: err.message });
      res.json(result);
    });
  });
};

//YEARLY: from/to date range 
exports.getYearlyReport = (req, res) => {
  const { machineId } = req.params;
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({
      error: "from and to dates are required",
    });
  }

  if (!isValidDate(from) || !isValidDate(to)) {
    return res.status(400).json({
      error: "Invalid date format",
    });
  }

  if (machineId === "combined") {
    getAllMachineIds((err, ids) => {
      if (err || ids.length === 0)
        return res.status(500).json({ message: "No machines found" });

      db.query(buildCombinedUnion(ids, from, to), (err, result) => {
        if (err) return res.status(500).json({ message: "DB Error", error: err.message });
        res.json(result);
      });
    });
  } else {
    const table = getLogTable(machineId);
    db.query(
      `SELECT DATE(production_end_time) AS date, SUM(production_count) AS totalProduction
       FROM \`${table}\`
       WHERE DATE(production_end_time) BETWEEN ? AND ?
       GROUP BY DATE(production_end_time)
       ORDER BY DATE(production_end_time) ASC`,
      [from, to],
      (err, result) => {
        if (err) return res.status(500).json({ message: "DB Error", error: err.message });
        res.json(result);
      }
    );
  }
};

// HOURLY: single machine, today 
exports.getMachineHourlyReport = (req, res) => {
  const { machineId } = req.params;
  const table = getLogTable(machineId);

  db.query(
    `SELECT
       HOUR(production_end_time)        AS hour,
       SUM(production_count)            AS totalProduction
     FROM \`${table}\`
     WHERE DATE(production_end_time) = CURDATE()
     GROUP BY HOUR(production_end_time)
     ORDER BY hour ASC`,
    (err, result) => {
      if (err) return res.status(500).json({ message: "DB Error", error: err.message });

      const normalised = result.map((r) => ({
        hour_time:       `${String(r.hour).padStart(2, "0")}:00`,
        totalProduction: r.totalProduction,
      }));
      res.json(normalised);
    }
  );
};

// COMBINED HOURLY: all machines, today 
exports.getCombinedHourlyReport = (req, res) => {
  getAllMachineIds((err, ids) => {
    if (err || ids.length === 0)
      return res.status(500).json({ message: "No machines found" });

    const parts = ids.map(
      (id) =>
        `SELECT HOUR(production_end_time) AS hr, SUM(production_count) AS total ` +
        `FROM \`${getLogTable(id)}\` ` +
        `WHERE DATE(production_end_time) = CURDATE() ` +
        `GROUP BY HOUR(production_end_time)`
    );

    db.query(
      `SELECT hr AS hour, SUM(total) AS totalProduction
       FROM (${parts.join(" UNION ALL ")}) t
       GROUP BY hr ORDER BY hr ASC`,
      (err, result) => {
        if (err) return res.status(500).json({ message: "DB Error", error: err.message });
        const normalised = result.map((r) => ({
          hour_time:       `${String(r.hour).padStart(2, "0")}:00`,
          totalProduction: r.totalProduction,
        }));
        res.json(normalised);
      }
    );
  });
};

// CHART BUILDER 
async function buildLineChart(labels, values, title, color) {
  const canvas = new ChartJSNodeCanvas({ width: 700, height: 300, backgroundColour: "white" });
  return canvas.renderToBuffer({
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: title,
          data: values,
          backgroundColor: color + "22",
          borderColor: color,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius:      labels.length > 60 ? 0 : 3,
          pointHoverRadius: 4,
        },
      ],
    },
    options: {
      plugins: { legend: { display: true } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: {
          ticks: {
            maxRotation:   45,
            autoSkip:      true,
            maxTicksLimit: 24,
          },
        },
      },
    },
  });
}

// PDF LAYOUT HELPERS
function drawPDFHeader(doc, titleText, subtitleText, bgColor) {
  doc.rect(0, 0, doc.page.width, 70).fill(bgColor);
  doc.fillColor("#ffffff")
     .fontSize(20).font("Helvetica-Bold")
     .text(titleText, 50, 18, { align: "center", lineBreak: false });
  doc.fontSize(11).font("Helvetica")
     .text(subtitleText, 50, 46, { align: "center", lineBreak: false });
  doc.fillColor("#000000");
}


function drawSummaryBox(doc, total, from, to, accentColor, bgColor, borderColor) {
  const boxY = 82;
  const boxH = 34;
  doc.rect(50, boxY, doc.page.width - 100, boxH)
     .fill(bgColor)
     .stroke(borderColor);
  doc.fillColor(accentColor)
     .font("Helvetica-Bold").fontSize(11)
     .text(
       `Total Production: ${total.toLocaleString("en-IN")}   |   Period: ${from}  →  ${to}`,
       60, boxY + 10,
       { lineBreak: false }
     );
  doc.fillColor("#000000");
}


async function drawChartPage1(doc, rows, from, to, chartColor, chartLabel) {
  const agg    = shouldAggregate(from, to) ? aggregateByMonth(rows) : null;
  const labels = agg
    ? agg.map((m) => m.label)
    : rows.map((r) => new Date(r.date).toLocaleDateString("en-IN"));
  const values = agg
    ? agg.map((m) => m.total)
    : rows.map((r) => Number(r.totalProduction));
  const title  = agg ? `Monthly ${chartLabel}` : `Daily ${chartLabel}`;

  const img = await buildLineChart(labels, values, title, chartColor);
  doc.image(img, 50, 128, { width: doc.page.width - 100, height: 260 });
}


function drawDataTable(doc, rows, total, headerColor, evenRowColor, footerBgColor, footerTextColor) {
  doc.addPage();

  const pageW   = doc.page.width;
  const pageH   = doc.page.height;
  const col1    = 50;
  const col2    = 300;
  const tableX  = 50;
  const tableW  = pageW - 100;
  const rowH    = 22;
  const hdrH    = 26;

  
  function drawColHeaders(y) {
    doc.rect(tableX, y, tableW, hdrH).fill(headerColor);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11)
       .text("Date",       col1 + 8, y + 7, { lineBreak: false })
       .text("Production", col2,     y + 7, { lineBreak: false });
    doc.fillColor("#111111");
    return y + hdrH;
  }

  
  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(13)
     .text("Daily Production Detail", col1, 30, { lineBreak: false });
  doc.font("Helvetica").fontSize(9).fillColor("#666666")
     .text("Full daily breakdown for the selected date range", col1, 48, { lineBreak: false });
  doc.fillColor("#111111");

  let rowY = 68;
  rowY = drawColHeaders(rowY);

  rows.forEach((r, i) => {
    // Page break — keep 60 px at bottom for grand total footer
    if (rowY + rowH > pageH - 60) {
      doc.addPage();
      rowY = 30;
      rowY = drawColHeaders(rowY);
    }

    // Alternating row background
    if (i % 2 === 0) {
      doc.rect(tableX, rowY, tableW, rowH).fill(evenRowColor).stroke();
    }

    doc.fillColor("#111111").font("Helvetica").fontSize(10)
       .text(new Date(r.date).toLocaleDateString("en-IN"),          col1 + 8, rowY + 5, { lineBreak: false })
       .text(Number(r.totalProduction).toLocaleString("en-IN"),     col2,     rowY + 5, { lineBreak: false });

    rowY += rowH;
  });

  // Grand total footer
  if (rowY + 30 > pageH - 20) {
    doc.addPage();
    rowY = 50;
  }
  doc.rect(tableX, rowY + 6, tableW, 26).fill(footerBgColor);
  doc.fillColor(footerTextColor).font("Helvetica-Bold").fontSize(12)
     .text(`Grand Total: ${total.toLocaleString("en-IN")}`, col1 + 8, rowY + 13, { lineBreak: false });
}

// DOWNLOAD: PDF (machine)
exports.downloadMachinePDF = async (req, res) => {
  const { machineId, type } = req.params;
  const { from: qFrom, to: qTo } = req.query;
  const { from, to } = buildDateRange(type, qFrom, qTo);
  const table = getLogTable(machineId);

  db.query(
    `SELECT DATE(production_end_time) AS date, SUM(production_count) AS totalProduction
     FROM \`${table}\`
     WHERE DATE(production_end_time) BETWEEN ? AND ?
     GROUP BY DATE(production_end_time)
     ORDER BY DATE(production_end_time) ASC`,
    [from, to],
    async (err, rows) => {
      if (err) return res.status(500).json({ message: "DB Error" });

      const total = rows.reduce((s, r) => s + Number(r.totalProduction || 0), 0);

      const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=machine_${machineId}_${type}_${from}_${to}.pdf`
      );
      doc.pipe(res);

      drawPDFHeader(
        doc,
        `${type.toUpperCase()} PRODUCTION REPORT`,
        `Machine ${machineId}  ·  ${from}  →  ${to}`,
        "#1D4ED8"
      );
      drawSummaryBox(doc, total, from, to, "#1D4ED8", "#EFF6FF", "#BFDBFE");

      if (rows.length > 0) {
        await drawChartPage1(doc, rows, from, to, "#1D4ED8", "Production");
      }

      if (rows.length > 0) {
        drawDataTable(doc, rows, total, "#1D4ED8", "#F0F6FF", "#EFF6FF", "#1D4ED8");
      }

      doc.end();
    }
  );
};

// DOWNLOAD: PDF (combined)
exports.downloadCombinedPDF = async (req, res) => {
  const { type } = req.params;
  const { from: qFrom, to: qTo } = req.query;
  const { from, to } = buildDateRange(type, qFrom, qTo);

  getAllMachineIds(async (err, ids) => {
    if (err || ids.length === 0)
      return res.status(500).json({ message: "No machines found" });

    db.query(buildCombinedUnion(ids, from, to), async (err, rows) => {
      if (err) return res.status(500).json({ message: "DB Error" });

      const total = rows.reduce((s, r) => s + Number(r.totalProduction || 0), 0);

      const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=combined_${type}_${from}_${to}.pdf`
      );
      doc.pipe(res);

  
      drawPDFHeader(
        doc,
        `${type.toUpperCase()} COMBINED REPORT`,
        `All Machines  ·  ${from}  →  ${to}`,
        "#065F46"
      );
      drawSummaryBox(doc, total, from, to, "#065F46", "#ECFDF5", "#6EE7B7");

      if (rows.length > 0) {
        await drawChartPage1(doc, rows, from, to, "#065F46", "Combined");
      }

      if (rows.length > 0) {
        drawDataTable(doc, rows, total, "#065F46", "#F0FDF4", "#ECFDF5", "#065F46");
      }

      doc.end();
    });
  });
};

// DOWNLOAD: EXCEL (machine)
exports.downloadMachineExcel = async (req, res) => {
  const { machineId, type } = req.params;
  const { from: qFrom, to: qTo } = req.query;
  const { from, to } = buildDateRange(type, qFrom, qTo);
  const table = getLogTable(machineId);

  db.query(
    `SELECT DATE(production_end_time) AS date, SUM(production_count) AS totalProduction
     FROM \`${table}\`
     WHERE DATE(production_end_time) BETWEEN ? AND ?
     GROUP BY DATE(production_end_time)
     ORDER BY DATE(production_end_time) ASC`,
    [from, to],
    async (err, rows) => {
      if (err) return res.status(500).json({ message: "DB Error" });

      const workbook = new ExcelJS.Workbook();
      const sheet    = workbook.addWorksheet("Production Report");
      const total    = rows.reduce((s, r) => s + Number(r.totalProduction || 0), 0);

      sheet.mergeCells("A1:C1");
      sheet.getCell("A1").value     = `${type.toUpperCase()} REPORT — Machine ${machineId}  (${from} → ${to})`;
      sheet.getCell("A1").font      = { size: 14, bold: true };
      sheet.getCell("A1").alignment = { horizontal: "center" };
      sheet.getRow(1).height = 28;

      sheet.mergeCells("A2:C2");
      sheet.getCell("A2").value     = `Total Production: ${total.toLocaleString("en-IN")}`;
      sheet.getCell("A2").font      = { bold: true, color: { argb: "FF1D4ED8" } };
      sheet.getCell("A2").alignment = { horizontal: "center" };
      sheet.addRow([]);

      sheet.columns = [
        { header: "Date",       key: "date",            width: 20, style: { alignment: { horizontal: "center" } } },
        { header: "Production", key: "totalProduction", width: 20, style: { alignment: { horizontal: "center" } } },
        { header: "",           key: "blank",           width: 10 },
      ];
      const headerRow = sheet.getRow(4);
      headerRow.font      = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
      headerRow.alignment = { horizontal: "center" };

      rows.forEach((r) => {
        const row = sheet.addRow({
          date:            new Date(r.date).toLocaleDateString("en-IN"),
          totalProduction: Number(r.totalProduction),
        });
        row.getCell("date").alignment            = { horizontal: "center" };
        row.getCell("totalProduction").alignment = { horizontal: "center" };
      });

      sheet.addRow([]);
      const totalRow = sheet.addRow({ date: "GRAND TOTAL", totalProduction: total });
      totalRow.font = { bold: true };

      if (rows.length > 1) {
        const agg        = shouldAggregate(from, to) ? aggregateByMonth(rows) : null;
        const labels     = agg ? agg.map((m) => m.label) : rows.map((r) => new Date(r.date).toLocaleDateString("en-IN"));
        const values     = agg ? agg.map((m) => m.total) : rows.map((r) => Number(r.totalProduction));
        const chartTitle = agg ? "Monthly Production" : "Daily Production";
        const img        = await buildLineChart(labels, values, chartTitle, "#1D4ED8");
        const imgId      = workbook.addImage({ buffer: img, extension: "png" });
        sheet.addImage(imgId, {
          tl:  { col: 0, row: sheet.rowCount + 1 },
          ext: { width: 700, height: 300 },
        });
      }

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=machine_${machineId}_${type}_${from}_${to}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    }
  );
};

// DOWNLOAD: EXCEL (combined)
exports.downloadCombinedExcel = async (req, res) => {
  const { type } = req.params;
  const { from: qFrom, to: qTo } = req.query;
  const { from, to } = buildDateRange(type, qFrom, qTo);

  getAllMachineIds(async (err, ids) => {
    if (err || ids.length === 0)
      return res.status(500).json({ message: "No machines found" });

    db.query(buildCombinedUnion(ids, from, to), async (err, rows) => {
      if (err) return res.status(500).json({ message: "DB Error" });

      const workbook = new ExcelJS.Workbook();
      const sheet    = workbook.addWorksheet("Combined Report");
      const total    = rows.reduce((s, r) => s + Number(r.totalProduction || 0), 0);

      sheet.mergeCells("A1:C1");
      sheet.getCell("A1").value     = `${type.toUpperCase()} COMBINED REPORT  (${from} → ${to})`;
      sheet.getCell("A1").font      = { size: 14, bold: true };
      sheet.getCell("A1").alignment = { horizontal: "center" };
      sheet.getRow(1).height = 28;

      sheet.mergeCells("A2:C2");
      sheet.getCell("A2").value     = `Total: ${total.toLocaleString("en-IN")}`;
      sheet.getCell("A2").font      = { bold: true, color: { argb: "FF065F46" } };
      sheet.getCell("A2").alignment = { horizontal: "center" };
      sheet.addRow([]);

      sheet.columns = [
        { header: "Date",       key: "date",            width: 20, style: { alignment: { horizontal: "center" } } },
        { header: "Production", key: "totalProduction", width: 20, style: { alignment: { horizontal: "center" } } },
        { header: "",           key: "blank",           width: 10 },
      ];
      const hr = sheet.getRow(4);
      hr.font      = { bold: true, color: { argb: "FFFFFFFF" } };
      hr.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
      hr.alignment = { horizontal: "center" };

      rows.forEach((r) => {
        const row = sheet.addRow({
          date:            new Date(r.date).toLocaleDateString("en-IN"),
          totalProduction: Number(r.totalProduction),
        });
        row.getCell("date").alignment            = { horizontal: "center" };
        row.getCell("totalProduction").alignment = { horizontal: "center" };
      });
      sheet.addRow([]);
      const tr = sheet.addRow({ date: "GRAND TOTAL", totalProduction: total });
      tr.font = { bold: true };

      if (rows.length > 1) {
        const agg        = shouldAggregate(from, to) ? aggregateByMonth(rows) : null;
        const labels     = agg ? agg.map((m) => m.label) : rows.map((r) => new Date(r.date).toLocaleDateString("en-IN"));
        const values     = agg ? agg.map((m) => m.total) : rows.map((r) => Number(r.totalProduction));
        const chartTitle = agg ? "Monthly Combined" : "Combined Production";
        const img        = await buildLineChart(labels, values, chartTitle, "#065F46");
        const imgId      = workbook.addImage({ buffer: img, extension: "png" });
        sheet.addImage(imgId, {
          tl:  { col: 0, row: sheet.rowCount + 1 },
          ext: { width: 700, height: 300 },
        });
      }

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=combined_${type}_${from}_${to}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    });
  });
};