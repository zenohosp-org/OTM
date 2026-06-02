import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import {
  Home,
  Monitor,
  Calendar,
  BookOpen,
  ArrowUpRight,
  Activity,
  BarChart2,
  Boxes,
  LayoutGrid,
  Building2,
} from "lucide-react";

const MAIN_LINKS = [
  { label: "Dashboard",  to: "/dashboard", icon: Home,    end: true },
  { label: "Live Board", to: "/ot-board",  icon: Monitor, pulse: true },
  { label: "Schedules",  to: "/schedules", icon: Calendar },
  { label: "Cases",      to: "/cases",     icon: BookOpen },
];

const EXTERNAL_APPS = [
  { label: "HMS",       href: "https://hms.zenohosp.com",       icon: Building2 },
  { label: "Finance",   href: "https://finance.zenohosp.com",   icon: BarChart2 },
  { label: "Inventory", href: "https://inventory.zenohosp.com", icon: Boxes },
  { label: "Directory", href: "https://directory.zenohosp.com", icon: BookOpen },
  { label: "Assets",    href: "https://asset.zenohosp.com",     icon: LayoutGrid },
];

export default function Sidebar({ collapsed }) {
  const { user } = useAuth();

  const renderLink = (link) => {
    const Icon = link.icon;
    return (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.end}
        title={collapsed ? link.label : undefined}
        className={({ isActive }) =>
          `sidebar-nav-link${isActive ? " is-active" : ""}`
        }
      >
        {({ isActive }) => (
          <>
            <Icon />
            <span className="sidebar-nav-label">{link.label}</span>
            {link.pulse && !isActive && <span className="sidebar-nav-pulse" />}
          </>
        )}
      </NavLink>
    );
  };

  const renderExternalApp = (app) => {
    const Icon = app.icon;
    return (
      <a
        key={app.href}
        href={app.href}
        target="_blank"
        rel="noopener noreferrer"
        title={collapsed ? app.label : undefined}
        className="sidebar-nav-link"
      >
        <Icon />
        <span className="sidebar-nav-label">{app.label}</span>
        <ArrowUpRight className="sidebar-nav-external-icon" />
      </a>
    );
  };

  return (
    <aside className={`app-sidebar${collapsed ? " is-collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">
          <Activity />
        </div>
        {!collapsed && (
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">ZenoHosp</span>
            <span className="sidebar-brand-tagline">
              {user?.hospitalName || "OT Manager"}
            </span>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-group">
          {!collapsed && <span className="sidebar-group-label">Main</span>}
          {MAIN_LINKS.map(renderLink)}
        </div>
        <div className="sidebar-nav-group">
          {!collapsed && <span className="sidebar-group-label">Apps</span>}
          {EXTERNAL_APPS.map(renderExternalApp)}
        </div>
      </nav>
    </aside>
  );
}
