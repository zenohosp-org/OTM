import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getBookings, getHmsRooms,
    confirmBooking, startBooking, endBooking, sanitizeBooking,
} from '../api/client';
import { RefreshCw, Activity, Clock, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';

const STATUS_META = {
    IN_PROGRESS:        { label: 'In Progress',  dot: 'bg-red-500 animate-pulse',  card: 'border-red-400',   header: 'bg-red-100',   text: 'text-red-700'   },
    PENDING_SANITATION: { label: 'Sanitation',    dot: 'bg-amber-400',              card: 'border-amber-400', header: 'bg-amber-100', text: 'text-amber-700' },
    UPCOMING:           { label: 'Upcoming',      dot: 'bg-blue-500',               card: 'border-blue-300',  header: 'bg-blue-100',  text: 'text-blue-700'  },
    VACANT:             { label: 'Available',     dot: 'bg-green-500',              card: 'border-green-300', header: 'bg-green-100', text: 'text-green-700' },
};

function fmt(ms) {
    if (ms <= 0) return '0m';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
    return `${sec}s`;
}

function fmtTime(dt) {
    return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function deriveRoomsFromBookings(bookings) {
    const map = {};
    bookings.forEach(b => {
        if (b.roomId && !map[b.roomId]) map[b.roomId] = { id: b.roomId, name: b.roomName };
    });
    return Object.values(map).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export default function OtBoard() {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(new Date());
    const [actionLoading, setActionLoading] = useState(null);

    useEffect(() => {
        const tick = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(tick);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const [roomsRes, bookingsRes] = await Promise.all([
                getHmsRooms().catch(() => ({ data: [] })),
                getBookings({ date: today }),
            ]);
            setRooms(Array.isArray(roomsRes.data) ? roomsRes.data : []);
            setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
        } catch {
            // silently ignore
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleAction = async (action, bookingId) => {
        setActionLoading(bookingId);
        try {
            const fns = { confirm: confirmBooking, start: startBooking, end: endBooking, sanitize: sanitizeBooking };
            await fns[action](bookingId);
            await fetchData();
        } finally {
            setActionLoading(null);
        }
    };

    const displayRooms = rooms.length > 0 ? rooms : deriveRoomsFromBookings(bookings);

    const roomCards = displayRooms.map(room => {
        const roomId = String(room.id);
        const todayBookings = bookings.filter(b => String(b.roomId) === roomId);
        const active = todayBookings.find(b => ['IN_PROGRESS', 'PENDING_SANITATION'].includes(b.status));
        const upcoming = todayBookings
            .filter(b => ['CONFIRMED', 'REQUESTED'].includes(b.status) && new Date(b.scheduledStart) > now)
            .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart))[0];

        let status = 'VACANT';
        if (active?.status === 'IN_PROGRESS') status = 'IN_PROGRESS';
        else if (active?.status === 'PENDING_SANITATION') status = 'PENDING_SANITATION';
        else if (upcoming) status = 'UPCOMING';

        return { room, active, upcoming, status };
    });

    const counts = {
        inProgress: bookings.filter(b => b.status === 'IN_PROGRESS').length,
        sanitation: bookings.filter(b => b.status === 'PENDING_SANITATION').length,
        upcoming: bookings.filter(b => ['CONFIRMED', 'REQUESTED'].includes(b.status)).length,
        completed: bookings.filter(b => b.status === 'COMPLETED').length,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="flex items-center gap-3 text-gray-500">
                    <RefreshCw size={20} className="animate-spin" />
                    <span className="font-medium">Loading OT Board…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* ── Header ── */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Live OT Board</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-700 font-medium"
                    >
                        <RefreshCw size={13} />
                        Refresh
                    </button>
                    <button
                        onClick={() => navigate('/cases')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                    >
                        <Plus size={13} />
                        New Booking
                    </button>
                </div>
            </div>

            {/* ── Stats Bar ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'In Progress',  value: counts.inProgress, bg: 'bg-red-50 border-red-100',    val: 'text-red-600'   },
                    { label: 'Sanitation',   value: counts.sanitation, bg: 'bg-amber-50 border-amber-100', val: 'text-amber-600' },
                    { label: 'Upcoming',     value: counts.upcoming,   bg: 'bg-blue-50 border-blue-100',   val: 'text-blue-600'  },
                    { label: 'Completed',    value: counts.completed,  bg: 'bg-green-50 border-green-100', val: 'text-green-600' },
                ].map(s => (
                    <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
                        <p className={`text-3xl font-bold mt-1 ${s.val}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* ── Room Grid ── */}
            {roomCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                    <Activity size={40} className="mb-3 opacity-30" />
                    <p className="font-medium">No OT rooms found</p>
                    <p className="text-sm mt-1">HMS rooms will appear here once available</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {roomCards.map(({ room, active, upcoming, status }) => (
                        <RoomCard
                            key={room.id}
                            room={room}
                            active={active}
                            upcoming={upcoming}
                            status={status}
                            now={now}
                            actioning={actionLoading === (active || upcoming)?.id}
                            onAction={handleAction}
                            onView={id => navigate(`/cases/${id}`)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function RoomCard({ room, active, upcoming, status, now, actioning, onAction, onView }) {
    const meta = STATUS_META[status];
    const booking = active || upcoming;
    const roomName = room.name || room.roomNumber || `Room ${room.id}`;

    return (
        <div className={`rounded-2xl border-2 ${meta.card} bg-white overflow-hidden shadow-sm`}>
            <div className={`px-4 py-3 flex items-center justify-between ${meta.header}`}>
                <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />
                    <span className="font-bold text-gray-800 text-sm">{roomName}</span>
                </div>
                <span className={`text-xs font-semibold uppercase tracking-wider ${meta.text}`}>
                    {meta.label}
                </span>
            </div>

            <div className="p-4">
                {status === 'IN_PROGRESS' && active && (
                    <InProgressBody booking={active} now={now} actioning={actioning} onAction={onAction} onView={onView} />
                )}
                {status === 'PENDING_SANITATION' && active && (
                    <SanitationBody booking={active} now={now} actioning={actioning} onAction={onAction} onView={onView} />
                )}
                {status === 'UPCOMING' && upcoming && (
                    <UpcomingBody booking={upcoming} now={now} actioning={actioning} onAction={onAction} onView={onView} />
                )}
                {status === 'VACANT' && (
                    <VacantBody upcoming={upcoming} />
                )}
            </div>
        </div>
    );
}

function InProgressBody({ booking, now, actioning, onAction, onView }) {
    const elapsed = now - new Date(booking.actualStart);
    const total = new Date(booking.scheduledEnd) - new Date(booking.scheduledStart);
    const pct = Math.min(100, (elapsed / total) * 100);
    const overtime = now > new Date(booking.scheduledEnd);
    const remaining = new Date(booking.scheduledEnd) - now;

    return (
        <div className="space-y-3">
            <div>
                <p className="font-semibold text-gray-900 leading-tight">{booking.procedureName}</p>
                <p className="text-sm text-gray-500 mt-0.5">{booking.patientName}
                    {booking.patientMrn ? <span className="text-gray-400"> · {booking.patientMrn}</span> : null}
                </p>
                {booking.surgeonName && (
                    <p className="text-sm text-gray-500">Dr. {booking.surgeonName}</p>
                )}
            </div>

            <div>
                <div className="flex justify-between text-xs mb-1">
                    <span className="flex items-center gap-1 text-gray-500">
                        <Activity size={11} />
                        Elapsed: <span className="font-semibold text-gray-700 ml-0.5">{fmt(elapsed)}</span>
                    </span>
                    {overtime
                        ? <span className="text-red-600 font-semibold">+{fmt(-remaining)} overtime</span>
                        : <span className="text-gray-500">Remaining: <span className="font-semibold text-gray-700">{fmt(remaining)}</span></span>
                    }
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full transition-all duration-1000 ${overtime ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{fmtTime(booking.scheduledStart)}</span>
                    <span>{fmtTime(booking.scheduledEnd)}</span>
                </div>
            </div>

            <div className="flex gap-2 pt-1">
                <button onClick={() => onView(booking.id)}
                    className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600 font-medium">
                    Details
                </button>
                <button onClick={() => onAction('end', booking.id)} disabled={actioning}
                    className="flex-1 px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-semibold disabled:opacity-50">
                    {actioning ? '…' : '⏹ End Surgery'}
                </button>
            </div>
        </div>
    );
}

function SanitationBody({ booking, now, actioning, onAction, onView }) {
    const waiting = now - new Date(booking.actualEnd || booking.scheduledEnd);
    return (
        <div className="space-y-3">
            <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Procedure Completed</p>
                <p className="font-semibold text-gray-900 leading-tight">{booking.procedureName}</p>
                <p className="text-sm text-gray-500">{booking.patientName}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                <AlertTriangle size={14} className="flex-shrink-0" />
                <span>Room being sanitized · <span className="font-semibold">{fmt(waiting)}</span></span>
            </div>
            <div className="flex gap-2 pt-1">
                <button onClick={() => onView(booking.id)}
                    className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600 font-medium">
                    Details
                </button>
                <button onClick={() => onAction('sanitize', booking.id)} disabled={actioning}
                    className="flex-1 px-3 py-2 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition font-semibold disabled:opacity-50">
                    {actioning ? '…' : '✓ Done'}
                </button>
            </div>
        </div>
    );
}

function UpcomingBody({ booking, now, actioning, onAction, onView }) {
    const startsIn = new Date(booking.scheduledStart) - now;
    const soon = startsIn < 15 * 60 * 1000;

    return (
        <div className="space-y-3">
            <div>
                <p className="font-semibold text-gray-900 leading-tight">{booking.procedureName}</p>
                <p className="text-sm text-gray-500 mt-0.5">{booking.patientName}
                    {booking.patientMrn ? <span className="text-gray-400"> · {booking.patientMrn}</span> : null}
                </p>
                {booking.surgeonName && <p className="text-sm text-gray-500">Dr. {booking.surgeonName}</p>}
            </div>
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${soon ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                <Clock size={13} className="flex-shrink-0" />
                <span>
                    {booking.status === 'REQUESTED' ? 'Unconfirmed · ' : ''}
                    Starts in <span className="font-semibold">{fmt(startsIn)}</span>
                    <span className="text-gray-400 ml-1">({fmtTime(booking.scheduledStart)})</span>
                </span>
            </div>
            <div className="flex gap-2 pt-1">
                <button onClick={() => onView(booking.id)}
                    className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600 font-medium">
                    Details
                </button>
                {booking.status === 'REQUESTED' && (
                    <button onClick={() => onAction('confirm', booking.id)} disabled={actioning}
                        className="flex-1 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold disabled:opacity-50">
                        {actioning ? '…' : '✓ Confirm'}
                    </button>
                )}
                {booking.status === 'CONFIRMED' && (
                    <button onClick={() => onAction('start', booking.id)} disabled={actioning}
                        className="flex-1 px-3 py-2 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-semibold disabled:opacity-50">
                        {actioning ? '…' : '▶ Start'}
                    </button>
                )}
            </div>
        </div>
    );
}

function VacantBody({ upcoming }) {
    return (
        <div className="space-y-2 py-1">
            <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 size={18} />
                <span className="font-semibold text-sm">Room Available</span>
            </div>
            {upcoming ? (
                <p className="text-sm text-gray-500">
                    Next: <span className="font-medium text-gray-700">{upcoming.procedureName}</span>
                    {' '}at <span className="font-medium">{fmtTime(upcoming.scheduledStart)}</span>
                </p>
            ) : (
                <p className="text-sm text-gray-400">No more bookings today</p>
            )}
        </div>
    );
}
