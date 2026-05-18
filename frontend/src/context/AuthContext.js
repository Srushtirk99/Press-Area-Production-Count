import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = {
      name: localStorage.getItem("adminName"),
      email: localStorage.getItem("adminEmail"),
      role: localStorage.getItem("role"),
    };

    if (storedUser.email) {
      setUser(storedUser);
    }
  }, []);

  const login = (userData) => {
    localStorage.setItem("adminName", userData.name);
    localStorage.setItem("adminEmail", userData.email);
    localStorage.setItem("role", userData.role);
    setUser(userData);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);