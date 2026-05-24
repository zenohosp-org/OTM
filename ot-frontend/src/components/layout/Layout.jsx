import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#0f0f0f]">
      <div className="no-print h-full">
        <Sidebar isOpen={sidebarOpen} />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="no-print">
          <Header onMenuClick={() => setSidebarOpen((p) => !p)} />
        </div>
        <main className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
