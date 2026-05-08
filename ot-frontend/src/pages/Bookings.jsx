import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBookings, createBooking } from '../api/client';
import { Plus } from 'lucide-react';

export default function Bookings() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchBookings();
    }, []);

    const fetchBookings = async () => {
        try {
            const res = await getBookings({});
            setBookings(res.data);
        } catch (error) {
            console.error('Error fetching bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            REQUESTED: 'bg-gray-200 text-gray-900',
            CONFIRMED: 'bg-blue-200 text-blue-900 font-semibold',
            IN_PROGRESS: 'bg-green-300 text-green-900 font-semibold',
            COMPLETED: 'bg-slate-200 text-slate-900',
            CANCELLED: 'bg-red-200 text-red-900',
        };
        return colors[status] || 'bg-gray-200 text-gray-900';
    };

    if (loading) return <div className="p-8 text-black">Loading...</div>;

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-black">Bookings</h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                >
                    <Plus size={20} />
                    New Booking
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b bg-gray-50">
                            <th className="px-6 py-3 text-left font-semibold text-black">Patient</th>
                            <th className="px-6 py-3 text-left font-semibold text-black">Procedure</th>
                            <th className="px-6 py-3 text-left font-semibold text-black">Room</th>
                            <th className="px-6 py-3 text-left font-semibold text-black">Surgeon</th>
                            <th className="px-6 py-3 text-left font-semibold text-black">Scheduled</th>
                            <th className="px-6 py-3 text-left font-semibold text-black">Status</th>
                            <th className="px-6 py-3 text-left font-semibold text-black">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bookings.map(booking => (
                            <tr key={booking.id} className="border-b hover:bg-gray-50">
                                <td className="px-6 py-3 text-sm text-black">{booking.patientName}</td>
                                <td className="px-6 py-3 text-sm text-black">{booking.procedureName}</td>
                                <td className="px-6 py-3 text-sm text-black">{booking.roomName}</td>
                                <td className="px-6 py-3 text-sm text-black">{booking.surgeonName}</td>
                                <td className="px-6 py-3 text-sm text-black">
                                    {new Date(booking.scheduledStart).toLocaleString()}
                                </td>
                                <td className="px-6 py-3">
                                    <span className={`px-3 py-1 rounded text-xs font-semibold ${getStatusColor(booking.status)}`}>
                                        {booking.status}
                                    </span>
                                </td>
                                <td className="px-6 py-3">
                                    <button
                                        onClick={() => navigate(`/bookings/${booking.id}`)}
                                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    >
                                        View
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <CreateBookingModal
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        setShowModal(false);
                        fetchBookings();
                    }}
                />
            )}
        </div>
    );
}

function CreateBookingModal({ onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        patientId: '',
        patientName: '',
        patientMrn: '',
        procedureName: '',
        roomId: '',
        roomName: '',
        surgeonId: '',
        surgeonName: '',
        scheduledStart: '',
        scheduledEnd: '',
        notes: '',
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await createBooking(formData);
            onSuccess();
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to create booking');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-black">Create Booking</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="Patient Name"
                            value={formData.patientName}
                            onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                            className="border rounded px-3 py-2"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Patient MRN"
                            value={formData.patientMrn}
                            onChange={(e) => setFormData({ ...formData, patientMrn: e.target.value })}
                            className="border rounded px-3 py-2"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Procedure Name"
                            value={formData.procedureName}
                            onChange={(e) => setFormData({ ...formData, procedureName: e.target.value })}
                            className="border rounded px-3 py-2"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Room Name"
                            value={formData.roomName}
                            onChange={(e) => setFormData({ ...formData, roomName: e.target.value })}
                            className="border rounded px-3 py-2"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Surgeon Name"
                            value={formData.surgeonName}
                            onChange={(e) => setFormData({ ...formData, surgeonName: e.target.value })}
                            className="border rounded px-3 py-2"
                            required
                        />
                        <input
                            type="datetime-local"
                            value={formData.scheduledStart}
                            onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                            className="border rounded px-3 py-2"
                            required
                        />
                        <input
                            type="datetime-local"
                            value={formData.scheduledEnd}
                            onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                            className="border rounded px-3 py-2"
                            required
                        />
                        <textarea
                            placeholder="Notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="border rounded px-3 py-2 col-span-2"
                            rows="2"
                        />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Booking'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded-lg transition"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
