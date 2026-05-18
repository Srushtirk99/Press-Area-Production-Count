import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API, { BASE_URL } from "../api";
import "./Reports.css";

function Reports() {
  const navigate = useNavigate();

  const [type, setType] = useState("daily");
  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState("all");
  const [reportData, setReportData] = useState([]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // ======================
  // LOAD MACHINES
  // ======================
  useEffect(() => {
    API.get("/machines")
      .then((res) => setMachines(res.data.data || []))
      .catch(console.log);
  }, []);

  // ======================
  // FETCH REPORT
  // ======================
  const fetchReport = async () => {
    try {
      let url = "";

      // YEARLY
      if (type === "yearly") {
        if (!fromDate || !toDate) return;

        if (selectedMachine === "all") {
          url = `/report/yearly/combined?from=${fromDate}&to=${toDate}`;
        } else {
          url = `/report/yearly/${selectedMachine}?from=${fromDate}&to=${toDate}`;
        }
      }
      // DAILY / WEEKLY / MONTHLY
      else {
        if (selectedMachine === "all") {
          url = `/report/combined/${type}`;
        } else {
          url = `/report/machine/${selectedMachine}/${type}`;
        }
      }

      const res = await API.get(url);
      setReportData(res.data);
    } catch (err) {
      console.log(err);
      setReportData([]);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [type, selectedMachine, fromDate, toDate]);

  // ======================
  // DOWNLOAD
  // ======================
  const download = (format) => {
    if (type === "yearly" && (!fromDate || !toDate)) {
      alert("Select date range");
      return;
    }

    let url = "";

    // YEARLY DOWNLOAD
    if (type === "yearly") {
      if (selectedMachine === "all") {
        url = `/report/download/combined/${format}/${type}?from=${fromDate}&to=${toDate}`;
      } else {
        url = `/report/download/machine/${format}/${selectedMachine}/${type}?from=${fromDate}&to=${toDate}`;
      }
    }
    // NORMAL DOWNLOAD
    else {
      if (selectedMachine === "all") {
        url = `/report/download/combined/${format}/${type}`;
      } else {
        url = `/report/download/machine/${format}/${selectedMachine}/${type}`;
      }
    }

    window.open(`${BASE_URL}/api${url}`, "_blank");
  };

  const handleBack = () => {
    navigate("/dashboard");
  };

  return (
    <div className="reports-container">
      <div className="top-bar">
        <button className="back-btn" onClick={handleBack}>
          ← Back
        </button>
      </div>

      <h2 className="reports-title">📊 Production Reports</h2>

      {/* FILTERS */}
      <div className="report-filters">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>

        <select
          value={selectedMachine}
          onChange={(e) => setSelectedMachine(e.target.value)}
        >
          <option value="all">All Machines</option>

          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.machine_name}
            </option>
          ))}
        </select>

        {/* YEARLY RANGE */}
        {type === "yearly" && (
          <>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </>
        )}
      </div>

      {/* DOWNLOAD BUTTONS */}
      <div className="download-buttons">
        <button onClick={() => download("excel")}>Download Excel</button>
        <button onClick={() => download("pdf")}>Download PDF</button>
      </div>

      {/* TABLE */}
      <div className="report-table">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Production</th>
            </tr>
          </thead>

          <tbody>
            {reportData.length === 0 ? (
              <tr>
                <td colSpan="2">No Data</td>
              </tr>
            ) : (
              reportData.map((r, i) => {
                const formattedDate = new Date(r.date).toLocaleDateString("en-IN");

                return (
                  <tr key={i}>
                    <td>{formattedDate}</td>
                    <td>{r.totalProduction}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Reports;