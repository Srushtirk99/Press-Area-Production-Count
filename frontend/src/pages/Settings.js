import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API, { UPLOADS_URL } from "../api";
import "./Settings.css";

// ✅ CONTEXT
import { useAuth } from "../context/AuthContext";

function Settings() {
  const navigate = useNavigate();

const handleBack = () => {
  navigate("/dashboard");
};

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);

  const [name, setName] = useState("");
  const [cycleTime, setCycleTime] = useState("");
  const [image, setImage] = useState(null);

  // =========================
  // FETCH MACHINES
  // =========================
  const fetchMachines = useCallback(async () => {
    try {
      const res = await API.get("/machines");
      setMachines(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch machines", err);
    }
  }, []);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  // =========================
  // SELECT MACHINE
  // =========================
  const handleSelect = useCallback((machine) => {
    setSelectedMachine(machine);
    setName(machine.machine_name || "");
    setCycleTime(machine.cycle_time || "");
    setImage(null);
  }, []);

  // =========================
  // ADD MACHINE (ADMIN ONLY)
  // =========================
  const handleAdd = async () => {

    if (!isAdmin) return alert("Only admin allowed");

    if (!name || !cycleTime) {
      alert("Please enter machine name and cycle time");
      return;
    }

    const formData = new FormData();
    formData.append("machine_name", name);
    formData.append("cycle_time", cycleTime);

    if (image) {
      formData.append("image", image);
    }

    try {

      await API.post("/machines", formData);

      alert("Machine Added Successfully");

      setName("");
      setCycleTime("");
      setImage(null);

      fetchMachines();

    } catch (err) {
      console.error("Add machine failed", err);
    }
  };

  // =========================
  // UPDATE MACHINE (ADMIN ONLY)
  // =========================
  const handleUpdate = async () => {

    if (!isAdmin) return alert("Only admin allowed");

    if (!selectedMachine) {
      alert("Select a machine first");
      return;
    }

    try {

      if (image) {

        const formData = new FormData();
        formData.append("machine_name", name);
        formData.append("cycle_time", cycleTime);
        formData.append("image", image);

        await API.put(`/machines/${selectedMachine.id}`, formData);

      } else {

        await API.put(`/machines/${selectedMachine.id}`, {
          machine_name: name,
          cycle_time: cycleTime
        });

      }

      alert("Machine Updated Successfully");
      fetchMachines();

    } catch (err) {
      console.error("Update failed", err);
    }
  };

  // =========================
  // DELETE MACHINE (ADMIN ONLY)
  // =========================
  const handleDelete = async () => {

    if (!isAdmin) return alert("Only admin allowed");

    if (!selectedMachine) {
      alert("Select a machine first");
      return;
    }

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this machine?"
    );

    if (!confirmDelete) return;

    try {

      await API.delete(`/machines/${selectedMachine.id}`);

      alert("Machine Deleted Successfully");

      setSelectedMachine(null);
      setName("");
      setCycleTime("");
      setImage(null);

      fetchMachines();

    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  // =========================
  // MEMOIZED MACHINE LIST
  // =========================
  const machineList = useMemo(() => machines, [machines]);

  return (
    <div className="settings-page">

  <div className="top-bar">
    <button className="back-btn" onClick={handleBack}>
      ← Back
    </button>
  </div>

  <h2 className="settings-title">Machine Configuration</h2>


      <div className="settings-layout">

        {/* MACHINE LIST (VISIBLE TO ALL) */}
        <div className="machine-list">

          {machineList.map((machine) => (

            <div
              key={machine.id}
              className={`machine-row ${
                selectedMachine?.id === machine.id ? "active" : ""
              }`}
              onClick={() => handleSelect(machine)}
            >

              <img
                src={`${UPLOADS_URL}/${machine.image}`}
                alt={machine.machine_name}
              />

              <div>
                <h4>{machine.machine_name}</h4>
                <p>Cycle Time: {machine.cycle_time}s</p>
              </div>

            </div>

          ))}

        </div>

        {/* ✅ ADMIN ONLY PANEL */}
        {isAdmin && (
          <div className="machine-settings">

            <h3>Machine Settings</h3>

            <label>Machine Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <label>Cycle Time (seconds)</label>
            <input
              type="number"
              value={cycleTime}
              onChange={(e) => setCycleTime(e.target.value)}
            />

            <label>Upload Machine Image</label>
            <input
              type="file"
              onChange={(e) => setImage(e.target.files[0])}
            />

            {selectedMachine && (
              <img
                className="preview"
                src={`${UPLOADS_URL}/${selectedMachine.image}`}
                alt="preview"
              />
            )}

            <div className="settings-buttons">

              <button className="add-btn" onClick={handleAdd}>
                Add Machine
              </button>

              <button className="update-btn" onClick={handleUpdate}>
                Update
              </button>

              <button className="delete-btn" onClick={handleDelete}>
                Delete
              </button>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}

export default Settings;