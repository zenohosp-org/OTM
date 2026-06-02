import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getBookings, getConsumption } from '../api/client';
import {
    ArrowLeft, Loader2, ChevronDown, ChevronUp, Calendar, Clock, ListChecks,
} from 'lucide-react';

function generateTimeSlots() {
    const slots = [];
    for (let i = 8; i < 18; i++) {
        slots.push(`${String(i).padStart(2, '0')}:00`);
    }
    return slots;
}

function isTimeInRange(timeSlot, start, end) {
    const [hour] = timeSlot.split(':').map(Number);
    const startHour = new Date(start).getHours();
    const endHour = new Date(end).getHours();
    return hour >= startHour && hour < endHour;
}

const STATUS_CLASS = {
    REQUESTED:          'status-requested',
    CONFIRMED:          'status-confirmed',
    IN_PROGRESS:        'status-in-progress',
    PENDING_SANITATION: 'status-sanitation',
    COMPLETED:          'status-completed',
    CANCELLED:          'status-cancelled',
};

function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function formatTime(dateString) {
    return new Date(dateString).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(startStr, endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const mins = Math.round((end - start) / 60000);
    const hours = Math.floor(mins / 60);
    const remainder = mins % 60;
    if (hours > 0) return `${hours}h ${remainder}m`;
    return `${mins}m`;
}

export default function RoomDetail() {
    const navigate = useNavigate();
    const { roomId } = useParams();
    const location = useLocation();
    const room = location.state?.room;

    const [tab, setTab] = useState('slots');
    const [allBookings, setAllBookings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [completedBookings, setCompletedBookings] = useState([]);
    const [completedLoading, setCompletedLoading] = useState(false);
    const [expandedCaseId, setExpandedCaseId] = useState(null);
    const [caseConsumption, setCaseConsumption] = useState({});
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        setLoading(true);
        getBookings({ roomId })
            .then((res) => setAllBookings(Array.isArray(res.data) ? res.data : []))
            .catch(() => setAllBookings([]))
            .finally(() => setLoading(false));
    }, [roomId]);

    const loadCompletedCases = () => {
        if (completedBookings.length > 0) return;
        setCompletedLoading(true);
        getBookings({ roomId, status: 'COMPLETED' })
            .then((res) => {
                const cases = Array.isArray(res.data) ? res.data : [];
                setCompletedBookings(cases.sort((a, b) => new Date(b.scheduledStart) - new Date(a.scheduledStart)));
            })
            .catch(() => setCompletedBookings([]))
            .finally(() => setCompletedLoading(false));
    };

    const loadConsumption = (bookingId) => {
        if (caseConsumption[bookingId]) {
            setExpandedCaseId(expandedCaseId === bookingId ? null : bookingId);
            return;
        }
        getConsumption(bookingId)
            .then((res) => {
                setCaseConsumption((prev) => ({
                    ...prev,
                    [bookingId]: Array.isArray(res.data) ? res.data : [],
                }));
                setExpandedCaseId(bookingId);
            })
            .catch(() => {
                setCaseConsumption((prev) => ({ ...prev, [bookingId]: [] }));
                setExpandedCaseId(bookingId);
            });
    };

    const today = new Date().toISOString().split('T')[0];
    const todayBookings = allBookings.filter((b) => b.scheduledStart.split('T')[0] === today);
    const upcomingBookings = allBookings
        .filter((b) => new Date(b.scheduledStart) > new Date() && b.status !== 'CANCELLED')
        .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart))
        .slice(0, 5);

    const selectedDateBookings = allBookings.filter((b) => b.scheduledStart.split('T')[0] === selectedDate);
    const timeSlots = generateTimeSlots();

    return (
        <div className="z-page">
            <header className="z-page-header">
                <div className="z-page-title-group">
                    <button onClick={() => navigate('/schedules')} className="z-back-btn" aria-label="Back">
                        <ArrowLeft />
                    </button>
                    <div>
                        <h1 className="z-page-title">{room?.roomNumber || roomId}</h1>
                        {room && <p className="z-page-subtitle">{room.roomType}</p>}
                    </div>
                </div>
            </header>

            <div className="z-tabs-pill">
                <button
                    onClick={() => setTab('slots')}
                    className={`z-tab-pill${tab === 'slots' ? ' is-active' : ''}`}
                >
                    <Clock className="u-w-4 u-h-4" /> Current Slots
                </button>
                <button
                    onClick={() => setTab('timeline')}
                    className={`z-tab-pill${tab === 'timeline' ? ' is-active' : ''}`}
                >
                    <Calendar className="u-w-4 u-h-4" /> Timeline
                </button>
                <button
                    onClick={() => { setTab('cases'); loadCompletedCases(); }}
                    className={`z-tab-pill${tab === 'cases' ? ' is-active' : ''}`}
                >
                    <ListChecks className="u-w-4 u-h-4" /> Previous Cases
                </button>
            </div>

            {tab === 'slots' && (
                <CurrentSlots bookings={todayBookings} upcomingBookings={upcomingBookings} loading={loading} />
            )}
            {tab === 'timeline' && (
                <TimelineTab
                    roomId={roomId}
                    roomNumber={room?.roomNumber}
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                    bookings={selectedDateBookings}
                    allBookings={upcomingBookings}
                    loading={loading}
                    timeSlots={timeSlots}
                />
            )}
            {tab === 'cases' && (
                <PreviousCases
                    cases={completedBookings}
                    loading={completedLoading}
                    expandedId={expandedCaseId}
                    onToggleExpand={loadConsumption}
                    consumption={caseConsumption}
                />
            )}
        </div>
    );
}

function CurrentSlots({ bookings, upcomingBookings, loading }) {
    if (loading) return (
        <div className="z-page-loader">
            <Loader2 /><span>Loading slots…</span>
        </div>
    );

    return (
        <div className="u-stack-lg">
            <div>
                <h2 className="z-section-title u-mb-3">Today's Slots</h2>
                {bookings.length > 0 ? (
                    <div className="u-grid u-grid-cols-1 md:u-grid-cols-2 u-gap-3">
                        {bookings.map((booking) => (
                            <div key={booking.id} className="z-card">
                                <p className="u-font-bold u-text-strong u-tabular">
                                    {formatTime(booking.scheduledStart)} – {formatTime(booking.scheduledEnd)}
                                </p>
                                <div className="u-mt-2 u-text-sm u-stack-sm">
                                    <p><span className="u-font-medium">Patient:</span> {booking.patientName} ({booking.patientMrn})</p>
                                    <p><span className="u-font-medium">Surgeon:</span> {booking.surgeonName}</p>
                                    <p><span className="u-font-medium">Procedure:</span> {booking.procedureName}</p>
                                </div>
                                <div className="u-mt-3">
                                    <span className={`z-badge is-status-${(booking.status || '').toLowerCase().replace(/_/g, '-')}`}>
                                        {booking.status.replace(/_/g, ' ')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="u-text-muted">No bookings today</p>
                )}
            </div>

            {upcomingBookings.length > 0 && (
                <div>
                    <h2 className="z-section-title u-mb-3">Upcoming Slots</h2>
                    <div className="u-stack-sm">
                        {upcomingBookings.map((booking) => (
                            <div key={booking.id} className="z-card is-padded-sm">
                                <div className="u-flex u-justify-between u-items-start">
                                    <div>
                                        <p className="u-font-bold u-text-strong u-tabular">{formatDateTime(booking.scheduledStart)}</p>
                                        <p className="u-text-sm u-text-muted u-mt-1">{booking.patientName} — {booking.procedureName}</p>
                                        <p className="u-text-sm u-text-muted">Surgeon: {booking.surgeonName}</p>
                                    </div>
                                    <span className={`z-badge is-status-${(booking.status || '').toLowerCase().replace(/_/g, '-')}`}>
                                        {booking.status.replace(/_/g, ' ')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function TimelineTab({ roomId, roomNumber, selectedDate, onDateChange, bookings, allBookings, loading, timeSlots }) {
    if (loading) return (
        <div className="z-page-loader">
            <Loader2 /><span>Loading timeline…</span>
        </div>
    );

    return (
        <div className="u-stack-lg">
            <div className="z-field date-filter-field">
                <label className="z-label">Select Date</label>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => onDateChange(e.target.value)}
                    className="z-input"
                />
            </div>

            <div className="schedule-timeline">
                <table className="schedule-timeline-table">
                    <thead>
                        <tr>
                            <th className="time-col">Time</th>
                            <th>Room {roomNumber || roomId}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map((slot, i) => {
                            const booking = bookings.find(
                                (b) => isTimeInRange(slot, b.scheduledStart, b.scheduledEnd)
                            );
                            return (
                                <tr key={i}>
                                    <td className="time-col">{slot}</td>
                                    <td>
                                        {booking && (
                                            <div className={`schedule-cell ${STATUS_CLASS[booking.status] || 'status-requested'}`}>
                                                <span className="schedule-cell-title">{booking.procedureName}</span>
                                                <span className="schedule-cell-sub">{booking.surgeonName}</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {allBookings.length > 0 && (
                <div>
                    <h3 className="z-section-title u-mb-3">Upcoming Bookings</h3>
                    <div className="u-stack-sm">
                        {allBookings.map((booking) => (
                            <div key={booking.id} className="z-card is-padded-sm">
                                <p className="u-font-medium u-text-strong">{formatDateTime(booking.scheduledStart)}</p>
                                <p className="u-text-sm u-text-muted u-mt-1">{booking.patientName} — {booking.procedureName}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function PreviousCases({ cases, loading, expandedId, onToggleExpand, consumption }) {
    if (loading) return (
        <div className="z-page-loader">
            <Loader2 /><span>Loading cases…</span>
        </div>
    );

    if (cases.length === 0) {
        return (
            <div className="z-empty">
                <div className="z-empty-icon"><ListChecks /></div>
                <p className="z-empty-title">No completed cases found</p>
            </div>
        );
    }

    return (
        <div className="u-stack-sm">
            {cases.map((caseItem) => (
                <div key={caseItem.id} className="z-card is-no-padding">
                    <button
                        type="button"
                        className="u-w-full u-text-left u-p-4 u-bg-transparent u-border-none u-cursor-pointer u-flex u-justify-between u-items-start"
                        onClick={() => onToggleExpand(caseItem.id)}
                    >
                        <div className="u-flex-1 u-text-sm u-stack-sm">
                            <p className="u-font-bold u-text-strong">
                                {caseItem.patientName} ({caseItem.patientMrn})
                            </p>
                            <p className="u-text-muted"><span className="u-font-medium">Surgeon:</span> {caseItem.surgeonName}</p>
                            <p className="u-text-muted"><span className="u-font-medium">Procedure:</span> {caseItem.procedureName}</p>
                            <p className="u-text-muted"><span className="u-font-medium">Date:</span> {formatDateTime(caseItem.scheduledStart)}</p>
                            <p className="u-text-muted">
                                <span className="u-font-medium">Duration:</span>{' '}
                                {formatDuration(
                                    caseItem.actualStart || caseItem.scheduledStart,
                                    caseItem.actualEnd || caseItem.scheduledEnd
                                )}
                            </p>
                        </div>
                        {expandedId === caseItem.id ? <ChevronUp /> : <ChevronDown />}
                    </button>

                    {expandedId === caseItem.id && (
                        <div className="u-bg-gray-50 u-border-t u-p-4">
                            {consumption[caseItem.id] && consumption[caseItem.id].length > 0 ? (
                                <table className="z-table">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th>Type</th>
                                            <th className="u-text-center">Qty</th>
                                            <th className="u-text-right">Unit Price</th>
                                            <th className="u-text-center">Billable</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {consumption[caseItem.id].map((item) => (
                                            <tr key={item.id}>
                                                <td>{item.itemName}</td>
                                                <td className="u-text-muted">{item.itemType}</td>
                                                <td className="u-text-center">{item.quantity}</td>
                                                <td className="u-text-right u-tabular">
                                                    ₹{item.unitPrice ? item.unitPrice.toFixed(2) : '0.00'}
                                                </td>
                                                <td className="u-text-center">
                                                    {item.billable ? (
                                                        <span className="z-badge is-soft is-success">Yes</span>
                                                    ) : (
                                                        <span className="z-badge is-soft is-neutral">No</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="u-text-sm u-text-muted">No consumption items recorded</p>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
