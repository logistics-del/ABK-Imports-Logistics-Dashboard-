import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("abk_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login/", { username, password });
      localStorage.setItem("abk_access_token", data.access);
      localStorage.setItem("abk_refresh_token", data.refresh);
      localStorage.setItem("abk_user", JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.detail || "Invalid username or password.",
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  useEffect(() => {
    if (user) localStorage.setItem("abk_user", JSON.stringify(user));
  }, [user]);

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
