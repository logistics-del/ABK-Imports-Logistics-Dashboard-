import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const linkClass = ({ isActive }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? "bg-abk-navy2 text-white" : "text-slate-200 hover:bg-abk-navy2/60 hover:text-white"
  }`;

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="bg-abk-navy shadow-md">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <span className="text-white font-bold text-lg tracking-tight">
              ABK Imports <span className="text-abk-gold">Logistics Performance Dashboard</span>
            </span>
            <nav className="hidden md:flex gap-2">
              <NavLink to="/" end className={linkClass}>
                Dashboard
              </NavLink>
              {isAdmin && (
                <NavLink to="/data-management" className={linkClass}>
                  Data Management
                </NavLink>
              )}
              {isAdmin && (
                <NavLink to="/users" className={linkClass}>
                  User Management
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-300 text-sm hidden sm:inline">
              {user?.username} · <span className="uppercase text-abk-gold">{user?.role}</span>
            </span>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="text-sm bg-abk-navy2 text-white px-3 py-1.5 rounded-md hover:bg-abk-navy2/80"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
