import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBookings } from '../api/client';
import { Plus, CheckCircle2, Loader2 } from 'lucide-react';

const STATUS_CONFIG = {
    REQUESTED:          { label: 'Requested',         classes: 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30' },
    CONFIRMED:          { label: 'Confirmed',         classes: 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30' },
    IN_PROGRESS:        { label: 'In Progress',       classes: 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30' },
    PENDING_SANITATION: { label: 'Pending Sanitation', classes: 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30' },
    COMPLETED:          { label: 'Completed',         classes: 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30' },
    CANCELLED:          { label: 'Cancelled',         classes: 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30' },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.REQUESTED;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.classes}`}>
            {cfg.label}
        </span>
    );
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

    const fetchBookings = () => {
        getBookings()
            .then((res) => setBookings(Array.isArray(res.data) ? res.data : []))
            .catch(() => setBookings([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchBookings(); }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] gap-2 text-slate-500 dark:text-[#888888]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading bookings…</span>
            </div>
        );
    }

    return (
        <div className="max-w-8xl space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cases</h1>
                    <p className="text-sm text-slate-500 dark:text-[#888888] mt-0.5">Manage OT bookings and surgical cases</p>
                </div>
                <button onClick={() => navigate('/cases/new')} className="btn-primary">
                    <Plus className="w-4 h-4" />
                    New Booking
                </button>
            </div>

            {/* All bookings */}
            <div className="rounded-lg bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e] flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-[#cccccc]">All Bookings</h2>
                    <span className="text-xs text-slate-400 dark:text-[#666666]">{bookings.length} total</span>
                </div>

                {bookings.length === 0 ? (
                    <div className="py-20 text-center">
                        <CheckCircle2 className="w-10 h-10 mx-auto text-slate-200 dark:text-[#2a2a2a] mb-3" />
                        <p className="text-slate-500 dark:text-[#888888] text-sm">No bookings yet</p>
                        <button
                            onClick={() => navigate('/cases/new')}
                            className="mt-3 text-slate-700 dark:text-[#cccccc] hover:text-slate-900 dark:hover:text-white text-sm font-semibold"
                        >
                            Create the first booking →
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-[#0a0a0a] text-left text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wide">
                                    <th className="px-6 py-3">Patient</th>
                                    <th className="px-6 py-3">Procedure</th>
                                    <th className="px-6 py-3">Room</th>
                                    <th className="px-6 py-3">Surgeon</th>
                                    <th className="px-6 py-3">Schedule</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-[#1e1e1e]">
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
        <tr
            className="hover:bg-slate-50 dark:hover:bg-[#161616] cursor-pointer transition-colors"
            onClick={onClick}
        >
            <td className="px-6 py-4">
                <p className="font-semibold text-slate-900 dark:text-white">{booking.patientName}</p>
                {booking.patientMrn && (
                    <p className="text-xs text-slate-500 dark:text-[#888888] mt-0.5">MRN: {booking.patientMrn}</p>
                )}
            </td>
            <td className="px-6 py-4">
                <p className="text-slate-800 dark:text-[#dddddd]">{booking.procedureName}</p>
                {booking.procedureCharge && (
                    <p className="text-xs text-slate-500 dark:text-[#888888] mt-0.5">
                        ₹{Number(booking.procedureCharge).toLocaleString('en-IN')}
                    </p>
                )}
            </td>
            <td className="px-6 py-4 text-slate-700 dark:text-[#cccccc]">{booking.roomName}</td>
            <td className="px-6 py-4 text-slate-700 dark:text-[#cccccc]">{booking.surgeonName}</td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-1.5">
                    <p className="text-slate-800 dark:text-[#dddddd]">{formatDate(booking.scheduledStart)}</p>
                    {isToday(booking.scheduledStart) && (
                        <span className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 text-xs font-semibold px-1.5 py-0.5 rounded">
                            Today
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-500 dark:text-[#888888] mt-0.5">
                    {formatTime(booking.scheduledStart)} – {formatTime(booking.scheduledEnd)}
                    <span className="ml-1 text-slate-400 dark:text-[#666666]">
                        ({getDuration(booking.scheduledStart, booking.scheduledEnd)})
                    </span>
                </p>
            </td>
            <td className="px-6 py-4">
                <StatusBadge status={booking.status} />
            </td>
            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                <button
                    onClick={onClick}
                    className="text-slate-700 dark:text-[#cccccc] hover:text-slate-900 dark:hover:text-white font-semibold text-sm transition-colors"
                >
                    View
                </button>
            </td>
        </tr>
    );
}
