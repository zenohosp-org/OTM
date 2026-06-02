import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getBookings, getHmsRooms,
    confirmBooking, startBooking, endBooking, sanitizeBooking,
} from '../api/client';
import {
    RefreshCw, Activity, Clock, CheckCircle2, AlertTriangle, Plus, Square, Play,
} from 'lucide-react';

const STATUS_META = {
    IN_PROGRESS:        { label: 'In Progress', className: 'status-in-progress' },
    PENDING_SANITATION: { label: 'Sanitation',  className: 'status-sanitation'  },
    UPCOMING:           { label: 'Upcoming',    className: 'status-upcoming'    },
    VACANT:             { label: 'Available',   className: 'status-vacant'     },
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
            <div className="z-page-loader">
                <RefreshCw />
                <span>Loading OT Board…</span>
            </div>
        );
    }

    return (
        <div className="z-page">
            <header className="z-page-header">
                <div>
                    <h1 className="z-page-title">Live OT Board</h1>
                    <p className="z-page-subtitle">
                        {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="z-page-actions">
                    <button onClick={fetchData} className="z-btn-secondary">
                        <RefreshCw className="u-w-4 u-h-4" />
                        Refresh
                    </button>
                    <button onClick={() => navigate('/cases/new')} className="z-btn-primary">
                        <Plus className="u-w-4 u-h-4" />
                        New Booking
                    </button>
                </div>
            </header>

            <div className="z-stat-grid">
                <StatTile icon={Activity}      tone="rose"    label="In Progress" value={counts.inProgress} />
                <StatTile icon={AlertTriangle} tone="amber"   label="Sanitation"  value={counts.sanitation} />
                <StatTile icon={Clock}         tone="blue"    label="Upcoming"    value={counts.upcoming} />
                <StatTile icon={CheckCircle2}  tone="emerald" label="Completed"   value={counts.completed} />
            </div>

            {roomCards.length === 0 ? (
                <div className="z-empty">
                    <div className="z-empty-icon"><Activity /></div>
                    <p className="z-empty-title">No OT rooms found</p>
                    <p className="z-empty-description">
                        HMS rooms will appear here once available.
                    </p>
                </div>
            ) : (
                <div className="ot-board-grid">
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

function StatTile({ icon: Icon, tone, label, value }) {
    return (
        <div className="z-stat-card">
            <div className={`z-stat-icon is-${tone}`}>
                <Icon />
            </div>
            <div className="z-stat-body">
                <p className="z-stat-value">{value}</p>
                <p className="z-stat-label">{label}</p>
            </div>
        </div>
    );
}

function RoomCard({ room, active, upcoming, status, now, actioning, onAction, onView }) {
    const meta = STATUS_META[status];
    const roomName = room.name || room.roomNumber || `Room ${room.id}`;

    return (
        <div className={`room-card ${meta.className}`}>
            <div className="room-card-header">
                <span className="room-card-name">
                    <span className="room-card-dot" />
                    {roomName}
                </span>
                <span className="room-card-status">{meta.label}</span>
            </div>

            <div className="room-card-body">
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
    const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
    const overtime = now > new Date(booking.scheduledEnd);
    const remaining = new Date(booking.scheduledEnd) - now;

    return (
        <>
            <div>
                <p className="room-card-procedure">{booking.procedureName}</p>
                <p className="room-card-meta">
                    {booking.patientName}
                    {booking.patientMrn && <><span className="room-card-meta-divider">·</span>{booking.patientMrn}</>}
                </p>
                {booking.surgeonName && (
                    <p className="room-card-meta">Dr. {booking.surgeonName}</p>
                )}
            </div>

            <div className="room-card-timer">
                <div className="room-card-timer-row">
                    <span className="elapsed">
                        <Activity className="u-w-4 u-h-4" />
                        Elapsed: <span className="elapsed-value">{fmt(elapsed)}</span>
                    </span>
                    {overtime ? (
                        <span className="overtime">+{fmt(-remaining)} overtime</span>
                    ) : (
                        <span className="remaining">Remaining: <strong>{fmt(remaining)}</strong></span>
                    )}
                </div>
                <div className="z-progress is-sm">
                    <div
                        className={`z-progress-bar ${overtime ? 'is-danger' : 'is-success'}`}
                        style={{ '--progress': `${pct}%` }}
                    />
                </div>
                <div className="room-card-timer-times">
                    <span>{fmtTime(booking.scheduledStart)}</span>
                    <span>{fmtTime(booking.scheduledEnd)}</span>
                </div>
            </div>

            <div className="room-card-actions">
                <button onClick={() => onView(booking.id)} className="z-btn-secondary is-sm">Details</button>
                <button
                    onClick={() => onAction('end', booking.id)}
                    disabled={actioning}
                    className={`z-btn-danger is-sm${actioning ? ' z-btn-loading' : ''}`}
                >
                    <Square className="u-w-4 u-h-4" />
                    End Surgery
                </button>
            </div>
        </>
    );
}

function SanitationBody({ booking, now, actioning, onAction, onView }) {
    const waiting = now - new Date(booking.actualEnd || booking.scheduledEnd);
    return (
        <>
            <div>
                <p className="room-card-overline">Procedure Completed</p>
                <p className="room-card-procedure">{booking.procedureName}</p>
                <p className="room-card-meta">{booking.patientName}</p>
            </div>
            <div className="room-card-banner is-sanitation">
                <AlertTriangle />
                <span>Room being sanitized · <strong>{fmt(waiting)}</strong></span>
            </div>
            <div className="room-card-actions">
                <button onClick={() => onView(booking.id)} className="z-btn-secondary is-sm">Details</button>
                <button
                    onClick={() => onAction('sanitize', booking.id)}
                    disabled={actioning}
                    className={`z-btn-warning is-sm${actioning ? ' z-btn-loading' : ''}`}
                >
                    <CheckCircle2 className="u-w-4 u-h-4" />
                    Done
                </button>
            </div>
        </>
    );
}

function UpcomingBody({ booking, now, actioning, onAction, onView }) {
    const startsIn = new Date(booking.scheduledStart) - now;
    const soon = startsIn < 15 * 60 * 1000;

    return (
        <>
            <div>
                <p className="room-card-procedure">{booking.procedureName}</p>
                <p className="room-card-meta">
                    {booking.patientName}
                    {booking.patientMrn && <><span className="room-card-meta-divider">·</span>{booking.patientMrn}</>}
                </p>
                {booking.surgeonName && <p className="room-card-meta">Dr. {booking.surgeonName}</p>}
            </div>
            <div className={`room-card-banner ${soon ? 'is-soon' : 'is-upcoming'}`}>
                <Clock />
                <span>
                    {booking.status === 'REQUESTED' && 'Unconfirmed · '}
                    Starts in <strong>{fmt(startsIn)}</strong>
                    <span className="u-text-subtle"> ({fmtTime(booking.scheduledStart)})</span>
                </span>
            </div>
            <div className="room-card-actions">
                <button onClick={() => onView(booking.id)} className="z-btn-secondary is-sm">Details</button>
                {booking.status === 'REQUESTED' && (
                    <button
                        onClick={() => onAction('confirm', booking.id)}
                        disabled={actioning}
                        className={`z-btn-info is-sm${actioning ? ' z-btn-loading' : ''}`}
                    >
                        <CheckCircle2 className="u-w-4 u-h-4" />
                        Confirm
                    </button>
                )}
                {booking.status === 'CONFIRMED' && (
                    <button
                        onClick={() => onAction('start', booking.id)}
                        disabled={actioning}
                        className={`z-btn-success is-sm${actioning ? ' z-btn-loading' : ''}`}
                    >
                        <Play className="u-w-4 u-h-4" />
                        Start
                    </button>
                )}
            </div>
        </>
    );
}

function VacantBody({ upcoming }) {
    return (
        <div className="room-card-vacant">
            <span className="room-card-vacant-label">
                <CheckCircle2 className="u-w-5 u-h-5" />
                Room Available
            </span>
            {upcoming ? (
                <p className="room-card-vacant-next">
                    Next: <strong>{upcoming.procedureName}</strong> at <strong>{fmtTime(upcoming.scheduledStart)}</strong>
                </p>
            ) : (
                <p className="room-card-vacant-next u-text-subtle">No more bookings today</p>
            )}
        </div>
    );
}
