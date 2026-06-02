import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-shell">
      <div className="no-print">
        <Sidebar collapsed={collapsed} />
      </div>
      <div className="app-shell-main">
        <div className="no-print">
          <Header onMenuClick={() => setCollapsed((p) => !p)} />
        </div>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
