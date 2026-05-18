
const path = require("path");
const fs   = require("fs");
const db   = require("../config/db");

const {
  getAllMachines,
  getMachineById: getMachineByIdQuery,
  insertMachine,
  createMachineTable,
  dropMachineTable,
  deleteMachine,
  resetMachineAutoIncrement,
  deleteProductionLogsByMachine,
} = require("../db/queries");

exports.getMachines = (req, res) => {
  getAllMachines((err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    res.json({ success: true, data: result });
  });
};

exports.getMachineById = (req, res) => {
  const machineId = req.params.id;

  getMachineByIdQuery(machineId, (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Database error" });
    }

    if (!result || result.length === 0) {
      return res.status(404).json({ success: false, message: "Machine not found" });
    }

    res.json({ success: true, data: result[0] });
  });
};

// ADD MACHINE
exports.addMachine = (req, res) => {
  const { machine_name: machineName, cycle_time: cycleTime } = req.body;
  const image = req.file ? req.file.filename : null;

  if (!machineName || !cycleTime) {
    return res.status(400).json({
      success: false,
      message: "machine_name and cycle_time are required",
    });
  }

  db.query(
    "SELECT * FROM machines WHERE machine_name = ?",
    [machineName],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Database error",
        });
      }

      if (rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Machine already exists",
        });
      }

      insertMachine(machineName, cycleTime, image, (err, newMachineId) => {
        if (err) {
          console.error("[addMachine] Insert failed:", err);
          return res.status(500).json({
            success: false,
            message: err.message || "Insert failed",
          });
        }

        createMachineTable(newMachineId, (err) => {
          if (err) {
            console.error("[addMachine] Table creation failed:", err);
            return res.status(500).json({
              success: false,
              message: err.message || "Log table creation failed",
            });
          }

          res.json({
            success: true,
            message: "Machine added successfully",
            machine_id: newMachineId,
          });
        });
      });
    }
  );
};

// UPDATE MACHINE 
exports.updateMachine = (req, res) => {
  const machineId = req.params.id;
  const { machine_name: machineName, cycle_time: cycleTime } = req.body;
  const newImage = req.file ? req.file.filename : null;

  getMachineByIdQuery(machineId, (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Database error" });
    }

    if (!result || result.length === 0) {
      return res.status(404).json({ success: false, message: "Machine not found" });
    }

    const oldImage = result[0]?.image;

    const fields = [];
    const values = [];

    if (machineName !== undefined && machineName !== "") {
      fields.push("machine_name = ?");
      values.push(machineName);
    }

    if (cycleTime !== undefined && cycleTime !== "") {
      fields.push("cycle_time_seconds = ?");
      values.push(cycleTime);
    }

    if (newImage) {
      fields.push("image = ?");
      values.push(newImage);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    values.push(machineId);

    const query = `UPDATE machines SET ${fields.join(", ")} WHERE id = ?`;

    db.query(query, values, (err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message || "Update failed",
        });
      }

      if (newImage && oldImage) {
        const imagePath = path.join("uploads", oldImage);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      }

      return res.json({
        success: true,
        message: "Machine updated successfully",
      });
    });
  });
};

// DELETE MACHINE 
exports.deleteMachine = (req, res) => {
  const machineId = req.params.id;

  getMachineByIdQuery(machineId, (err, result) => {

    // DATABASE ERROR
    if (err) {
      console.error("[deleteMachine] Database error:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Database error",
      });
    }

    // MACHINE NOT FOUND
    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Machine not found",
      });
    }

    const imageName = result[0].image;

    // STEP 1: DROP MACHINE LOG TABLE
    dropMachineTable(machineId, (err) => {

      if (err) {
        console.error(`[deleteMachine] Failed to drop table machine_${machineId}_logs:`, err);

        return res.status(500).json({
          success: false,
          message: err.message || "Failed to drop machine log table",
        });
      }

      // STEP 2: DELETE ACTIVE WORK ORDERS
      db.query(
        "DELETE FROM active_workorders WHERE machine_id = ?",
        [machineId],
        (err) => {

          if (err) {
            console.warn(
              `[deleteMachine] Could not delete work orders for machine ${machineId}:`,
              err.message
            );
          }

          // STEP 3: DELETE UNALLOCATED PRODUCTION
          db.query(
            "DELETE FROM unallocated_production WHERE machine_id = ?",
            [machineId],
            (err) => {

              if (err) {
                console.warn(
                  `[deleteMachine] Could not delete unallocated production for machine ${machineId}:`,
                  err.message
                );
              }

              // STEP 4: DELETE PRODUCTION LOGS
              db.query(
                "DELETE FROM production_logs WHERE machine_id = ?",
                [machineId],
                (err) => {

                  if (err) {
                    console.warn(
                      `[deleteMachine] Could not delete production_logs for machine ${machineId}:`,
                      err.message
                    );
                  }

                  // STEP 5: DELETE MACHINE ROW
                  deleteMachine(machineId, (err) => {

                    if (err) {
                      console.error(
                        `[deleteMachine] Failed to delete machine ${machineId}:`,
                        err
                      );

                      return res.status(500).json({
                        success: false,
                        message: err.message || "Failed to delete machine",
                      });
                    }

                    // STEP 6: RESET AUTO_INCREMENT
                    resetMachineAutoIncrement((err) => {

                      if (err) {
                        console.warn(
                          "[deleteMachine] AUTO_INCREMENT reset failed:",
                          err.message
                        );
                      }

                      // STEP 7: DELETE IMAGE FILE
                      if (imageName) {

                        const imagePath = path.join("uploads", imageName);

                        try {
                          if (fs.existsSync(imagePath)) {
                            fs.unlinkSync(imagePath);
                            console.log(`[deleteMachine] Deleted image: ${imageName}`);
                          }
                        } catch (fileErr) {
                          console.warn(
                            `[deleteMachine] Failed to delete image ${imageName}:`,
                            fileErr.message
                          );
                        }
                      }

                      // STEP 8: NOTIFY SERVER
                      const onMachineDeleted = req.app.get("onMachineDeleted");

                      if (typeof onMachineDeleted === "function") {
                        onMachineDeleted(Number(machineId));
                      }

                      console.log(
                        `[deleteMachine] Machine ${machineId} deleted successfully`
                      );

                      return res.json({
                        success: true,
                        message: "Machine deleted successfully",
                      });
                    });
                  });
                }
              );
            }
          );
        }
      );
    });
  });
};