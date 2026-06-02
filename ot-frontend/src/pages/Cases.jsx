import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBookings } from '../api/client';
import { Plus, CheckCircle2, Loader2 } from 'lucide-react';

const STATUS_CONFIG = {
    REQUESTED:          { label: 'Requested',          className: 'is-status-requested'    },
    CONFIRMED:          { label: 'Confirmed',          className: 'is-status-confirmed'    },
    IN_PROGRESS:        { label: 'In Progress',        className: 'is-status-in-progress'  },
    PENDING_SANITATION: { label: 'Pending Sanitation', className: 'is-status-sanitation'   },
    COMPLETED:          { label: 'Completed',          className: 'is-status-completed'    },
    CANCELLED:          { label: 'Cancelled',          className: 'is-status-cancelled'    },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.REQUESTED;
    return <span className={`z-badge ${cfg.className}`}>{cfg.label}</span>;
}

function formatDate(dt) {
    return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(dt) {
    return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function getDuration(start, end) {
    const mins = Math.round((new Date(end) - new Date(start)) / 60000);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}
function isToday(dt) {
    return new Date(dt).toDateString() === new Date().toDateString();
}

export default function Cases() {
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getBookings()
            .then((res) => setBookings(Array.isArray(res.data) ? res.data : []))
            .catch(() => setBookings([]))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="z-page-loader">
                <Loader2 />
                <span>Loading bookings…</span>
            </div>
        );
    }

    return (
        <div className="z-page">
            <header className="z-page-header">
                <div>
                    <h1 className="z-page-title">Cases</h1>
                    <p className="z-page-subtitle">Manage OT bookings and surgical cases</p>
                </div>
                <div className="z-page-actions">
                    <button onClick={() => navigate('/cases/new')} className="z-btn-primary">
                        <Plus className="u-w-4 u-h-4" />
                        New Booking
                    </button>
                </div>
            </header>

            <div className="z-card is-no-padding">
                <div className="z-card-header">
                    <span className="z-card-header-title">All Bookings</span>
                    <span className="u-text-xs u-text-muted u-tabular">{bookings.length} total</span>
                </div>

                {bookings.length === 0 ? (
                    <div className="z-empty">
                        <div className="z-empty-icon"><CheckCircle2 /></div>
                        <p className="z-empty-title">No bookings yet</p>
                        <p className="z-empty-description">Create the first booking to get started.</p>
                        <button onClick={() => navigate('/cases/new')} className="z-btn-primary">
                            <Plus className="u-w-4 u-h-4" />
                            New Booking
                        </button>
                    </div>
                ) : (
                    <div className="u-overflow-x-auto">
                        <table className="z-table">
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th>Procedure</th>
                                    <th>Room</th>
                                    <th>Surgeon</th>
                                    <th>Schedule</th>
                                    <th>Status</th>
                                    <th className="col-actions">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.map((booking) => (
                                    <BookingRow
                                        key={booking.id}
                                        booking={booking}
                                        onClick={() => navigate(`/cases/${booking.id}`)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function BookingRow({ booking, onClick }) {
    return (
        <tr className="is-clickable" onClick={onClick}>
            <td>
                <span className="z-table-cell-title">{booking.patientName}</span>
                {booking.patientMrn && (
                    <span className="z-table-cell-sub">MRN: {booking.patientMrn}</span>
                )}
            </td>
            <td>
                <span className="z-table-cell-title u-font-medium">{booking.procedureName}</span>
                {booking.procedureCharge != null && (
                    <span className="z-table-cell-sub">
                        ₹{Number(booking.procedureCharge).toLocaleString('en-IN')}
                    </span>
                )}
            </td>
            <td>{booking.roomName}</td>
            <td>{booking.surgeonName}</td>
            <td>
                <div className="u-flex u-items-center u-gap-2">
                    <span>{formatDate(booking.scheduledStart)}</span>
                    {isToday(booking.scheduledStart) && (
                        <span className="z-badge is-soft is-info">Today</span>
                    )}
                </div>
                <span className="z-table-cell-sub u-tabular">
                    {formatTime(booking.scheduledStart)} – {formatTime(booking.scheduledEnd)}
                    <span className="u-text-subtle"> ({getDuration(booking.scheduledStart, booking.scheduledEnd)})</span>
                </span>
            </td>
            <td>
                <StatusBadge status={booking.status} />
            </td>
            <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClick} className="z-btn-ghost is-sm">View</button>
            </td>
        </tr>
    );
}
