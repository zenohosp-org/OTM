import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBookings, getHmsRooms } from '../api/client';
import { Calendar, Clock, Activity, CheckCircle2, Monitor, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';

const STATUS_BADGE = {
    REQUESTED:          'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-500/20',
    CONFIRMED:          'text-blue-700  bg-blue-100  dark:text-blue-300  dark:bg-blue-500/20',
    IN_PROGRESS:        'text-rose-700  bg-rose-100  dark:text-rose-300  dark:bg-rose-500/20',
    PENDING_SANITATION: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/20',
    COMPLETED:          'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/20',
    CANCELLED:          'text-rose-700  bg-rose-100  dark:text-rose-300  dark:bg-rose-500/20',
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
            <div className="flex items-center justify-center min-h-[60vh] gap-2 text-slate-500 dark:text-[#888888]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading dashboard…</span>
            </div>
        );
    }

    const active     = bookings.filter(b => b.status === 'IN_PROGRESS');
    const pending    = bookings.filter(b => b.status === 'PENDING_SANITATION');
    const upcoming   = bookings
        .filter(b => ['CONFIRMED', 'REQUESTED'].includes(b.status) && new Date(b.scheduledStart) > now)
        .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));
    const completed  = bookings.filter(b => b.status === 'COMPLETED');
    const cancelled  = bookings.filter(b => b.status === 'CANCELLED');

    const occupiedRoomIds = new Set(active.map(b => String(b.roomId)));
    const totalRooms = rooms.length || (new Set(bookings.map(b => String(b.roomId))).size);
    const utilization = totalRooms > 0 ? Math.round((occupiedRoomIds.size / totalRooms) * 100) : 0;
    const barColor = utilization > 80 ? 'bg-rose-500' : utilization > 50 ? 'bg-amber-500' : 'bg-emerald-500';

    return (
        <div className="space-y-6 max-w-8xl">
            {/* Page header */}
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Dashboard
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-[#888888] mt-0.5">
                        {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <button onClick={() => navigate('/cases')} className="btn-primary">
                    <Calendar className="w-4 h-4" /> View All Cases
                </button>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon={Activity}
                    label="In Progress"
                    value={active.length}
                    sub={`of ${bookings.length} today`}
                    tone="rose"
                    onClick={() => navigate('/ot-board')}
                />
                <StatCard
                    icon={AlertTriangle}
                    label="Sanitation"
                    value={pending.length}
                    sub="rooms to clean"
                    tone="amber"
                    onClick={() => navigate('/ot-board')}
                />
                <StatCard
                    icon={Clock}
                    label="Upcoming"
                    value={upcoming.length}
                    sub="cases scheduled"
                    tone="blue"
                    onClick={() => navigate('/cases')}
                />
                <StatCard
                    icon={CheckCircle2}
                    label="Completed"
                    value={completed.length}
                    sub={`${cancelled.length} cancelled`}
                    tone="emerald"
                />
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Today's Cases */}
                <div className="lg:col-span-2 rounded-lg bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-[#1e1e1e] flex items-center justify-between">
                        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            Today's Cases
                        </h2>
                        <button
                            onClick={() => navigate('/cases')}
                            className="text-xs font-semibold text-slate-600 dark:text-[#aaaaaa] hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors"
                        >
                            All cases <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                    {bookings.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 dark:text-[#666666] text-sm">No cases scheduled today</div>
                    ) : (
                        <div className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
                            {bookings
                                .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart))
                                .slice(0, 8)
                                .map(b => (
                                    <button
                                        key={b.id}
                                        onClick={() => navigate(`/cases/${b.id}`)}
                                        className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-[#161616] transition-colors text-left"
                                    >
                                        <div className="text-center w-14 flex-shrink-0">
                                            <p className="text-sm font-bold text-slate-700 dark:text-[#cccccc] tabular-nums">{fmtTime(b.scheduledStart)}</p>
                                            <p className="text-xs text-slate-400 dark:text-[#666666] tabular-nums">{fmtDuration(b.scheduledStart, b.scheduledEnd)}</p>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{b.procedureName}</p>
                                            <p className="text-xs text-slate-500 dark:text-[#888888] truncate">{b.patientName} · Dr. {b.surgeonName} · {b.roomName}</p>
                                        </div>
                                        <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${STATUS_BADGE[b.status] || STATUS_BADGE.REQUESTED}`}>
                                            {b.status.replace(/_/g, ' ')}
                                        </span>
                                    </button>
                                ))}
                        </div>
                    )}
                </div>

                {/* Right column */}
                <div className="space-y-5">
                    {/* OT Utilization */}
                    <div className="rounded-lg bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] p-5">
                        <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2 text-sm">
                            <Monitor className="w-4 h-4 text-slate-400" />
                            OT Utilization
                        </h2>
                        <div className="text-center mb-3">
                            <p className="text-4xl font-bold text-slate-900 dark:text-white tabular-nums">{utilization}%</p>
                            <p className="text-sm text-slate-500 dark:text-[#888888]">{occupiedRoomIds.size} of {totalRooms} rooms active</p>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-[#1e1e1e] rounded-full h-2.5 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${utilization}%` }} />
                        </div>
                        <button
                            onClick={() => navigate('/ot-board')}
                            className="mt-4 w-full text-sm text-slate-600 dark:text-[#aaaaaa] hover:text-slate-900 dark:hover:text-white font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                            Open Live Board <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Active Surgeries */}
                    {active.length > 0 && (
                        <div className="rounded-lg bg-white dark:bg-[#111111] border border-rose-200 dark:border-rose-500/20 p-5">
                            <h2 className="font-bold text-rose-700 dark:text-rose-400 mb-3 flex items-center gap-2 text-sm">
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                Active Now
                            </h2>
                            <div className="space-y-2">
                                {active.map(b => (
                                    <button
                                        key={b.id}
                                        onClick={() => navigate(`/cases/${b.id}`)}
                                        className="w-full text-left p-3 bg-rose-50 dark:bg-rose-500/10 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
                                    >
                                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{b.procedureName}</p>
                                        <p className="text-xs text-slate-500 dark:text-[#888888] mt-0.5 truncate">{b.roomName} · Dr. {b.surgeonName}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Next Up */}
                    {upcoming.length > 0 && (
                        <div className="rounded-lg bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] p-5">
                            <h2 className="font-bold text-slate-900 dark:text-white mb-3 text-sm flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                Next Up
                            </h2>
                            <div className="space-y-1">
                                {upcoming.slice(0, 3).map(b => (
                                    <button
                                        key={b.id}
                                        onClick={() => navigate(`/cases/${b.id}`)}
                                        className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-[#161616] transition-colors"
                                    >
                                        <span className="text-sm font-bold text-slate-700 dark:text-[#cccccc] w-12 flex-shrink-0 tabular-nums">{fmtTime(b.scheduledStart)}</span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-800 dark:text-[#dddddd] truncate">{b.procedureName}</p>
                                            <p className="text-xs text-slate-400 dark:text-[#666666] truncate">{b.roomName}</p>
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

const TONE = {
    rose:    { iconBg: 'bg-rose-50 dark:bg-rose-500/10',       iconColor: 'text-rose-600 dark:text-rose-400'       },
    amber:   { iconBg: 'bg-amber-50 dark:bg-amber-500/10',     iconColor: 'text-amber-600 dark:text-amber-400'     },
    blue:    { iconBg: 'bg-blue-50 dark:bg-blue-500/10',       iconColor: 'text-blue-600 dark:text-blue-400'       },
    emerald: { iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', iconColor: 'text-emerald-600 dark:text-emerald-400' },
};

function StatCard({ icon: Icon, label, value, sub, tone, onClick }) {
    const { iconBg, iconColor } = TONE[tone] ?? TONE.blue;
    const isButton = !!onClick;
    const Wrapper = isButton ? 'button' : 'div';
    return (
        <Wrapper
            onClick={onClick}
            className={`rounded-lg bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] p-4 flex items-center gap-4 text-left w-full transition-all ${isButton ? 'hover:border-slate-300 dark:hover:border-[#2a2a2a] hover:shadow-sm cursor-pointer' : ''}`}
        >
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="min-w-0">
                <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none tabular-nums">{value}</p>
                <p className="text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wider mt-1">{label}</p>
                {sub && <p className="text-[11px] text-slate-400 dark:text-[#666666] mt-0.5 truncate">{sub}</p>}
            </div>
        </Wrapper>
    );
}
