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
  { label: "Dashboard",  to: "/dashboard", icon: Home,     end: true },
  { label: "Live Board", to: "/ot-board",  icon: Monitor,  pulse: true },
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

export default function Sidebar({ isOpen }) {
  const { user } = useAuth();

  const renderLink = (link) => {
    const Icon = link.icon;
    return isOpen ? (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.end}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
            isActive
              ? "bg-slate-100 dark:bg-[#1e1e1e] text-slate-900 dark:text-white"
              : "text-slate-700 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-white"
          }`
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-slate-700 dark:text-white" : ""}`} />
            <span className="truncate flex-1">{link.label}</span>
            {link.pulse && !isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            )}
          </>
        )}
      </NavLink>
    ) : (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.end}
        title={link.label}
        className={({ isActive }) =>
          `flex items-center justify-center w-full py-3 rounded-lg transition-colors duration-150 relative ${
            isActive
              ? "bg-slate-100 dark:bg-[#1e1e1e] text-slate-900 dark:text-white"
              : "text-slate-700 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-white"
          }`
        }
      >
        {({ isActive }) => (
          <>
            <Icon className="w-4 h-4 text-inherit" />
            {link.pulse && !isActive && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            )}
          </>
        )}
      </NavLink>
    );
  };

  const renderExternalApp = (app) => {
    const Icon = app.icon;
    return isOpen ? (
      <a
        key={app.href}
        href={app.href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 text-slate-700 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-white group"
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate flex-1">{app.label}</span>
        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
      </a>
    ) : (
      <a
        key={app.href}
        href={app.href}
        target="_blank"
        rel="noopener noreferrer"
        title={app.label}
        className="flex items-center justify-center w-full py-3 rounded-lg transition-colors duration-150 text-slate-700 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-white"
      >
        <Icon className="w-4 h-4 text-inherit" />
      </a>
    );
  };

  return (
    <aside
      className={`flex flex-col h-full transition-all duration-300 ease-in-out shrink-0 bg-white dark:bg-[#111111] border-r border-slate-200 dark:border-[#222222] ${
        isOpen ? "w-60" : "w-16"
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center border-b border-slate-200 dark:border-[#222222] h-14 ${isOpen ? "gap-3 px-4" : "justify-center"}`}>
        <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4 text-white dark:text-slate-900" />
        </div>
        {isOpen && (
          <div className="overflow-hidden">
            <p className="font-bold text-sm leading-tight tracking-wider text-slate-900 dark:text-white">ZenoHosp</p>
            <p className="text-xs text-slate-600 dark:text-[#888888] truncate mt-0.5">
              {user?.hospitalName || "OT Manager"}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto px-2">
        {isOpen && (
          <div className="px-3 mb-2 mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[#777777]">
            Main Menu
          </div>
        )}
        {MAIN_LINKS.map((link) => renderLink(link))}
      </nav>

      {/* Other Apps */}
      <div className="border-t border-slate-200 dark:border-[#222222] p-2 space-y-0.5 shrink-0">
        {isOpen && (
          <div className="px-3 mb-2 mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[#777777]">
            Other Apps
          </div>
        )}
        {EXTERNAL_APPS.map((app) => renderExternalApp(app))}
      </div>
    </aside>
  );
}
