import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getBookings, getConsumption } from '../api/client';

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

const STATUS_COLORS = {
    REQUESTED: 'bg-gray-200',
    CONFIRMED: 'bg-blue-200',
    IN_PROGRESS: 'bg-green-200 animate-pulse',
    PENDING_SANITATION: 'bg-amber-200',
    COMPLETED: 'bg-slate-200',
    CANCELLED: 'bg-red-200',
};

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDuration(startStr, endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const mins = Math.round((end - start) / 60000);
    const hours = Math.floor(mins / 60);
    const remainder = mins % 60;
    if (hours > 0) {
        return `${hours}h ${remainder}m`;
    }
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
        const today = new Date().toISOString().split('T')[0];
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
                setCaseConsumption((prev) => ({
                    ...prev,
                    [bookingId]: [],
                }));
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
        <div className="p-8">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/schedules')}
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                    ← Back to Schedules
                </button>
                <h1 className="text-3xl font-bold text-black">
                    {room?.roomNumber || roomId}
                </h1>
                {room && <span className="text-gray-600 text-sm">{room.roomType}</span>}
            </div>

            <div className="flex gap-2 mb-6 border-b border-gray-200">
                <TabButton label="Current Slots" active={tab === 'slots'} onClick={() => setTab('slots')} />
                <TabButton label="Timeline" active={tab === 'timeline'} onClick={() => setTab('timeline')} />
                <TabButton
                    label="Previous Cases"
                    active={tab === 'cases'}
                    onClick={() => {
                        setTab('cases');
                        loadCompletedCases();
                    }}
                />
            </div>

            {tab === 'slots' && <CurrentSlots bookings={todayBookings} upcomingBookings={upcomingBookings} loading={loading} />}

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

function TabButton({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`px-5 py-2 font-medium text-sm border-b-2 transition -mb-px ${
                active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-black'
            }`}
        >
            {label}
        </button>
    );
}

function CurrentSlots({ bookings, upcomingBookings, loading }) {
    if (loading) return <div className="text-black">Loading slots...</div>;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-semibold text-black mb-4">Today's Slots</h2>
                {bookings.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {bookings.map((booking) => (
                            <div key={booking.id} className={`p-4 rounded-lg text-black ${STATUS_COLORS[booking.status] || 'bg-gray-100'}`}>
                                <div className="font-semibold">{formatTime(booking.scheduledStart)} - {formatTime(booking.scheduledEnd)}</div>
                                <div className="text-sm mt-2">
                                    <div><span className="font-medium">Patient:</span> {booking.patientName} ({booking.patientMrn})</div>
                                    <div><span className="font-medium">Surgeon:</span> {booking.surgeonName}</div>
                                    <div><span className="font-medium">Procedure:</span> {booking.procedureName}</div>
                                    <div className="text-xs mt-2 opacity-75">Status: {booking.status}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-gray-600">No bookings today</div>
                )}
            </div>

            {upcomingBookings.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-black mb-4">Upcoming Slots</h2>
                    <div className="space-y-3">
                        {upcomingBookings.map((booking) => (
                            <div key={booking.id} className="border border-gray-200 rounded-lg p-4 text-black hover:bg-gray-50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-semibold">{formatDateTime(booking.scheduledStart)}</div>
                                        <div className="text-sm text-gray-600 mt-1">{booking.patientName} - {booking.procedureName}</div>
                                        <div className="text-sm text-gray-600">Surgeon: {booking.surgeonName}</div>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[booking.status] || 'bg-gray-200'} text-black`}>
                                        {booking.status}
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
    if (loading) return <div className="text-black">Loading timeline...</div>;

    return (
        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-black mb-2">Select Date</label>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => onDateChange(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-black"
                />
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="w-full">
                    <thead>
                        <tr className="border-b bg-gray-50">
                            <th className="px-4 py-3 text-left font-semibold w-32 text-black">Time</th>
                            <th className="px-4 py-3 text-left font-semibold text-black">
                                Room {roomNumber || roomId}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map((slot, i) => {
                            const booking = bookings.find(
                                (b) => isTimeInRange(slot, b.scheduledStart, b.scheduledEnd)
                            );
                            return (
                                <tr key={i} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-2 font-medium text-sm bg-gray-50 text-black">{slot}</td>
                                    <td className="px-4 py-2">
                                        {booking && (
                                            <div className={`p-2 rounded text-sm text-black ${STATUS_COLORS[booking.status] || 'bg-gray-100'}`}>
                                                <div className="font-semibold">{booking.procedureName}</div>
                                                <div className="text-xs">{booking.surgeonName}</div>
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
                    <h3 className="font-semibold text-black mb-3">Upcoming Bookings</h3>
                    <div className="space-y-2">
                        {allBookings.map((booking) => (
                            <div key={booking.id} className="border border-gray-200 rounded p-3 text-sm text-black">
                                <div className="font-medium">{formatDateTime(booking.scheduledStart)}</div>
                                <div className="text-gray-600">{booking.patientName} - {booking.procedureName}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function PreviousCases({ cases, loading, expandedId, onToggleExpand, consumption }) {
    if (loading) return <div className="text-black">Loading cases...</div>;

    if (cases.length === 0) {
        return <div className="text-gray-600">No completed cases found</div>;
    }

    return (
        <div className="space-y-3">
            {cases.map((caseItem) => (
                <div key={caseItem.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div
                        className="p-4 bg-white cursor-pointer hover:bg-gray-50"
                        onClick={() => onToggleExpand(caseItem.id)}
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <div className="font-semibold text-black">
                                    {caseItem.patientName} ({caseItem.patientMrn})
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                    <span className="font-medium">Surgeon:</span> {caseItem.surgeonName}
                                </div>
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium">Procedure:</span> {caseItem.procedureName}
                                </div>
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium">Date:</span> {formatDateTime(caseItem.scheduledStart)}
                                </div>
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium">Duration:</span>{' '}
                                    {formatDuration(
                                        caseItem.actualStart || caseItem.scheduledStart,
                                        caseItem.actualEnd || caseItem.scheduledEnd
                                    )}
                                </div>
                            </div>
                            <span className="text-lg text-gray-500">
                                {expandedId === caseItem.id ? '−' : '+'}
                            </span>
                        </div>
                    </div>

                    {expandedId === caseItem.id && (
                        <div className="bg-gray-50 border-t border-gray-200 p-4">
                            {consumption[caseItem.id] && consumption[caseItem.id].length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="px-3 py-2 text-left font-semibold text-black">Item</th>
                                                <th className="px-3 py-2 text-left font-semibold text-black">Type</th>
                                                <th className="px-3 py-2 text-center font-semibold text-black">Qty</th>
                                                <th className="px-3 py-2 text-right font-semibold text-black">Unit Price</th>
                                                <th className="px-3 py-2 text-center font-semibold text-black">Billable</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {consumption[caseItem.id].map((item) => (
                                                <tr key={item.id} className="border-b text-black">
                                                    <td className="px-3 py-2">{item.itemName}</td>
                                                    <td className="px-3 py-2 text-gray-600">{item.itemType}</td>
                                                    <td className="px-3 py-2 text-center">{item.quantity}</td>
                                                    <td className="px-3 py-2 text-right">
                                                        ${item.unitPrice ? item.unitPrice.toFixed(2) : '0.00'}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {item.billable ? 'Yes' : 'No'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-gray-600 text-sm">No consumption items recorded</div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
