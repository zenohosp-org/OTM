import { useEffect, useMemo, useState } from 'react';
import { getBookings, getHmsRooms } from '../api/client';
import { Loader2, LayoutGrid, Calendar, ChevronRight } from 'lucide-react';

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

export default function Schedules() {
    const [tab, setTab] = useState('rooms');
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [loadingBookings, setLoadingBookings] = useState(true);

    useEffect(() => {
        getHmsRooms()
            .then((res) => setRooms(Array.isArray(res.data) ? res.data : []))
            .catch(() => setRooms([]))
            .finally(() => setLoadingRooms(false));
    }, []);

    useEffect(() => {
        const fetch = () => {
            const today = new Date().toISOString().split('T')[0];
            getBookings({ date: today })
                .then((res) => setBookings(Array.isArray(res.data) ? res.data : []))
                .catch(() => setBookings([]))
                .finally(() => setLoadingBookings(false));
        };
        fetch();
        const interval = setInterval(fetch, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleViewTimeline = (room) => {
        setSelectedRoom(room);
        setTab('timeline');
    };

    const handleClearRoom = () => {
        setSelectedRoom(null);
    };

    const timelineColumns = useMemo(() => {
        if (selectedRoom) return [selectedRoom];
        return rooms.length
            ? rooms
            : [...new Set(bookings.map((b) => b.roomId))].sort().map((id) => ({ id, roomNumber: id }));
    }, [rooms, bookings, selectedRoom]);

    const timeSlots = generateTimeSlots();

    return (
        <div className="z-page">
            <header className="z-page-header">
                <div>
                    <h1 className="z-page-title">Schedules</h1>
                    <p className="z-page-subtitle">Today's OT room timeline and availability</p>
                </div>
            </header>

            <div className="z-tabs-pill">
                <button
                    onClick={() => setTab('rooms')}
                    className={`z-tab-pill${tab === 'rooms' ? ' is-active' : ''}`}
                >
                    <LayoutGrid className="u-w-4 u-h-4" />
                    Room List
                </button>
                <button
                    onClick={() => setTab('timeline')}
                    className={`z-tab-pill${tab === 'timeline' ? ' is-active' : ''}`}
                >
                    <Calendar className="u-w-4 u-h-4" />
                    Timeline
                </button>
            </div>

            {tab === 'rooms' && (
                <RoomList rooms={rooms} loading={loadingRooms} onViewTimeline={handleViewTimeline} />
            )}

            {tab === 'timeline' && (
                <Timeline
                    columns={timelineColumns}
                    bookings={bookings}
                    loading={loadingBookings}
                    selectedRoom={selectedRoom}
                    timeSlots={timeSlots}
                    onClearRoom={handleClearRoom}
                />
            )}
        </div>
    );
}

function RoomList({ rooms, loading, onViewTimeline }) {
    if (loading) {
        return (
            <div className="z-page-loader">
                <Loader2 />
                <span>Loading rooms…</span>
            </div>
        );
    }

    if (rooms.length === 0) {
        return (
            <div className="z-card">
                <div className="z-empty">
                    <div className="z-empty-icon"><LayoutGrid /></div>
                    <p className="z-empty-title">No OT rooms found</p>
                    <p className="z-empty-description">HMS rooms will appear here once available.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="z-card is-no-padding">
            <div className="u-overflow-x-auto">
                <table className="z-table">
                    <thead>
                        <tr>
                            <th>Room</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th className="col-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rooms.map((room) => (
                            <tr key={room.id}>
                                <td><span className="z-table-cell-title">{room.roomNumber}</span></td>
                                <td>{room.roomType || '—'}</td>
                                <td>
                                    <span className="z-badge is-soft is-neutral">{room.status || 'Active'}</span>
                                </td>
                                <td className="col-actions">
                                    <button onClick={() => onViewTimeline(room)} className="z-btn-ghost is-sm">
                                        Timeline <ChevronRight className="u-w-4 u-h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Timeline({ columns, bookings, loading, selectedRoom, timeSlots, onClearRoom }) {
    if (loading) {
        return (
            <div className="z-page-loader">
                <Loader2 />
                <span>Loading timeline…</span>
            </div>
        );
    }

    return (
        <div className="u-stack-md">
            {selectedRoom && (
                <div className="u-flex u-items-center u-gap-3">
                    <span className="u-font-bold u-text-strong">Room: {selectedRoom.roomNumber}</span>
                    <button onClick={onClearRoom} className="z-btn-ghost is-sm">
                        Show all rooms
                    </button>
                </div>
            )}

            <div className="schedule-timeline">
                <table className="schedule-timeline-table">
                    <thead>
                        <tr>
                            <th className="time-col">Time</th>
                            {columns.map((room) => (
                                <th key={room.id}>Room {room.roomNumber || room.id}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map((slot, i) => (
                            <tr key={i}>
                                <td className="time-col">{slot}</td>
                                {columns.map((room) => {
                                    const booking = bookings.find(
                                        (b) =>
                                            b.roomId === room.id &&
                                            isTimeInRange(slot, b.scheduledStart, b.scheduledEnd)
                                    );
                                    return (
                                        <td key={`${room.id}-${i}`}>
                                            {booking && (
                                                <div className={`schedule-cell ${STATUS_CLASS[booking.status] || 'status-requested'}`}>
                                                    <span className="schedule-cell-title">{booking.procedureName}</span>
                                                    <span className="schedule-cell-sub">{booking.surgeonName}</span>
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
