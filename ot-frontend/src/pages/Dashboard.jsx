import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBookings, getHmsRooms } from '../api/client';
import {
    Calendar, Clock, Activity, CheckCircle2, Monitor, ArrowRight, AlertTriangle, Loader2,
} from 'lucide-react';

const STATUS_BADGE = {
    REQUESTED:          'is-status-requested',
    CONFIRMED:          'is-status-confirmed',
    IN_PROGRESS:        'is-status-in-progress',
    PENDING_SANITATION: 'is-status-sanitation',
    COMPLETED:          'is-status-completed',
    CANCELLED:          'is-status-cancelled',
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
            <div className="z-page-loader">
                <Loader2 />
                <span>Loading dashboard…</span>
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
    const utilizationTone = utilization > 80 ? 'is-danger' : utilization > 50 ? 'is-warning' : 'is-success';

    return (
        <div className="z-page">
            <header className="z-page-header">
                <div>
                    <h1 className="z-page-title">Dashboard</h1>
                    <p className="z-page-subtitle">
                        {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="z-page-actions">
                    <button onClick={() => navigate('/cases')} className="z-btn-primary">
                        <Calendar className="u-w-4 u-h-4" />
                        View All Cases
                    </button>
                </div>
            </header>

            <div className="z-stat-grid">
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

            <div className="u-grid u-grid-cols-1 lg:u-grid-cols-3 u-gap-5">
                <div className="lg:u-col-span-2 z-card is-no-padding">
                    <div className="z-card-header">
                        <span className="z-card-header-title">
                            <Calendar /> Today's Cases
                        </span>
                        <button onClick={() => navigate('/cases')} className="panel-link">
                            All cases <ArrowRight />
                        </button>
                    </div>
                    {bookings.length === 0 ? (
                        <div className="z-empty">
                            <div className="z-empty-icon"><Calendar /></div>
                            <p className="z-empty-title">No cases scheduled today</p>
                        </div>
                    ) : (
                        <div className="today-bookings">
                            {bookings
                                .slice()
                                .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart))
                                .slice(0, 8)
                                .map(b => (
                                    <button
                                        key={b.id}
                                        onClick={() => navigate(`/cases/${b.id}`)}
                                        className="today-booking-row"
                                    >
                                        <div className="today-booking-time">
                                            <p className="today-booking-time-value">{fmtTime(b.scheduledStart)}</p>
                                            <p className="today-booking-time-duration">{fmtDuration(b.scheduledStart, b.scheduledEnd)}</p>
                                        </div>
                                        <div className="today-booking-text">
                                            <p className="today-booking-procedure">{b.procedureName}</p>
                                            <p className="today-booking-meta">
                                                {b.patientName} · Dr. {b.surgeonName} · {b.roomName}
                                            </p>
                                        </div>
                                        <span className={`z-badge ${STATUS_BADGE[b.status] || 'is-status-requested'}`}>
                                            {b.status.replace(/_/g, ' ')}
                                        </span>
                                    </button>
                                ))}
                        </div>
                    )}
                </div>

                <div className="u-stack-lg">
                    <div className="z-card">
                        <div className="z-card-header-title u-mb-3">
                            <Monitor /> OT Utilization
                        </div>
                        <div className="utilization-panel">
                            <p className="utilization-value">{utilization}%</p>
                            <p className="utilization-sub">{occupiedRoomIds.size} of {totalRooms} rooms active</p>
                            <ProgressBar value={utilization} tone={utilizationTone} />
                        </div>
                        <button onClick={() => navigate('/ot-board')} className="panel-link u-w-full u-justify-center u-mt-3">
                            Open Live Board <ArrowRight />
                        </button>
                    </div>

                    {active.length > 0 && (
                        <div className="z-card">
                            <div className="z-card-header-title u-mb-3">
                                <span className="z-pulse-dot" /> Active Now
                            </div>
                            <div className="active-list">
                                {active.map(b => (
                                    <button
                                        key={b.id}
                                        onClick={() => navigate(`/cases/${b.id}`)}
                                        className="active-list-item"
                                    >
                                        <p className="active-list-procedure">{b.procedureName}</p>
                                        <p className="active-list-meta">{b.roomName} · Dr. {b.surgeonName}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {upcoming.length > 0 && (
                        <div className="z-card">
                            <div className="z-card-header-title u-mb-3">
                                <Clock /> Next Up
                            </div>
                            <div className="next-up-list">
                                {upcoming.slice(0, 3).map(b => (
                                    <button
                                        key={b.id}
                                        onClick={() => navigate(`/cases/${b.id}`)}
                                        className="next-up-item"
                                    >
                                        <span className="next-up-time">{fmtTime(b.scheduledStart)}</span>
                                        <div className="next-up-text">
                                            <p className="next-up-text-title">{b.procedureName}</p>
                                            <p className="next-up-text-sub">{b.roomName}</p>
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

function StatCard({ icon: Icon, label, value, sub, tone, onClick }) {
    const toneClass = `is-${tone === 'rose' ? 'rose' : tone === 'amber' ? 'amber' : tone === 'blue' ? 'blue' : tone === 'emerald' ? 'emerald' : 'slate'}`;
    const Wrapper = onClick ? 'button' : 'div';
    return (
        <Wrapper
            onClick={onClick}
            className={`z-stat-card${onClick ? ' is-interactive' : ''}`}
        >
            <div className={`z-stat-icon ${toneClass}`}>
                <Icon />
            </div>
            <div className="z-stat-body">
                <p className="z-stat-value">{value}</p>
                <p className="z-stat-label">{label}</p>
                {sub && <p className="z-stat-sub">{sub}</p>}
            </div>
        </Wrapper>
    );
}

function ProgressBar({ value, tone }) {
    return (
        <div className="z-progress is-md u-w-full">
            <div
                className={`z-progress-bar ${tone}`}
                style={{ '--progress': `${value}%` }}
            />
        </div>
    );
}
