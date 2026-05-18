import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "./AdminProfile.css";


// ✅ CONTEXT
import { useAuth } from "../context/AuthContext";

// ✅ DEBOUNCE HOOK
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function AdminProfile() {

  const navigate = useNavigate();

  const { user } = useAuth(); // ✅ from context
  const userRole = user?.role;

  const [admin, setAdmin] = useState({});
  const [users, setUsers] = useState([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operator");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400); // ✅ debounce

  const [editId, setEditId] = useState(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // =========================
  // INIT
  // =========================
  useEffect(() => {

    setAdmin({
      name: localStorage.getItem("adminName"),
      email: localStorage.getItem("adminEmail"),
      lastLogin: localStorage.getItem("lastLogin")
    });

    fetchUsers();

  }, []);

  // =========================
  // FETCH USERS
  // =========================
  const fetchUsers = async () => {
    try {
      const res = await API.get("/users");
      setUsers(res.data.users || []);
    } catch (err) {
      console.log("Fetch users error", err);
    }
  };

  // =========================
  // ADD USER
  // =========================
  const addUser = async () => {

    if (userRole !== "admin") return alert("Only admin allowed");

    if (!name || !email) {
      alert("Name and Email required");
      return;
    }

    try {

      await API.post("/users/add", {
        name,
        email,
        password: "123456",
        role
      });

      setName("");
      setEmail("");
      setRole("operator");

      fetchUsers();

    } catch (err) {
      console.log("Add user error", err);
    }
  };

  // =========================
  // DELETE USER
  // =========================
  const deleteUser = async (id) => {

    if (userRole !== "admin") return;

    if (!window.confirm("Delete this user?")) return;

    try {

      await API.delete(`/users/delete/${id}`); // ✅ fixed route
      fetchUsers();

    } catch (err) {
      console.log("Delete error", err);
    }
  };

  // =========================
  // EDIT USER
  // =========================
  const editUser = (user) => {

    if (userRole !== "admin") return;

    setEditId(user.id);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
  };

  // =========================
  // UPDATE USER
  // =========================
  const updateUser = async () => {

    if (userRole !== "admin") return;

    try {

      await API.put(`/users/update/${editId}`, {
        name,
        email,
        role
      });

      setEditId(null);
      setName("");
      setEmail("");
      setRole("operator");

      fetchUsers();

    } catch (err) {
      console.log("Update error", err);
    }
  };

  // =========================
  // FILTER USERS (MEMOIZED)
  // =========================
  const filteredUsers = useMemo(() => {
    return users.filter(u =>
      u.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [users, debouncedSearch]);

  // =========================
  // CHANGE PASSWORD
  // =========================
  const handleChangePassword = async () => {

    try {

      await API.post("/auth/change-password", {
        currentPassword,
        newPassword
      });

      alert("Password changed");

      setCurrentPassword("");
      setNewPassword("");

    } catch (err) {
      alert("Password change failed");
    }
  };

  return (

  <div className="admin-container">

    {/* TOP BACK BAR */}
    <div className="top-bar">
      <button
        className="top-back-btn"
        onClick={() => navigate("/dashboard")}
      >
        ← Back
      </button>
    </div>

    <h2 className="admin-title">Admin Panel</h2>

    <div className="admin-grid">

      {/* ADMIN INFO */}
      <div className="admin-card">

        <h3 className="card-title">👤 Admin Information</h3>

        <div className="info-row">
          <span className="label">Name</span>
          <span className="value">{admin.name}</span>
        </div>

        <div className="info-row">
          <span className="label">Email</span>
          <span className="value">{admin.email}</span>
        </div>

        <div className="info-row">
          <span className="label">Last Login</span>
          <span className="value">{admin.lastLogin}</span>
        </div>

      </div>

      {/* SECURITY */}
      <div className="admin-card">

        <h3 className="card-title">🔒 Security</h3>

        <input
          type="password"
          placeholder="Current Password"
          value={currentPassword}
          onChange={(e)=>setCurrentPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e)=>setNewPassword(e.target.value)}
        />

        <button
          className="change-btn"
          onClick={handleChangePassword}
        >
          Change Password
        </button>

      </div>

      {/* USER MANAGEMENT */}
      <div className="admin-card user-management">

        <h3 className="card-title">👥 User Management</h3>

        <input
          placeholder="Search users..."
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
        />

        {/* ADMIN ONLY */}
        {userRole === "admin" && (
          <div className="add-user-bar">

            <input
              placeholder="Name"
              value={name}
              onChange={(e)=>setName(e.target.value)}
            />

            <input
              placeholder="Email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
            />

            {editId ? (
              <button className="add-btn" onClick={updateUser}>
                Update
              </button>
            ) : (
              <button className="add-btn" onClick={addUser}>
                Add User
              </button>
            )}

          </div>
        )}

        <div className="user-list">

          {filteredUsers.map((u)=>(
            <div key={u.id} className="user-row">

              <div className="user-data">
                <div className="user-name">{u.name}</div>
                <div className="user-email">{u.email}</div>
                <div style={{fontSize:"12px",color:"#9fb3d9"}}>
                  Role: {u.role}
                </div>
              </div>

              {/* ADMIN ONLY ACTIONS */}
              {userRole === "admin" && (
                <div className="user-actions">

                  <button
                    className="edit-btn"
                    onClick={()=>editUser(u)}
                  >
                    Edit
                  </button>

                  <button
                    className="delete-btn"
                    onClick={()=>deleteUser(u.id)}
                  >
                    Delete
                  </button>

                </div>
              )}

            </div>
          ))}

        </div>

      </div>

    </div>

  </div>
);
}

export default AdminProfile;