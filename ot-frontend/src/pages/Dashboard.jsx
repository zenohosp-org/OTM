import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBookings, getHmsRooms } from '../api/client';
import { Calendar, Clock, Activity, CheckCircle2, Monitor, ArrowRight, AlertTriangle } from 'lucide-react';

const STATUS_COLOR = {
    REQUESTED:          'text-gray-600  bg-gray-100',
    CONFIRMED:          'text-blue-700  bg-blue-100',
    IN_PROGRESS:        'text-red-700   bg-red-100',
    PENDING_SANITATION: 'text-amber-700 bg-amber-100',
    COMPLETED:          'text-green-700 bg-green-100',
    CANCELLED:          'text-rose-700  bg-rose-100',
};

function fmtTime(dt) {
    return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(start, end) {
    const ms = new Date(end) - new Date(start);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [now] = useState(new Date());

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        Promise.all([
            getBookings({ date: today }),
            getHmsRooms().catch(() => ({ data: [] })),
        ]).then(([bRes, rRes]) => {
            setBookings(Array.isArray(bRes.data) ? bRes.data : []);
            setRooms(Array.isArray(rRes.data) ? rRes.data : []);
        }).finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="flex items-center gap-3 text-gray-500">
                    <Activity size={20} className="animate-spin" />
                    <span>Loading…</span>
                </div>
            </div>
        );
    }

    const active  = bookings.filter(b => b.status === 'IN_PROGRESS');
    const pending = bookings.filter(b => b.status === 'PENDING_SANITATION');
    const upcoming = bookings
        .filter(b => ['CONFIRMED', 'REQUESTED'].includes(b.status) && new Date(b.scheduledStart) > now)
        .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));
    const completed = bookings.filter(b => b.status === 'COMPLETED');
    const cancelled = bookings.filter(b => b.status === 'CANCELLED');

    // Room utilization — how many OT rooms are occupied right now
    const occupiedRoomIds = new Set(active.map(b => String(b.roomId)));
    const totalRooms = rooms.length || (new Set(bookings.map(b => String(b.roomId))).size);
    const utilization = totalRooms > 0 ? Math.round((occupiedRoomIds.size / totalRooms) * 100) : 0;

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard icon={<Activity size={22} className="text-red-500" />}
                    label="In Progress" value={active.length} sub={`of ${bookings.length} today`}
                    bg="bg-red-50 border-red-100" onClick={() => navigate('/ot-board')} />
                <StatCard icon={<AlertTriangle size={22} className="text-amber-500" />}
                    label="Sanitation" value={pending.length} sub="rooms to clean"
                    bg="bg-amber-50 border-amber-100" onClick={() => navigate('/ot-board')} />
                <StatCard icon={<Clock size={22} className="text-blue-500" />}
                    label="Upcoming" value={upcoming.length} sub="cases scheduled"
                    bg="bg-blue-50 border-blue-100" onClick={() => navigate('/cases')} />
                <StatCard icon={<CheckCircle2 size={22} className="text-green-500" />}
                    label="Completed" value={completed.length} sub={`${cancelled.length} cancelled`}
                    bg="bg-green-50 border-green-100" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Today's Schedule */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                            <Calendar size={16} />
                            Today's Cases
                        </h2>
                        <button onClick={() => navigate('/cases')}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                            All cases <ArrowRight size={12} />
                        </button>
                    </div>
                    {bookings.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-sm">No cases scheduled today</div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {bookings
                                .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart))
                                .slice(0, 8)
                                .map(b => (
                                    <button key={b.id} onClick={() => navigate(`/cases/${b.id}`)}
                                        className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition text-left">
                                        <div className="text-center w-14 flex-shrink-0">
                                            <p className="text-sm font-bold text-gray-700">{fmtTime(b.scheduledStart)}</p>
                                            <p className="text-xs text-gray-400">{fmtDuration(b.scheduledStart, b.scheduledEnd)}</p>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 text-sm truncate">{b.procedureName}</p>
                                            <p className="text-xs text-gray-500 truncate">{b.patientName} · Dr. {b.surgeonName} · {b.roomName}</p>
                                        </div>
                                        <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[b.status] || STATUS_COLOR.REQUESTED}`}>
                                            {b.status.replace('_', ' ')}
                                        </span>
                                    </button>
                                ))}
                        </div>
                    )}
                </div>

                {/* Right column */}
                <div className="space-y-5">
                    {/* OT Utilization */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Monitor size={16} />
                            OT Utilization
                        </h2>
                        <div className="text-center mb-3">
                            <p className="text-4xl font-bold text-gray-900">{utilization}%</p>
                            <p className="text-sm text-gray-500">{occupiedRoomIds.size} of {totalRooms} rooms active</p>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                            <div className={`h-3 rounded-full transition-all ${utilization > 80 ? 'bg-red-500' : utilization > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                                style={{ width: `${utilization}%` }} />
                        </div>
                        <button onClick={() => navigate('/ot-board')}
                            className="mt-4 w-full text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center gap-1">
                            Open Live Board <ArrowRight size={13} />
                        </button>
                    </div>

                    {/* Active Surgeries */}
                    {active.length > 0 && (
                        <div className="bg-white rounded-2xl border border-red-200 p-5">
                            <h2 className="font-bold text-red-700 mb-3 flex items-center gap-2 text-sm">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                Active Now
                            </h2>
                            <div className="space-y-3">
                                {active.map(b => (
                                    <button key={b.id} onClick={() => navigate(`/cases/${b.id}`)}
                                        className="w-full text-left p-3 bg-red-50 rounded-xl hover:bg-red-100 transition">
                                        <p className="font-semibold text-sm text-gray-900 truncate">{b.procedureName}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{b.roomName} · Dr. {b.surgeonName}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Next Up */}
                    {upcoming.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-5">
                            <h2 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
                                <Clock size={14} />
                                Next Up
                            </h2>
                            <div className="space-y-2">
                                {upcoming.slice(0, 3).map(b => (
                                    <button key={b.id} onClick={() => navigate(`/cases/${b.id}`)}
                                        className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition">
                                        <span className="text-sm font-bold text-blue-600 w-12 flex-shrink-0">{fmtTime(b.scheduledStart)}</span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{b.procedureName}</p>
                                            <p className="text-xs text-gray-400 truncate">{b.roomName}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, sub, bg, onClick }) {
    return (
        <button onClick={onClick}
            className={`rounded-2xl border p-4 text-left w-full transition ${bg} ${onClick ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
                </div>
                {icon}
            </div>
        </button>
    );
}
