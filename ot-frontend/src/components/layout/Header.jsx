import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/useAuth";
import { Menu, Sun, Moon, Bell, LogOut } from "lucide-react";

export default function Header({ onMenuClick }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const firstName = user?.firstName || "";
  const lastName = user?.lastName || "";
  const email = user?.email || "";
  const initials = firstName || lastName
    ? `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
    : (email[0] ?? "U").toUpperCase();
  const displayName = firstName || lastName ? `${firstName} ${lastName}`.trim() : email;
  const role = user?.roleDisplay || user?.role || "";

  return (
    <header className="app-topbar">
      <button
        onClick={onMenuClick}
        className="topbar-toggle"
        aria-label="Toggle sidebar"
      >
        <Menu />
      </button>

      <span className="topbar-title">OT Management System</span>

      <div className="topbar-right">
        <button
          onClick={toggleTheme}
          className="topbar-action-btn"
          aria-label="Toggle theme"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </button>

        <button className="topbar-action-btn" aria-label="Notifications">
          <Bell />
          <span className="topbar-action-dot" />
        </button>

        <div className="topbar-user">
          <div className="z-avatar is-md is-gradient">{initials}</div>
          <div className="topbar-user-text">
            <span className="topbar-user-name">{displayName}</span>
            {role && (
              <span className="topbar-user-role">{role.replace(/_/g, " ")}</span>
            )}
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="topbar-action-btn"
            aria-label="Logout"
          >
            <LogOut />
          </button>
        </div>
      </div>
    </header>
  );
}
