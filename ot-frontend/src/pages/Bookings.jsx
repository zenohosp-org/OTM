import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBookings, createBooking } from '../api/client';
import { Plus, Loader2, X } from 'lucide-react';

const STATUS_CONFIG = {
    REQUESTED:          { label: 'Requested',          className: 'is-status-requested'    },
    CONFIRMED:          { label: 'Confirmed',          className: 'is-status-confirmed'    },
    IN_PROGRESS:        { label: 'In Progress',        className: 'is-status-in-progress'  },
    PENDING_SANITATION: { label: 'Pending Sanitation', className: 'is-status-sanitation'   },
    COMPLETED:          { label: 'Completed',          className: 'is-status-completed'    },
    CANCELLED:          { label: 'Cancelled',          className: 'is-status-cancelled'    },
};

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

    if (loading) return (
        <div className="z-page-loader">
            <Loader2 />
            <span>Loading bookings…</span>
        </div>
    );

    return (
        <div className="z-page">
            <header className="z-page-header">
                <div>
                    <h1 className="z-page-title">Bookings</h1>
                    <p className="z-page-subtitle">Quick booking management</p>
                </div>
                <div className="z-page-actions">
                    <button onClick={() => setShowModal(true)} className="z-btn-primary">
                        <Plus className="u-w-4 u-h-4" />
                        New Booking
                    </button>
                </div>
            </header>

            <div className="z-card is-no-padding">
                <div className="u-overflow-x-auto">
                    <table className="z-table">
                        <thead>
                            <tr>
                                <th>Patient</th>
                                <th>Procedure</th>
                                <th>Room</th>
                                <th>Surgeon</th>
                                <th>Scheduled</th>
                                <th>Status</th>
                                <th className="col-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bookings.map(booking => {
                                const cfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.REQUESTED;
                                return (
                                    <tr key={booking.id}>
                                        <td>{booking.patientName}</td>
                                        <td>{booking.procedureName}</td>
                                        <td>{booking.roomName}</td>
                                        <td>{booking.surgeonName}</td>
                                        <td>{new Date(booking.scheduledStart).toLocaleString()}</td>
                                        <td>
                                            <span className={`z-badge ${cfg.className}`}>{cfg.label}</span>
                                        </td>
                                        <td className="col-actions">
                                            <button
                                                onClick={() => navigate(`/bookings/${booking.id}`)}
                                                className="z-btn-ghost is-sm"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
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
        <div className="z-modal-overlay" onClick={onClose}>
            <div className="z-modal is-lg" onClick={(e) => e.stopPropagation()}>
                <div className="z-modal-header">
                    <h2 className="z-modal-title">Create Booking</h2>
                    <button onClick={onClose} className="z-modal-close" aria-label="Close"><X /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="z-modal-body">
                        {error && <div className="z-alert is-danger u-mb-4">{error}</div>}

                        <div className="z-form-grid">
                            <div className="z-field">
                                <label className="z-label">Patient Name</label>
                                <input
                                    type="text"
                                    className="z-input"
                                    value={formData.patientName}
                                    onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="z-field">
                                <label className="z-label">Patient MRN</label>
                                <input
                                    type="text"
                                    className="z-input"
                                    value={formData.patientMrn}
                                    onChange={(e) => setFormData({ ...formData, patientMrn: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="z-field">
                                <label className="z-label">Procedure</label>
                                <input
                                    type="text"
                                    className="z-input"
                                    value={formData.procedureName}
                                    onChange={(e) => setFormData({ ...formData, procedureName: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="z-field">
                                <label className="z-label">Room</label>
                                <input
                                    type="text"
                                    className="z-input"
                                    value={formData.roomName}
                                    onChange={(e) => setFormData({ ...formData, roomName: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="z-field">
                                <label className="z-label">Surgeon</label>
                                <input
                                    type="text"
                                    className="z-input"
                                    value={formData.surgeonName}
                                    onChange={(e) => setFormData({ ...formData, surgeonName: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="z-field">
                                <label className="z-label">Start Time</label>
                                <input
                                    type="datetime-local"
                                    className="z-input"
                                    value={formData.scheduledStart}
                                    onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="z-field">
                                <label className="z-label">End Time</label>
                                <input
                                    type="datetime-local"
                                    className="z-input"
                                    value={formData.scheduledEnd}
                                    onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="z-field z-field-full">
                                <label className="z-label">Notes</label>
                                <textarea
                                    className="z-textarea"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows="2"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="z-modal-footer">
                        <button type="button" onClick={onClose} className="z-btn-cancel">Cancel</button>
                        <button type="submit" disabled={loading} className={`z-btn-primary${loading ? ' z-btn-loading' : ''}`}>
                            {loading ? 'Creating…' : 'Create Booking'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
