import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "./WorkOrder.css";

function WorkOrder() {

  const navigate = useNavigate();

const handleBack = () => {
  navigate("/dashboard");
};

  const [machines, setMachines] = useState([]);
  const [workorders, setWorkorders] = useState([]);

  const [form, setForm] = useState({
    product_name: "",
    workorder_number: "",
    machine_id: "",
    target_quantity: ""
  });

  const [editId, setEditId] = useState(null);
  const [message, setMessage] = useState("");

  // ================= LOAD =================
  useEffect(() => {
    API.get("/machines")
      .then(res => setMachines(res.data.data || []))
      .catch(console.log);

    fetchWorkorders();

    // 🔥 auto refresh every 5 sec
    const interval = setInterval(fetchWorkorders, 5000);
    return () => clearInterval(interval);

  }, []);

  const fetchWorkorders = () => {
    API.get("/workorders")
      .then(res => setWorkorders(res.data || []))
      .catch(console.log);
  };

  // ================= INPUT =================
  const handleChange = (e) => {
    let value = e.target.value;

    if (e.target.name === "target_quantity" && value < 0) {
      value = 0;
    }

    setForm({ ...form, [e.target.name]: value });
  };

  // ================= CREATE / UPDATE =================
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editId) {
        await API.put(`/workorders/${editId}`, form);
        setMessage("✏️ Updated");
      } else {
        await API.post("/workorders", form);
        setMessage("✅ Created");
      }

      setForm({
        product_name: "",
        workorder_number: "",
        machine_id: "",
        target_quantity: ""
      });

      setEditId(null);
      fetchWorkorders();

    } catch (err) {
      console.log(err);
      setMessage("❌ Error");
    }
  };

  // ================= EDIT =================
  const handleEdit = (wo) => {

  // 🔴 COMPLETED
  if (wo.produced_so_far >= wo.target_quantity) {
    alert("Completed work cannot be edited");
    return;
  }

  // 🟡 IN PROGRESS
  if (wo.produced_so_far > 0 && wo.produced_so_far < wo.target_quantity) {
    alert("Under progress work cannot be edited");
    return;
  }

  // 🟢 ONLY ALLOW IF 0 PRODUCTION
  setForm({
    product_name: wo.product_name,
    workorder_number: wo.workorder_number,
    machine_id: wo.machine_id,
    target_quantity: wo.target_quantity
  });

  setEditId(wo.id);
};
  // ================= DELETE =================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete?")) return;

    await API.delete(`/workorders/${id}`);
    fetchWorkorders();
  };

  // ================= UI =================
  return (
    <div className="workorder-container">

  <div className="top-bar">
    <button className="back-btn" onClick={handleBack}>
      ← Back
    </button>
  </div>

  <h2>⚙️ Work Orders</h2>

      {/* FORM */}
      <form className="form-grid" onSubmit={handleSubmit}>

        <input
          name="product_name"
          placeholder="Product Name"
          value={form.product_name}
          onChange={handleChange}
          required
        />

        <input
          name="workorder_number"
          placeholder="Work Order Number"
          value={form.workorder_number}
          onChange={handleChange}
          required
        />

        <select
          name="machine_id"
          value={form.machine_id}
          onChange={handleChange}
          required
        >
          <option value="">Select Machine</option>
          {machines.map(m => (
            <option key={m.id} value={m.id}>{m.machine_name}</option>
          ))}
        </select>

        <input
          type="number"
          name="target_quantity"
          placeholder="Target Quantity"
          value={form.target_quantity}
          onChange={handleChange}
          min="0"
          required
        />

        <button className="primary-btn">
          {editId ? "Update" : "Create"}
        </button>

      </form>

      {message && <p>{message}</p>}

      {/* TABLE */}
      <table className="wo-table">
        <thead>
          <tr>
            <th>WO</th>
            <th>Product</th>
            <th>Machine</th>
            <th>Target</th>
            <th>Produced</th>
            
            <th>Progress</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {workorders.map(wo => {

            const progress = Math.min(
              (wo.produced_so_far / wo.target_quantity) * 100,
              100
            );

            return (
              <tr key={wo.id}>
                <td>{wo.workorder_number}</td>
                <td>{wo.product_name}</td>
                <td>{wo.machine_name}</td>
                <td>{wo.target_quantity}</td>
                <td>{wo.produced_so_far}</td>

                

                <td>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </td>

                <td>

             {/* ✅ Show Edit ONLY if no production started */}
             {wo.produced_so_far === 0 && (
               <button onClick={() => handleEdit(wo)}>Edit</button>
               )}

             <button onClick={() => handleDelete(wo.id)}>Delete</button>

             </td>

              </tr>
            );
          })}
        </tbody>
      </table>

    </div>
  );
}

export default WorkOrder;