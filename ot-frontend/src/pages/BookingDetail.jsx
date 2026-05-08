import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    getBooking, getConsumption,
    confirmBooking, startBooking, endBooking, sanitizeBooking, cancelBooking,
    addConsumptionItem, deleteConsumptionItem, getInventoryKits, getPostOtRooms,
} from '../api/client';
import { ArrowLeft, Trash2, Plus, Clock, Activity, IndianRupee, AlertTriangle, CheckCircle2, BedDouble } from 'lucide-react';

const STEPS = [
    { key: 'REQUESTED',         label: 'Requested'   },
    { key: 'CONFIRMED',         label: 'Confirmed'   },
    { key: 'IN_PROGRESS',       label: 'In Progress' },
    { key: 'PENDING_SANITATION',label: 'Sanitation'  },
    { key: 'COMPLETED',         label: 'Completed'   },
];

const STATUS_STYLE = {
    REQUESTED:          'bg-gray-100 text-gray-700 border border-gray-300',
    CONFIRMED:          'bg-blue-100 text-blue-800 border border-blue-300',
    IN_PROGRESS:        'bg-red-100 text-red-800 border border-red-300',
    PENDING_SANITATION: 'bg-amber-100 text-amber-800 border border-amber-300',
    COMPLETED:          'bg-green-100 text-green-800 border border-green-300',
    CANCELLED:          'bg-rose-100 text-rose-800 border border-rose-300',
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

function fmtDt(dt) {
    return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtRupees(n) {
    if (!n && n !== 0) return '—';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

export default function BookingDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [booking, setBooking] = useState(null);
    const [consumption, setConsumption] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState(null);
    const [now, setNow] = useState(new Date());
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [showEndModal, setShowEndModal] = useState(false);

    useEffect(() => {
        const tick = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(tick);
    }, []);

    const fetchAll = useCallback(async () => {
        try {
            const [bRes, cRes] = await Promise.all([getBooking(id), getConsumption(id)]);
            setBooking(bRes.data);
            setConsumption(cRes.data || []);
        } catch {
            // handled below
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const act = async (action, data) => {
        setActionLoading(true);
        setActionError(null);
        try {
            let res;
            if (action === 'end') {
                res = await endBooking(id, data || {});
            } else {
                const fns = { confirm: confirmBooking, start: startBooking, sanitize: sanitizeBooking, cancel: cancelBooking };
                res = await fns[action](id);
            }
            setBooking(res.data);
        } catch (e) {
            setActionError(e.response?.data?.message || e.message || 'Action failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (itemId) => {
        try {
            await deleteConsumptionItem(itemId);
            setConsumption(c => c.filter(x => x.id !== itemId));
        } catch (e) {
            setActionError('Could not delete item: ' + (e.response?.data?.message || e.message));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="flex items-center gap-3 text-gray-500">
                    <Activity size={20} className="animate-spin" />
                    <span>Loading case…</span>
                </div>
            </div>
        );
    }

    if (!booking) {
        return (
            <div className="p-8 text-gray-500">Booking not found.
                <button onClick={() => navigate('/cases')} className="ml-2 text-blue-600 underline">Back to Cases</button>
            </div>
        );
    }

    const isCancelled = booking.status === 'CANCELLED';
    const stepIdx = STEPS.findIndex(s => s.key === booking.status);

    const isLive = booking.status === 'IN_PROGRESS';
    const elapsed = isLive ? now - new Date(booking.actualStart) : null;
    const scheduledDuration = new Date(booking.scheduledEnd) - new Date(booking.scheduledStart);
    const overtime = isLive && now > new Date(booking.scheduledEnd);
    const pct = isLive ? Math.min(100, ((now - new Date(booking.actualStart)) / scheduledDuration) * 100) : null;

    const billable = consumption.filter(c => c.billable);
    const consumptionTotal = billable.reduce((sum, c) => sum + (c.quantity * c.unitPrice), 0);
    const procedureCharge = booking.procedureCharge || 0;
    const estimatedTotal = procedureCharge + consumptionTotal;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ── Top Bar ── */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <button onClick={() => navigate('/cases')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition font-medium text-sm">
                    <ArrowLeft size={16} />
                    Back to Cases
                </button>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${STATUS_STYLE[booking.status] || STATUS_STYLE.REQUESTED}`}>
                        {booking.status.replace('_', ' ')}
                    </span>
                    {!isCancelled && ['REQUESTED', 'CONFIRMED', 'IN_PROGRESS'].includes(booking.status) && (
                        <button onClick={() => setConfirmCancel(true)}
                            className="text-xs text-rose-600 hover:text-rose-800 border border-rose-200 hover:border-rose-400 px-3 py-1 rounded-lg transition font-medium">
                            Cancel Case
                        </button>
                    )}
                </div>
            </div>

            <div className="p-6 max-w-6xl mx-auto">
                {/* ── Workflow Steps ── */}
                {!isCancelled && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
                        <div className="flex items-center">
                            {STEPS.map((step, i) => {
                                const done = i < stepIdx;
                                const active = i === stepIdx;
                                return (
                                    <div key={step.key} className="flex items-center flex-1 last:flex-none">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition
                                                ${done ? 'bg-green-500 border-green-500 text-white' : active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>
                                                {done ? <CheckCircle2 size={16} /> : i + 1}
                                            </div>
                                            <span className={`text-xs mt-1 font-medium ${active ? 'text-blue-600' : done ? 'text-green-600' : 'text-gray-400'}`}>
                                                {step.label}
                                            </span>
                                        </div>
                                        {i < STEPS.length - 1 && (
                                            <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* ── Main Content ── */}
                    <div className="lg:col-span-2 space-y-5">

                        {/* Live Surgery Timer */}
                        {isLive && (
                            <div className={`rounded-2xl border-2 p-5 ${overtime ? 'border-red-400 bg-red-50' : 'border-green-400 bg-green-50'}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                        <span className={`font-bold text-sm uppercase tracking-wide ${overtime ? 'text-red-700' : 'text-green-700'}`}>Surgery Live</span>
                                    </div>
                                    {overtime
                                        ? <span className="text-sm font-bold text-red-600">+{fmt(-( new Date(booking.scheduledEnd) - now))} Overtime</span>
                                        : <span className="text-sm font-medium text-green-700">{fmt(new Date(booking.scheduledEnd) - now)} remaining</span>
                                    }
                                </div>
                                <div className="flex items-end gap-3">
                                    <p className={`text-4xl font-bold tabular-nums ${overtime ? 'text-red-700' : 'text-green-700'}`}>{fmt(elapsed)}</p>
                                    <p className="text-sm text-gray-500 mb-1">elapsed since {new Date(booking.actualStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <div className="mt-3 w-full bg-white bg-opacity-60 rounded-full h-2">
                                    <div className={`h-2 rounded-full transition-all duration-1000 ${overtime ? 'bg-red-500' : 'bg-green-500'}`}
                                        style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        )}

                        {/* Case Info */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Case Details</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <InfoRow label="Patient" value={booking.patientName} sub={booking.patientMrn ? `MRN: ${booking.patientMrn}` : null} />
                                <InfoRow label="Procedure" value={booking.procedureName} />
                                <InfoRow label="OT Room" value={booking.roomName} />
                                <InfoRow label="Surgeon" value={booking.surgeonName ? `Dr. ${booking.surgeonName}` : '—'} />
                                <InfoRow label="Scheduled Start" value={fmtDt(booking.scheduledStart)} />
                                <InfoRow label="Scheduled End" value={fmtDt(booking.scheduledEnd)} />
                                {booking.actualStart && <InfoRow label="Actual Start" value={fmtDt(booking.actualStart)} highlight />}
                                {booking.actualEnd && <InfoRow label="Actual End" value={fmtDt(booking.actualEnd)} highlight />}
                                {booking.actualStart && booking.actualEnd && (
                                    <InfoRow label="Duration"
                                        value={fmt(new Date(booking.actualEnd) - new Date(booking.actualStart))}
                                        highlight />
                                )}
                            </div>
                            {booking.notes && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                                    <p className="text-sm text-gray-700">{booking.notes}</p>
                                </div>
                            )}
                        </div>

                        {/* Consumption */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">Consumption</h2>
                                {!isCancelled && booking.status !== 'COMPLETED' && (
                                    <button onClick={() => setShowAdd(true)}
                                        className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition font-medium">
                                        <Plus size={14} />
                                        Add Item
                                    </button>
                                )}
                            </div>

                            {consumption.length === 0 ? (
                                <p className="text-sm text-gray-400 py-4 text-center">No items added yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {consumption.map(item => (
                                        <div key={item.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition">
                                            <div>
                                                <p className="font-medium text-gray-900 text-sm">{item.itemName}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {item.itemType} · Qty {item.quantity} · {fmtRupees(item.unitPrice)} each
                                                    {item.billable && <span className="ml-1.5 text-green-600 font-medium">Billable</span>}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-semibold text-gray-700">{fmtRupees(item.quantity * item.unitPrice)}</span>
                                                {!isCancelled && booking.status !== 'COMPLETED' && (
                                                    <button onClick={() => handleDelete(item.id)}
                                                        className="text-gray-300 hover:text-red-500 transition">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Sidebar ── */}
                    <div className="space-y-5">
                        {/* Actions */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5">
                            <h3 className="font-bold text-gray-900 mb-4">Actions</h3>

                            {actionError && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
                                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                                    <span>{actionError}</span>
                                </div>
                            )}

                            <div className="space-y-2">
                                {booking.status === 'REQUESTED' && (
                                    <ActionBtn color="blue" label="✓ Confirm Booking" onClick={() => act('confirm')} loading={actionLoading} />
                                )}
                                {booking.status === 'CONFIRMED' && (
                                    <ActionBtn color="green" label="▶ Start Surgery" onClick={() => act('start')} loading={actionLoading} />
                                )}
                                {booking.status === 'IN_PROGRESS' && (
                                    <ActionBtn color="red" label="⏹ End Surgery" onClick={() => setShowEndModal(true)} loading={actionLoading}
                                        hint="This will trigger billing" />
                                )}
                                {booking.status === 'PENDING_SANITATION' && (
                                    <ActionBtn color="amber" label="✓ Sanitation Complete" onClick={() => act('sanitize')} loading={actionLoading} />
                                )}
                                {booking.status === 'COMPLETED' && (
                                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium py-2">
                                        <CheckCircle2 size={18} />
                                        Case completed
                                    </div>
                                )}
                                {isCancelled && (
                                    <div className="text-rose-600 text-sm font-medium py-2">Case cancelled</div>
                                )}
                            </div>
                        </div>

                        {/* Billing Summary */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <IndianRupee size={16} />
                                Billing Summary
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-gray-600">
                                    <span>Procedure Charge</span>
                                    <span className="font-medium text-gray-800">{fmtRupees(procedureCharge)}</span>
                                </div>
                                {billable.map(item => (
                                    <div key={item.id} className="flex justify-between text-gray-500 pl-2">
                                        <span className="truncate max-w-32">{item.itemName} ×{item.quantity}</span>
                                        <span>{fmtRupees(item.quantity * item.unitPrice)}</span>
                                    </div>
                                ))}
                                <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-bold text-gray-900">
                                    <span>Estimated Total</span>
                                    <span>{fmtRupees(estimatedTotal)}</span>
                                </div>
                                {booking.status === 'IN_PROGRESS' && (
                                    <p className="text-xs text-gray-400 mt-1">Invoice sent to IPD billing on surgery end</p>
                                )}
                                {booking.status === 'COMPLETED' && (
                                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                        <CheckCircle2 size={11} />
                                        Invoice submitted to billing
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Timestamps */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5">
                            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-sm">
                                <Clock size={14} />
                                Timeline
                            </h3>
                            <div className="space-y-2 text-xs text-gray-500">
                                <TimelineRow label="Booked" value={fmtDt(booking.createdAt)} />
                                <TimelineRow label="Scheduled" value={`${fmtDt(booking.scheduledStart)} → ${new Date(booking.scheduledEnd).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`} />
                                {booking.actualStart && <TimelineRow label="Started" value={fmtDt(booking.actualStart)} active />}
                                {booking.actualEnd && <TimelineRow label="Ended" value={fmtDt(booking.actualEnd)} active />}
                                {booking.sanitizedAt && <TimelineRow label="Sanitized" value={fmtDt(booking.sanitizedAt)} active />}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cancel confirmation */}
            {confirmCancel && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
                        <h3 className="font-bold text-gray-900 mb-2">Cancel this booking?</h3>
                        <p className="text-sm text-gray-500 mb-5">This action cannot be undone. The OT slot will be freed up.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmCancel(false)}
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                                Keep
                            </button>
                            <button onClick={() => { setConfirmCancel(false); act('cancel'); }}
                                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold transition">
                                Yes, Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAdd && (
                <AddConsumptionModal
                    bookingId={id}
                    onClose={() => setShowAdd(false)}
                    onSuccess={() => { setShowAdd(false); fetchAll(); }}
                />
            )}

            {showEndModal && (
                <EndSurgeryModal
                    hasAdmission={!!booking.admissionId}
                    onClose={() => setShowEndModal(false)}
                    onConfirm={(postOtRoomId) => {
                        setShowEndModal(false);
                        act('end', postOtRoomId ? { postOtRoomId } : {});
                    }}
                />
            )}
        </div>
    );
}

function EndSurgeryModal({ hasAdmission, onClose, onConfirm }) {
    const [destination, setDestination] = useState('ward'); // 'ward' | 'recovery'
    const [rooms, setRooms] = useState([]);
    const [roomsLoading, setRoomsLoading] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState(null);

    useEffect(() => {
        if (!hasAdmission || destination !== 'recovery') return;
        setRoomsLoading(true);
        getPostOtRooms()
            .then(r => setRooms(Array.isArray(r.data) ? r.data : []))
            .catch(() => setRooms([]))
            .finally(() => setRoomsLoading(false));
    }, [hasAdmission, destination]);

    const handleConfirm = () => {
        if (destination === 'recovery' && selectedRoomId) {
            onConfirm(selectedRoomId);
        } else {
            onConfirm(null); // null → HMS returns patient to previousRoom (their ward)
        }
    };

    const canConfirm = destination === 'ward' || (destination === 'recovery' && selectedRoomId);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BedDouble size={18} className="text-blue-600" />
                        <h2 className="font-bold text-gray-900">End Surgery</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>

                <div className="p-6">
                    {hasAdmission ? (
                        <>
                            <p className="text-sm text-gray-600 mb-4">Where should the patient go after surgery?</p>

                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <button
                                    type="button"
                                    onClick={() => { setDestination('ward'); setSelectedRoomId(null); }}
                                    className={[
                                        'p-4 rounded-xl border-2 text-left transition',
                                        destination === 'ward'
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300 bg-white',
                                    ].join(' ')}
                                >
                                    <p className="text-xl mb-1">🛏️</p>
                                    <p className="font-semibold text-sm text-gray-900">Return to Ward</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Back to admission room</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDestination('recovery')}
                                    className={[
                                        'p-4 rounded-xl border-2 text-left transition',
                                        destination === 'recovery'
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300 bg-white',
                                    ].join(' ')}
                                >
                                    <p className="text-xl mb-1">💊</p>
                                    <p className="font-semibold text-sm text-gray-900">Recovery Room</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Post-OT room</p>
                                </button>
                            </div>

                            {destination === 'recovery' && (
                                roomsLoading ? (
                                    <div className="flex items-center justify-center py-5">
                                        <Activity size={18} className="animate-spin text-blue-500" />
                                    </div>
                                ) : rooms.length === 0 ? (
                                    <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                                        No recovery rooms available — patient will return to ward room.
                                    </p>
                                ) : (
                                    <div className="space-y-2 mb-4 max-h-44 overflow-y-auto">
                                        {rooms.map(room => (
                                            <button
                                                key={room.id}
                                                type="button"
                                                onClick={() => setSelectedRoomId(selectedRoomId === room.id ? null : room.id)}
                                                className={[
                                                    'w-full text-left px-4 py-3 rounded-xl border-2 transition text-sm',
                                                    selectedRoomId === room.id
                                                        ? 'border-blue-500 bg-blue-50'
                                                        : 'border-gray-200 hover:border-gray-300 bg-white',
                                                ].join(' ')}
                                            >
                                                <p className="font-semibold text-gray-900">{room.roomNumber || room.roomName}</p>
                                                {room.ward && <p className="text-xs text-gray-500 mt-0.5">{room.ward}</p>}
                                            </button>
                                        ))}
                                    </div>
                                )
                            )}

                            <div className="flex gap-3">
                                <button type="button" onClick={onClose}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={!canConfirm}
                                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition">
                                    End Surgery
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-gray-600 mb-5">
                                This patient is not admitted in HMS. Ending surgery will generate billing only.
                            </p>
                            <div className="flex gap-3">
                                <button type="button" onClick={onClose}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                                    Cancel
                                </button>
                                <button type="button" onClick={() => onConfirm(null)}
                                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition">
                                    End Surgery
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value, sub, highlight }) {
    return (
        <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
            <p className={`text-sm font-semibold ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>{value || '—'}</p>
            {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
    );
}

function ActionBtn({ color, label, onClick, loading, hint }) {
    const colors = {
        blue:  'bg-blue-600 hover:bg-blue-700',
        green: 'bg-green-600 hover:bg-green-700',
        red:   'bg-red-600 hover:bg-red-700',
        amber: 'bg-amber-500 hover:bg-amber-600',
    };
    return (
        <div>
            <button onClick={onClick} disabled={loading}
                className={`w-full ${colors[color]} text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-50 text-sm`}>
                {loading ? 'Processing…' : label}
            </button>
            {hint && <p className="text-xs text-gray-400 mt-1 text-center">{hint}</p>}
        </div>
    );
}

function TimelineRow({ label, value, active }) {
    return (
        <div className="flex justify-between">
            <span className={active ? 'text-blue-600 font-medium' : ''}>{label}</span>
            <span className={active ? 'text-blue-700 font-medium' : ''}>{value}</span>
        </div>
    );
}

function AddConsumptionModal({ bookingId, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [kits, setKits] = useState([]);
    const [kitSearch, setKitSearch] = useState('');
    const [showDrop, setShowDrop] = useState(false);
    const [form, setForm] = useState({ itemName: '', itemType: 'CONSUMABLE', quantity: 1, unitPrice: '', inventoryItemId: null, billable: true });

    useEffect(() => {
        if (form.itemType !== 'KIT') { setKits([]); setKitSearch(''); return; }
        getInventoryKits().then(r => setKits(r.data || [])).catch(() => setKits([]));
    }, [form.itemType]);

    const filtered = kits.filter(k => !kitSearch || k.name?.toLowerCase().includes(kitSearch.toLowerCase()) || k.code?.toLowerCase().includes(kitSearch.toLowerCase()));

    const submit = async (e) => {
        e.preventDefault();
        if (form.itemType === 'KIT' && !form.inventoryItemId) { setError('Please select a kit from the list'); return; }
        setLoading(true); setError(null);
        try {
            await addConsumptionItem(bookingId, { ...form, quantity: Number(form.quantity), unitPrice: parseFloat(form.unitPrice) || 0 });
            onSuccess();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to add item');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                    <h2 className="font-bold text-gray-900">Add Consumption Item</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>
                <form onSubmit={submit} className="p-6 space-y-4">
                    {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type</label>
                        <div className="flex gap-2">
                            {['KIT', 'IMPLANT', 'CONSUMABLE'].map(t => (
                                <button key={t} type="button"
                                    onClick={() => setForm(f => ({ ...f, itemType: t, itemName: '', inventoryItemId: null }))}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${form.itemType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {form.itemType === 'KIT' ? (
                        <div className="relative">
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Kit</label>
                            <input value={kitSearch} onChange={e => { setKitSearch(e.target.value); setShowDrop(true); }}
                                onFocus={() => setShowDrop(true)}
                                placeholder="Search by name or code…"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            {showDrop && filtered.length > 0 && (
                                <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-44 overflow-y-auto">
                                    {filtered.map(k => (
                                        <button key={k.id} type="button"
                                            onClick={() => { setForm(f => ({ ...f, itemName: k.name, inventoryItemId: k.id, unitPrice: k.price || f.unitPrice })); setKitSearch(k.name); setShowDrop(false); }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b last:border-b-0 text-sm">
                                            <p className="font-medium text-gray-900">{k.name}</p>
                                            {k.code && <p className="text-xs text-gray-400">Code: {k.code}</p>}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {form.inventoryItemId && (
                                <p className="mt-1.5 text-xs text-green-600 font-medium">✓ {form.itemName}</p>
                            )}
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Item Name</label>
                            <input value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Quantity</label>
                            <input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Unit Price (₹)</label>
                            <input type="number" step="0.01" min="0" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))}
                                placeholder="0.00"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={form.billable} onChange={e => setForm(f => ({ ...f, billable: e.target.checked }))}
                            className="w-4 h-4 rounded accent-blue-600" />
                        <span className="text-sm font-medium text-gray-700">Add to patient bill</span>
                    </label>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
                            {loading ? 'Adding…' : 'Add Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
