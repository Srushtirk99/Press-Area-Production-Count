const { getProductionLogs } = require("../db/queries");

exports.getLogs = (req, res) => {
  const machineId = req.params.id;

  getProductionLogs(machineId, (err, result) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, data: result });
  });
};