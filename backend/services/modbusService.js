const ModbusRTU = require("modbus-serial");
const { insertProductionLog } = require("../db/queries");

let client = new ModbusRTU();

async function startModbus() {
  try {
    await client.connectTCP("192.168.0.101", { port: 502 });
    console.log("Connected to Modbus device");

    setInterval(async () => {
      try {
        const data = await client.readDiscreteInputs(0, 16);

        console.log("Inputs:", data.data);

        // Example mapping (we will refine later)
        if (data.data[0]) {
          console.log("Machine 1 button pressed");
          insertProductionLog(1, 1, () => {});
        }

      } catch (err) {
        console.error("Read error:", err.message);
      }
    }, 1000);

  } catch (err) {
    console.error("Modbus connection failed:", err.message);
  }
}

module.exports = { startModbus };




