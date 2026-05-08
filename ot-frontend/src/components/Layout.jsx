import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { LogOut, BarChart3, Monitor, BookOpen, Calendar } from 'lucide-react';

export default function Layout() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <div className="flex h-screen bg-gray-50">
            <aside className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
                <div className="px-5 py-5 border-b border-gray-100">
                    <h1 className="text-lg font-bold text-gray-900">OT Manager</h1>
                    <p className="text-xs text-gray-400 mt-0.5">Operating Theater</p>
                </div>

                <nav className="flex-1 p-3 space-y-1">
                    <NavItem icon={<BarChart3 size={18} />} label="Dashboard"  onClick={() => navigate('/dashboard')}  active={isActive('/dashboard')} />
                    <NavItem icon={<Monitor size={18} />}   label="Live Board"  onClick={() => navigate('/ot-board')}    active={isActive('/ot-board')} highlight />
                    <NavItem icon={<Calendar size={18} />}  label="Schedules"   onClick={() => navigate('/schedules')}   active={isActive('/schedules')} />
                    <NavItem icon={<BookOpen size={18} />}  label="Cases"       onClick={() => navigate('/cases')}       active={isActive('/cases')} />
                </nav>

                <div className="p-3 border-t border-gray-100">
                    <button onClick={logout}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-500 font-medium hover:bg-red-50 hover:text-red-600 rounded-lg transition">
                        <LogOut size={16} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}

function NavItem({ icon, label, active, onClick, highlight }) {
    return (
        <button onClick={onClick}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition text-sm font-medium
                ${active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : highlight
                        ? 'text-blue-600 hover:bg-blue-50'
                        : 'text-gray-600 hover:bg-gray-100'
                }`}>
            {icon}
            <span>{label}</span>
            {highlight && !active && (
                <span className="ml-auto w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            )}
        </button>
    );
}
