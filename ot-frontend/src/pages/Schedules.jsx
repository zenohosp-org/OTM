import { useEffect, useMemo, useState } from 'react';
import { getBookings, getHmsRooms } from '../api/client';

function isOtRoom(room) {
    const roomNumber = (room?.roomNumber || '').toString().toLowerCase();
    const roomCode = (room?.roomCode || '').toString().toLowerCase();
    return roomNumber.includes('ot') || roomCode.includes('ot');
}

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

export default function Schedules() {
    const [tab, setTab] = useState('rooms');
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [loadingBookings, setLoadingBookings] = useState(true);

    useEffect(() => {
        getHmsRooms()
            .then((res) => setRooms(Array.isArray(res.data) ? res.data.filter(isOtRoom) : []))
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
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6 text-black">Schedules</h1>

            <div className="flex gap-2 mb-6 border-b border-gray-200">
                <TabButton label="Room List" active={tab === 'rooms'} onClick={() => setTab('rooms')} />
                <TabButton label="Timeline" active={tab === 'timeline'} onClick={() => setTab('timeline')} />
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

function RoomList({ rooms, loading, onViewTimeline }) {
    if (loading) return <div className="text-black">Loading rooms...</div>;

    return (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b bg-gray-50">
                        <th className="px-6 py-3 text-left font-semibold text-black">Room</th>
                        <th className="px-6 py-3 text-left font-semibold text-black">Type</th>
                        <th className="px-6 py-3 text-left font-semibold text-black">Status</th>
                        <th className="px-6 py-3 text-left font-semibold text-black">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {rooms.map((room) => (
                        <tr key={room.id} className="border-b hover:bg-gray-50">
                            <td className="px-6 py-3 text-sm text-black">{room.roomNumber}</td>
                            <td className="px-6 py-3 text-sm text-black">{room.roomType}</td>
                            <td className="px-6 py-3 text-sm text-black">{room.status}</td>
                            <td className="px-6 py-3 text-sm">
                                <button
                                    onClick={() => onViewTimeline(room)}
                                    className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    View Timeline
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {rooms.length === 0 && (
                <div className="p-6 text-black">No OT rooms found</div>
            )}
        </div>
    );
}

function Timeline({ columns, bookings, loading, selectedRoom, timeSlots, onClearRoom }) {
    if (loading) return <div className="text-black">Loading timeline...</div>;

    return (
        <div>
            {selectedRoom && (
                <div className="flex items-center gap-4 mb-4">
                    <span className="text-black font-semibold">Room: {selectedRoom.roomNumber}</span>
                    <button
                        onClick={onClearRoom}
                        className="text-sm text-blue-600 hover:text-blue-800"
                    >
                        Show all rooms
                    </button>
                </div>
            )}

            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="w-full">
                    <thead>
                        <tr className="border-b bg-gray-50">
                            <th className="px-4 py-3 text-left font-semibold w-32 text-black">Time</th>
                            {columns.map((room) => (
                                <th key={room.id} className="px-4 py-3 text-left font-semibold border-l text-black">
                                    Room {room.roomNumber || room.id}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map((slot, i) => (
                            <tr key={i} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-2 font-medium text-sm bg-gray-50 text-black">{slot}</td>
                                {columns.map((room) => {
                                    const booking = bookings.find(
                                        (b) =>
                                            b.roomId === room.id &&
                                            isTimeInRange(slot, b.scheduledStart, b.scheduledEnd)
                                    );
                                    return (
                                        <td key={`${room.id}-${i}`} className="px-4 py-2 border-l">
                                            {booking && (
                                                <div className={`p-2 rounded text-sm text-black ${STATUS_COLORS[booking.status] || 'bg-gray-100'}`}>
                                                    <div className="font-semibold">{booking.procedureName}</div>
                                                    <div className="text-xs">{booking.surgeonName}</div>
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
