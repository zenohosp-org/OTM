import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    getBooking, getConsumption,
    confirmBooking, startBooking, endBooking, sanitizeBooking, cancelBooking,
    addConsumptionItem, deleteConsumptionItem, getInventoryKits, getPostOtRooms,
} from '../api/client';
import {
    ArrowLeft, Trash2, Plus, Clock, Activity, IndianRupee, AlertTriangle, CheckCircle2,
    BedDouble, Loader2, X, Square, Play,
} from 'lucide-react';

const STEPS = [
    { key: 'REQUESTED',         label: 'Requested'   },
    { key: 'CONFIRMED',         label: 'Confirmed'   },
    { key: 'IN_PROGRESS',       label: 'In Progress' },
    { key: 'PENDING_SANITATION',label: 'Sanitation'  },
    { key: 'COMPLETED',         label: 'Completed'   },
];

const STATUS_BADGE = {
    REQUESTED:          'is-status-requested',
    CONFIRMED:          'is-status-confirmed',
    IN_PROGRESS:        'is-status-in-progress',
    PENDING_SANITATION: 'is-status-sanitation',
    COMPLETED:          'is-status-completed',
    CANCELLED:          'is-status-cancelled',
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
    return new Date(dt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function fmtRupees(n) {
    if (!n && n !== 0) return '—';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 2,
    }).format(n);
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
            <div className="z-page-loader">
                <Loader2 />
                <span>Loading case…</span>
            </div>
        );
    }

    if (!booking) {
        return (
            <div className="z-empty">
                <div className="z-empty-icon"><AlertTriangle /></div>
                <p className="z-empty-title">Booking not found</p>
                <button onClick={() => navigate('/cases')} className="z-btn-primary u-mt-3">Back to Cases</button>
            </div>
        );
    }

    const isCancelled = booking.status === 'CANCELLED';
    const stepIdx = STEPS.findIndex(s => s.key === booking.status);

    const isLive = booking.status === 'IN_PROGRESS';
    const elapsed = isLive ? now - new Date(booking.actualStart) : null;
    const scheduledDuration = new Date(booking.scheduledEnd) - new Date(booking.scheduledStart);
    const overtime = isLive && now > new Date(booking.scheduledEnd);
    const pct = isLive ? Math.min(100, Math.max(0, ((now - new Date(booking.actualStart)) / scheduledDuration) * 100)) : null;

    const billable = consumption.filter(c => c.billable);
    const consumptionTotal = billable.reduce((sum, c) => sum + (c.quantity * c.unitPrice), 0);
    const procedureCharge = booking.procedureCharge || 0;
    const estimatedTotal = procedureCharge + consumptionTotal;

    return (
        <div className="z-page">
            <header className="z-page-header">
                <div className="z-page-title-group">
                    <button onClick={() => navigate('/cases')} className="z-back-btn" aria-label="Back">
                        <ArrowLeft />
                    </button>
                    <div>
                        <h1 className="z-page-title">{booking.procedureName}</h1>
                        <p className="z-page-subtitle">
                            {booking.patientName}{booking.patientMrn && ` · MRN ${booking.patientMrn}`}
                        </p>
                    </div>
                </div>
                <div className="z-page-actions">
                    <span className={`z-badge is-lg ${STATUS_BADGE[booking.status] || 'is-status-requested'}`}>
                        {booking.status.replace(/_/g, ' ')}
                    </span>
                    {!isCancelled && ['REQUESTED', 'CONFIRMED', 'IN_PROGRESS'].includes(booking.status) && (
                        <button onClick={() => setConfirmCancel(true)} className="z-btn-danger is-outline is-sm">
                            Cancel Case
                        </button>
                    )}
                </div>
            </header>

            {!isCancelled && (
                <div className="z-card is-padded-sm">
                    <div className="z-stepper">
                        {STEPS.map((step, i) => {
                            const done = i < stepIdx;
                            const active = i === stepIdx;
                            return (
                                <div key={step.key} className="z-stepper-step">
                                    <div className="z-stepper-node">
                                        <div className={`z-stepper-circle${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}>
                                            {done ? <CheckCircle2 /> : i + 1}
                                        </div>
                                        <span className={`z-stepper-label${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}>
                                            {step.label}
                                        </span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={`z-stepper-bar${done ? ' is-done' : ''}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="u-grid u-grid-cols-1 lg:u-grid-cols-3 u-gap-5">
                <div className="lg:u-col-span-2 u-stack-lg">

                    {isLive && (
                        <div className={`live-timer-panel${overtime ? ' is-overtime' : ''}`}>
                            <div className="live-timer-header">
                                <span className="live-timer-label">
                                    <span className="z-pulse-dot" /> Surgery Live
                                </span>
                                {overtime ? (
                                    <span className="live-timer-meta">+{fmt(-(new Date(booking.scheduledEnd) - now))} Overtime</span>
                                ) : (
                                    <span className="live-timer-meta">{fmt(new Date(booking.scheduledEnd) - now)} remaining</span>
                                )}
                            </div>
                            <div className="u-flex u-items-end u-gap-3">
                                <p className="live-timer-value">{fmt(elapsed)}</p>
                                <p className="live-timer-sub u-mb-1">
                                    elapsed since {new Date(booking.actualStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <div className="live-timer-progress">
                                <div className="live-timer-progress-bar" style={{ '--progress': `${pct}%` }} />
                            </div>
                        </div>
                    )}

                    <div className="z-card">
                        <h2 className="z-section-title u-mb-4">Case Details</h2>
                        <div className="z-info-grid">
                            <InfoRow label="Patient" value={booking.patientName} sub={booking.patientMrn ? `MRN: ${booking.patientMrn}` : null} />
                            <InfoRow label="Procedure" value={booking.procedureName} />
                            <InfoRow label="OT Room" value={booking.roomName} />
                            <InfoRow label="Surgeon" value={booking.surgeonName ? `Dr. ${booking.surgeonName}` : '—'} />
                            <InfoRow label="Scheduled Start" value={fmtDt(booking.scheduledStart)} />
                            <InfoRow label="Scheduled End" value={fmtDt(booking.scheduledEnd)} />
                            {booking.actualStart && <InfoRow label="Actual Start" value={fmtDt(booking.actualStart)} highlight />}
                            {booking.actualEnd && <InfoRow label="Actual End" value={fmtDt(booking.actualEnd)} highlight />}
                            {booking.actualStart && booking.actualEnd && (
                                <InfoRow
                                    label="Duration"
                                    value={fmt(new Date(booking.actualEnd) - new Date(booking.actualStart))}
                                    highlight
                                />
                            )}
                        </div>
                        {booking.notes && (
                            <>
                                <hr className="z-divider" />
                                <p className="z-info-label">Notes</p>
                                <p className="u-text-sm u-mt-2 u-text-default">{booking.notes}</p>
                            </>
                        )}
                    </div>

                    <div className="z-card">
                        <div className="u-flex u-items-center u-justify-between u-mb-4">
                            <h2 className="z-section-title">Consumption</h2>
                            {!isCancelled && booking.status !== 'COMPLETED' && (
                                <button onClick={() => setShowAdd(true)} className="z-btn-primary is-sm">
                                    <Plus className="u-w-4 u-h-4" />
                                    Add Item
                                </button>
                            )}
                        </div>

                        {consumption.length === 0 ? (
                            <p className="u-text-center u-text-muted u-py-4 u-text-sm">No items added yet</p>
                        ) : (
                            <div>
                                {consumption.map(item => (
                                    <div key={item.id} className="consumption-row">
                                        <div className="consumption-row-text">
                                            <p className="consumption-row-title">{item.itemName}</p>
                                            <p className="consumption-row-meta">
                                                {item.itemType} · Qty {item.quantity} · {fmtRupees(item.unitPrice)} each
                                                {item.billable && <span className="is-billable">Billable</span>}
                                            </p>
                                        </div>
                                        <span className="consumption-row-amount">{fmtRupees(item.quantity * item.unitPrice)}</span>
                                        {!isCancelled && booking.status !== 'COMPLETED' && (
                                            <button onClick={() => handleDelete(item.id)} className="consumption-row-delete" aria-label="Delete">
                                                <Trash2 />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="u-stack-lg">
                    <div className="z-card">
                        <h3 className="z-section-title u-mb-4">Actions</h3>

                        {actionError && (
                            <div className="z-alert is-danger u-mb-4">
                                <AlertTriangle />
                                <span>{actionError}</span>
                            </div>
                        )}

                        <div className="u-stack-sm">
                            {booking.status === 'REQUESTED' && (
                                <ActionBtn variant="info" label="Confirm Booking" icon={CheckCircle2} onClick={() => act('confirm')} loading={actionLoading} />
                            )}
                            {booking.status === 'CONFIRMED' && (
                                <ActionBtn variant="success" label="Start Surgery" icon={Play} onClick={() => act('start')} loading={actionLoading} />
                            )}
                            {booking.status === 'IN_PROGRESS' && (
                                <ActionBtn variant="danger" label="End Surgery" icon={Square} onClick={() => setShowEndModal(true)} loading={actionLoading} hint="This will trigger billing" />
                            )}
                            {booking.status === 'PENDING_SANITATION' && (
                                <ActionBtn variant="warning" label="Sanitation Complete" icon={CheckCircle2} onClick={() => act('sanitize')} loading={actionLoading} />
                            )}
                            {booking.status === 'COMPLETED' && (
                                <div className="z-alert is-success">
                                    <CheckCircle2 />
                                    <span>Case completed</span>
                                </div>
                            )}
                            {isCancelled && (
                                <div className="z-alert is-danger">
                                    <X />
                                    <span>Case cancelled</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="z-card">
                        <h3 className="z-section-title u-mb-4 u-flex u-items-center u-gap-2">
                            <IndianRupee className="u-w-4 u-h-4" />
                            Billing Summary
                        </h3>
                        <div className="billing-summary">
                            <div className="billing-row">
                                <span>Procedure Charge</span>
                                <span className="billing-row-value">{fmtRupees(procedureCharge)}</span>
                            </div>
                            {billable.map(item => (
                                <div key={item.id} className="billing-row is-line-item">
                                    <span className="u-truncate">{item.itemName} ×{item.quantity}</span>
                                    <span className="billing-row-value">{fmtRupees(item.quantity * item.unitPrice)}</span>
                                </div>
                            ))}
                            <div className="billing-total">
                                <span>Estimated Total</span>
                                <span className="billing-total-value">{fmtRupees(estimatedTotal)}</span>
                            </div>
                            {booking.status === 'IN_PROGRESS' && (
                                <p className="billing-note">Invoice sent to IPD billing on surgery end</p>
                            )}
                            {booking.status === 'COMPLETED' && (
                                <p className="billing-note is-success">
                                    <CheckCircle2 /> Invoice submitted to billing
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="z-card">
                        <h3 className="z-section-title u-mb-3 u-flex u-items-center u-gap-2">
                            <Clock className="u-w-4 u-h-4" />
                            Timeline
                        </h3>
                        <div className="timeline-list">
                            <TimelineRow label="Booked" value={fmtDt(booking.createdAt)} />
                            <TimelineRow
                                label="Scheduled"
                                value={`${fmtDt(booking.scheduledStart)} → ${new Date(booking.scheduledEnd).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                            />
                            {booking.actualStart && <TimelineRow label="Started" value={fmtDt(booking.actualStart)} active />}
                            {booking.actualEnd && <TimelineRow label="Ended" value={fmtDt(booking.actualEnd)} active />}
                            {booking.sanitizedAt && <TimelineRow label="Sanitized" value={fmtDt(booking.sanitizedAt)} active />}
                        </div>
                    </div>
                </div>
            </div>

            {confirmCancel && (
                <div className="z-modal-overlay" onClick={() => setConfirmCancel(false)}>
                    <div className="z-modal is-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="z-confirm-box">
                            <p className="z-confirm-title">Cancel this booking?</p>
                            <p className="z-confirm-description">
                                This action cannot be undone. The OT slot will be freed up.
                            </p>
                            <div className="z-confirm-actions">
                                <button onClick={() => setConfirmCancel(false)} className="z-btn-cancel is-full">
                                    Keep
                                </button>
                                <button
                                    onClick={() => { setConfirmCancel(false); act('cancel'); }}
                                    className="z-btn-danger is-full"
                                >
                                    Yes, Cancel
                                </button>
                            </div>
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
    const [destination, setDestination] = useState('ward');
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
            onConfirm(null);
        }
    };

    const canConfirm = destination === 'ward' || (destination === 'recovery' && selectedRoomId);

    return (
        <div className="z-modal-overlay" onClick={onClose}>
            <div className="z-modal" onClick={(e) => e.stopPropagation()}>
                <div className="z-modal-header">
                    <h2 className="z-modal-title">
                        <BedDouble /> End Surgery
                    </h2>
                    <button onClick={onClose} className="z-modal-close" aria-label="Close"><X /></button>
                </div>

                <div className="z-modal-body">
                    {hasAdmission ? (
                        <>
                            <p className="u-text-muted u-mb-4">Where should the patient go after surgery?</p>

                            <div className="destination-grid">
                                <button
                                    type="button"
                                    onClick={() => { setDestination('ward'); setSelectedRoomId(null); }}
                                    className={`destination-tile${destination === 'ward' ? ' is-selected' : ''}`}
                                >
                                    <div className="destination-tile-emoji">🛏️</div>
                                    <p className="destination-tile-title">Return to Ward</p>
                                    <p className="destination-tile-sub">Back to admission room</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDestination('recovery')}
                                    className={`destination-tile${destination === 'recovery' ? ' is-selected' : ''}`}
                                >
                                    <div className="destination-tile-emoji">💊</div>
                                    <p className="destination-tile-title">Recovery Room</p>
                                    <p className="destination-tile-sub">Post-OT room</p>
                                </button>
                            </div>

                            {destination === 'recovery' && (
                                roomsLoading ? (
                                    <div className="z-page-loader z-page-loader-compact">
                                        <Loader2 />
                                    </div>
                                ) : rooms.length === 0 ? (
                                    <div className="z-alert is-warning u-mb-4">
                                        <AlertTriangle />
                                        <span>No recovery rooms available — patient will return to ward room.</span>
                                    </div>
                                ) : (
                                    <div className="destination-room-list">
                                        {rooms.map(room => (
                                            <button
                                                key={room.id}
                                                type="button"
                                                onClick={() => setSelectedRoomId(selectedRoomId === room.id ? null : room.id)}
                                                className={`destination-room-item${selectedRoomId === room.id ? ' is-selected' : ''}`}
                                            >
                                                <p className="destination-room-name">{room.roomNumber || room.roomName}</p>
                                                {room.ward && <p className="destination-room-ward">{room.ward}</p>}
                                            </button>
                                        ))}
                                    </div>
                                )
                            )}
                        </>
                    ) : (
                        <p className="u-text-muted">
                            This patient is not admitted in HMS. Ending surgery will generate billing only.
                        </p>
                    )}
                </div>

                <div className="z-modal-footer">
                    <button type="button" onClick={onClose} className="z-btn-cancel">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={hasAdmission ? handleConfirm : () => onConfirm(null)}
                        disabled={hasAdmission && !canConfirm}
                        className="z-btn-danger"
                    >
                        End Surgery
                    </button>
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value, sub, highlight }) {
    return (
        <div className="z-info">
            <span className="z-info-label">{label}</span>
            <span className={`z-info-value${highlight ? ' is-highlight' : ''}`}>{value || '—'}</span>
            {sub && <span className="z-info-sub">{sub}</span>}
        </div>
    );
}

function ActionBtn({ variant, label, icon: Icon, onClick, loading, hint }) {
    return (
        <div>
            <button
                onClick={onClick}
                disabled={loading}
                className={`z-btn-${variant} is-full is-lg${loading ? ' z-btn-loading' : ''}`}
            >
                {Icon && <Icon className="u-w-4 u-h-4" />}
                {loading ? 'Processing…' : label}
            </button>
            {hint && <p className="u-text-xs u-text-muted u-text-center u-mt-2">{hint}</p>}
        </div>
    );
}

function TimelineRow({ label, value, active }) {
    return (
        <div className={`timeline-item${active ? ' is-active' : ''}`}>
            <span className="timeline-item-label">{label}</span>
            <span className="timeline-item-value">{value}</span>
        </div>
    );
}

function AddConsumptionModal({ bookingId, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [kits, setKits] = useState([]);
    const [kitSearch, setKitSearch] = useState('');
    const [showDrop, setShowDrop] = useState(false);
    const [form, setForm] = useState({
        itemName: '', itemType: 'CONSUMABLE', quantity: 1, unitPrice: '',
        inventoryItemId: null, billable: true,
    });

    useEffect(() => {
        if (form.itemType !== 'KIT') { setKits([]); setKitSearch(''); return; }
        getInventoryKits().then(r => setKits(r.data || [])).catch(() => setKits([]));
    }, [form.itemType]);

    const filtered = kits.filter(k => !kitSearch
        || k.name?.toLowerCase().includes(kitSearch.toLowerCase())
        || k.code?.toLowerCase().includes(kitSearch.toLowerCase()));

    const submit = async (e) => {
        e.preventDefault();
        if (form.itemType === 'KIT' && !form.inventoryItemId) {
            setError('Please select a kit from the list');
            return;
        }
        setLoading(true); setError(null);
        try {
            await addConsumptionItem(bookingId, {
                ...form,
                quantity: Number(form.quantity),
                unitPrice: parseFloat(form.unitPrice) || 0,
            });
            onSuccess();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to add item');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="z-modal-overlay" onClick={onClose}>
            <div className="z-modal" onClick={(e) => e.stopPropagation()}>
                <div className="z-modal-header">
                    <h2 className="z-modal-title">Add Consumption Item</h2>
                    <button onClick={onClose} className="z-modal-close" aria-label="Close"><X /></button>
                </div>
                <form onSubmit={submit}>
                    <div className="z-modal-body">
                        {error && <div className="z-alert is-danger u-mb-4">{error}</div>}

                        <div className="z-field u-mb-4">
                            <label className="z-label">Type</label>
                            <div className="u-flex u-gap-2">
                                {['KIT', 'IMPLANT', 'CONSUMABLE'].map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, itemType: t, itemName: '', inventoryItemId: null }))}
                                        className={`z-pill u-flex-1 u-justify-center${form.itemType === t ? ' is-active' : ''}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {form.itemType === 'KIT' ? (
                            <div className="z-field u-mb-4">
                                <label className="z-label">Select Kit</label>
                                <div className="u-relative">
                                    <input
                                        value={kitSearch}
                                        onChange={e => { setKitSearch(e.target.value); setShowDrop(true); }}
                                        onFocus={() => setShowDrop(true)}
                                        placeholder="Search by name or code…"
                                        className="z-input"
                                    />
                                    {showDrop && filtered.length > 0 && (
                                        <div className="z-dropdown">
                                            {filtered.map(k => (
                                                <button
                                                    key={k.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setForm(f => ({ ...f, itemName: k.name, inventoryItemId: k.id, unitPrice: k.price || f.unitPrice }));
                                                        setKitSearch(k.name);
                                                        setShowDrop(false);
                                                    }}
                                                    className="z-dropdown-item"
                                                >
                                                    <span className="z-dropdown-item-title">{k.name}</span>
                                                    {k.code && <span className="z-dropdown-item-sub">Code: {k.code}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {form.inventoryItemId && (
                                    <p className="u-text-success u-text-xs u-mt-2 u-font-semibold">
                                        ✓ {form.itemName}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="z-field u-mb-4">
                                <label className="z-label">Item Name</label>
                                <input
                                    value={form.itemName}
                                    onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))}
                                    className="z-input"
                                    required
                                />
                            </div>
                        )}

                        <div className="z-form-grid u-mb-4">
                            <div className="z-field">
                                <label className="z-label">Quantity</label>
                                <input
                                    type="number" min="1"
                                    value={form.quantity}
                                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                                    className="z-input"
                                    required
                                />
                            </div>
                            <div className="z-field">
                                <label className="z-label">Unit Price (₹)</label>
                                <input
                                    type="number" step="0.01" min="0"
                                    value={form.unitPrice}
                                    onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))}
                                    placeholder="0.00"
                                    className="z-input"
                                    required
                                />
                            </div>
                        </div>

                        <label className="z-checkbox-label">
                            <input
                                type="checkbox"
                                checked={form.billable}
                                onChange={e => setForm(f => ({ ...f, billable: e.target.checked }))}
                                className="z-checkbox"
                            />
                            Add to patient bill
                        </label>
                    </div>
                    <div className="z-modal-footer">
                        <button type="button" onClick={onClose} className="z-btn-cancel">Cancel</button>
                        <button type="submit" disabled={loading} className={`z-btn-primary${loading ? ' z-btn-loading' : ''}`}>
                            {loading ? 'Adding…' : 'Add Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
