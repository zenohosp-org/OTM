import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    createBooking, addConsumptionItem,
    getHmsPatients, getHmsDoctors,
    getInventoryKits, getActiveAdmissions, getAvailableRooms,
    getHospitalServices,
} from '../api/client';
import {
    ArrowLeft, Plus, Search, Trash2, AlertCircle, CheckCircle2, XCircle,
    Calendar, Lock, Loader2, X, User, Stethoscope, Boxes, FileText, Activity,
} from 'lucide-react';

const MAX_RETRIES = 3;

const SPECIALIZATIONS = [
    'Cardiology', 'Orthopedics', 'Neurosurgery', 'General Surgery',
    'ENT', 'Ophthalmology', 'Urology', 'Oncology',
];

export default function NewBooking() {
    const navigate = useNavigate();

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const [patients, setPatients] = useState([]);
    const [patientSearch, setPatientSearch] = useState('');
    const [showPatientDrop, setShowPatientDrop] = useState(false);
    const [searchingPatients, setSearchingPatients] = useState(false);

    const [surgeons, setSurgeons] = useState([]);
    const [surgeonSearch, setSurgeonSearch] = useState('');
    const [showSurgeonDrop, setShowSurgeonDrop] = useState(false);
    const [searchingSurgeons, setSearchingSurgeons] = useState(false);
    const [specialization, setSpecialization] = useState('');

    const [allKits, setAllKits] = useState([]);
    const [kitSearch, setKitSearch] = useState('');
    const [showKitDrop, setShowKitDrop] = useState(false);
    const [loadingKits, setLoadingKits] = useState(false);
    const [kitError, setKitError] = useState(null);
    const [selectedKits, setSelectedKits] = useState([]);
    const kitRetry = useRef(null);

    const [services, setServices] = useState([]);
    const [serviceSearch, setServiceSearch] = useState('');
    const [showServiceDrop, setShowServiceDrop] = useState(false);
    const [loadingServices, setLoadingServices] = useState(false);

    const [admissions, setAdmissions] = useState([]);

    const [form, setForm] = useState({
        patientId: '', patientName: '', patientMrn: '', admissionId: null,
        procedureName: '', procedureCharge: '', hmsServiceId: '',
        roomId: '', roomName: '',
        surgeonId: '', surgeonName: '',
        scheduledStart: '', scheduledEnd: '',
        notes: '',
    });

    useEffect(() => {
        getActiveAdmissions()
            .then((res) => setAdmissions(Array.isArray(res.data) ? res.data : []))
            .catch(() => setAdmissions([]));
    }, []);

    useEffect(() => {
        const fetchKits = async (retry = 0) => {
            if (retry === 0) setLoadingKits(true);
            setKitError(null);
            try {
                const res = await getInventoryKits();
                setAllKits(res.data || []);
            } catch {
                if (retry < MAX_RETRIES) {
                    setKitError('Loading inventory…');
                    kitRetry.current = setTimeout(() => fetchKits(retry + 1), 4000);
                } else {
                    setKitError('Inventory unavailable. Add items manually.');
                }
            } finally {
                if (retry === 0) setLoadingKits(false);
            }
        };
        fetchKits();
        return () => clearTimeout(kitRetry.current);
    }, []);

    useEffect(() => {
        setLoadingServices(true);
        getHospitalServices()
            .then((res) => setServices(Array.isArray(res.data) ? res.data.filter((s) => s.isActive !== false) : []))
            .catch(() => setServices([]))
            .finally(() => setLoadingServices(false));
    }, []);

    const searchPatients = async (q) => {
        if (q.length < 2) { setPatients([]); return; }
        setSearchingPatients(true);
        try {
            const res = await getHmsPatients(q);
            setPatients(res.data || []);
        } catch { setPatients([]); } finally { setSearchingPatients(false); }
    };

    const searchSurgeons = async (q) => {
        if (q.length < 2) { setSurgeons([]); return; }
        setSearchingSurgeons(true);
        try {
            const res = await getHmsDoctors(q, specialization || undefined);
            setSurgeons(res.data || []);
        } catch { setSurgeons([]); } finally { setSearchingSurgeons(false); }
    };

    const handlePatientSelect = (p) => {
        const activeAdmission = admissions.find((a) => String(a.patientId) === String(p.id));
        setForm((f) => ({
            ...f,
            patientId: p.id,
            patientName: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
            patientMrn: p.mrn || '',
            admissionId: activeAdmission?.id ?? null,
        }));
        setPatientSearch(''); setShowPatientDrop(false); setPatients([]);
    };

    const handleSurgeonSelect = (s) => {
        setForm((f) => ({
            ...f,
            surgeonId: s.id || s.userId || '',
            surgeonName: s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
        }));
        setSurgeonSearch(''); setShowSurgeonDrop(false); setSurgeons([]);
    };

    const handleRoomSelect = (room) => {
        setForm((f) => ({ ...f, roomId: room.id || 0, roomName: room.roomNumber || '' }));
    };

    const handleServiceSelect = (svc) => {
        setForm((f) => ({
            ...f,
            procedureName: svc.name,
            procedureCharge: svc.price != null ? String(svc.price) : '',
            hmsServiceId: svc.id,
        }));
        setServiceSearch(''); setShowServiceDrop(false);
    };

    const handleAddKit = (kit) => {
        if (selectedKits.find((k) => k.id === kit.id)) return;
        setSelectedKits((prev) => [...prev, { id: kit.id, name: kit.name, quantity: 1, unitPrice: kit.price || 0 }]);
        setKitSearch(''); setShowKitDrop(false);
    };

    const handleSubmit = async () => {
        if (!form.patientId) { setError('Please select a patient'); return; }
        if (!form.scheduledStart || !form.scheduledEnd) { setError('Please set start and end times'); return; }
        if (!form.roomName) { setError('Please select an OT room'); return; }
        if (!form.surgeonId) { setError('Please select a surgeon'); return; }

        setSubmitting(true);
        setError(null);
        try {
            const payload = {
                ...form,
                patientId: Number(form.patientId),
                roomId: Number(form.roomId) || 0,
                procedureCharge: form.procedureCharge ? Number(form.procedureCharge) : null,
                hmsServiceId: form.hmsServiceId || null,
                admissionId: form.admissionId || null,
            };
            const res = await createBooking(payload);
            const bookingId = res.data.id;
            for (const kit of selectedKits) {
                await addConsumptionItem(bookingId, {
                    itemName: kit.name,
                    itemType: 'KIT',
                    quantity: kit.quantity,
                    unitPrice: kit.unitPrice,
                    inventoryItemId: kit.id,
                    billable: true,
                });
            }
            navigate('/cases');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create booking. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredKits = allKits.filter(
        (k) => !kitSearch
            || k.name?.toLowerCase().includes(kitSearch.toLowerCase())
            || k.code?.toLowerCase().includes(kitSearch.toLowerCase())
    );

    return (
        <div className="z-page">
            <header className="z-page-header">
                <div className="z-page-title-group">
                    <button onClick={() => navigate('/cases')} className="z-back-btn" aria-label="Back to Cases">
                        <ArrowLeft />
                    </button>
                    <div>
                        <h1 className="z-page-title">New OT Booking</h1>
                        <p className="z-page-subtitle">Schedule a surgical case for the operating theatre</p>
                    </div>
                </div>
                <div className="z-page-actions">
                    <button onClick={() => navigate('/cases')} className="z-btn-cancel">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={`z-btn-primary${submitting ? ' z-btn-loading' : ''}`}
                    >
                        <Plus className="u-w-4 u-h-4" />
                        {submitting ? 'Creating…' : 'Create Booking'}
                    </button>
                </div>
            </header>

            {error && (
                <div className="z-alert is-danger">
                    <XCircle />
                    <span>{error}</span>
                </div>
            )}

            <div className="u-grid u-grid-cols-1 lg:u-grid-cols-2 u-gap-5">
                <FormCard title="Patient" icon={User} required>
                    <div className="u-relative">
                        <SearchField
                            placeholder="Search by name, MRN or phone…"
                            value={patientSearch}
                            onChange={(v) => { setPatientSearch(v); setShowPatientDrop(true); searchPatients(v); }}
                            onFocus={() => setShowPatientDrop(true)}
                            loading={searchingPatients}
                        />
                        {showPatientDrop && patients.length > 0 && (
                            <Dropdown>
                                {patients.map((p) => {
                                    const isInpatient = admissions.some((a) => String(a.patientId) === String(p.id));
                                    return (
                                        <DropdownItem key={p.id} onClick={() => handlePatientSelect(p)}>
                                            <span className="z-dropdown-item-title u-flex u-items-center u-gap-2">
                                                {p.name || `${p.firstName} ${p.lastName}`}
                                                {isInpatient && <span className="z-badge is-soft is-warning">Inpatient</span>}
                                            </span>
                                            <span className="z-dropdown-item-sub">
                                                MRN: {p.mrn}{p.age != null ? ` · Age: ${p.age}` : ''}
                                            </span>
                                        </DropdownItem>
                                    );
                                })}
                            </Dropdown>
                        )}
                    </div>
                    {form.patientId && (
                        <SelectedTag
                            label={form.patientName}
                            sub={`MRN: ${form.patientMrn}${form.admissionId ? ' · Admitted' : ''}`}
                            onClear={() => setForm((f) => ({ ...f, patientId: '', patientName: '', patientMrn: '', admissionId: null }))}
                        />
                    )}
                </FormCard>

                <FormCard title="Procedure" icon={Activity} required>
                    <div className="u-stack-sm">
                        <div className="u-relative">
                            <SearchField
                                placeholder={loadingServices ? 'Loading services…' : 'Search by procedure name…'}
                                value={serviceSearch}
                                onChange={(v) => { setServiceSearch(v); setShowServiceDrop(true); }}
                                onFocus={() => setShowServiceDrop(true)}
                                loading={loadingServices}
                            />
                            {showServiceDrop && services.length > 0 && (() => {
                                const q = serviceSearch.toLowerCase();
                                const filtered = services.filter((s) => !q || s.name?.toLowerCase().includes(q));
                                return filtered.length > 0 ? (
                                    <Dropdown>
                                        {filtered.map((svc) => (
                                            <DropdownItem key={svc.id} onClick={() => handleServiceSelect(svc)}>
                                                <span className="z-dropdown-item-title">{svc.name}</span>
                                                {svc.price != null && (
                                                    <span className="u-text-success u-font-semibold u-text-xs">
                                                        ₹{Number(svc.price).toLocaleString('en-IN')}
                                                    </span>
                                                )}
                                            </DropdownItem>
                                        ))}
                                    </Dropdown>
                                ) : null;
                            })()}
                        </div>
                        {form.procedureName ? (
                            <SelectedTag
                                label={form.procedureName}
                                sub={form.procedureCharge ? `₹${Number(form.procedureCharge).toLocaleString('en-IN')}` : 'No charge set'}
                                onClear={() => setForm((f) => ({ ...f, procedureName: '', procedureCharge: '', hmsServiceId: '' }))}
                            />
                        ) : (
                            <input
                                className="z-input"
                                placeholder="Or type procedure name manually…"
                                value={form.procedureName}
                                onChange={(e) => setForm((f) => ({ ...f, procedureName: e.target.value.slice(0, 300), hmsServiceId: '' }))}
                            />
                        )}
                        {form.procedureName && !form.hmsServiceId && (
                            <input
                                className="z-input"
                                type="number" step="0.01" min="0"
                                placeholder="Procedure charge (₹)"
                                value={form.procedureCharge}
                                onChange={(e) => setForm((f) => ({ ...f, procedureCharge: e.target.value }))}
                            />
                        )}
                    </div>
                </FormCard>

                <FormCard title="Schedule" icon={Calendar} required>
                    <div className="u-grid u-grid-cols-2 u-gap-3">
                        <div className="z-field">
                            <label className="z-label">Start time</label>
                            <input
                                className="z-input"
                                type="datetime-local"
                                value={form.scheduledStart}
                                onChange={(e) => setForm((f) => ({
                                    ...f, scheduledStart: e.target.value, roomId: '', roomName: '',
                                }))}
                                required
                            />
                        </div>
                        <div className="z-field">
                            <label className="z-label">End time</label>
                            <input
                                className="z-input"
                                type="datetime-local"
                                value={form.scheduledEnd}
                                onChange={(e) => setForm((f) => ({
                                    ...f, scheduledEnd: e.target.value, roomId: '', roomName: '',
                                }))}
                                required
                            />
                        </div>
                    </div>
                </FormCard>

                <FormCard title="Surgeon" icon={Stethoscope} required>
                    <div className="u-stack-sm">
                        <select
                            className="z-select"
                            value={specialization}
                            onChange={(e) => { setSpecialization(e.target.value); setSurgeons([]); setSurgeonSearch(''); }}
                        >
                            <option value="">All Specializations</option>
                            {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="u-relative">
                            <SearchField
                                placeholder="Search by surgeon name…"
                                value={surgeonSearch}
                                onChange={(v) => { setSurgeonSearch(v); setShowSurgeonDrop(true); searchSurgeons(v); }}
                                onFocus={() => setShowSurgeonDrop(true)}
                                loading={searchingSurgeons}
                            />
                            {showSurgeonDrop && surgeons.length > 0 && (
                                <Dropdown>
                                    {surgeons.map((s) => (
                                        <DropdownItem key={s.id || s.userId} onClick={() => handleSurgeonSelect(s)}>
                                            <span className="z-dropdown-item-title">
                                                {s.name || `${s.firstName} ${s.lastName}`}
                                            </span>
                                            <span className="z-dropdown-item-sub">
                                                {s.specialization && <span className="u-text-info u-font-semibold u-mr-2">{s.specialization}</span>}
                                                {s.email}
                                            </span>
                                        </DropdownItem>
                                    ))}
                                </Dropdown>
                            )}
                        </div>
                        {form.surgeonId && (
                            <SelectedTag
                                label={form.surgeonName}
                                sub="Surgeon"
                                onClear={() => setForm((f) => ({ ...f, surgeonId: '', surgeonName: '' }))}
                            />
                        )}
                    </div>
                </FormCard>

                <div className="u-col-full lg:u-col-span-2">
                    <FormCard title="OT Room" icon={Calendar} required>
                        <RoomGrid
                            start={form.scheduledStart}
                            end={form.scheduledEnd}
                            selectedRoomId={form.roomId}
                            onSelect={handleRoomSelect}
                        />
                    </FormCard>
                </div>

                <FormCard title="Inventory Kits" icon={Boxes}>
                    {kitError && (
                        <p className="u-text-warning u-text-xs u-mb-2">{kitError}</p>
                    )}
                    <div className="u-relative">
                        <SearchField
                            placeholder={kitError ? 'Enter kit name…' : 'Search kits by name or code…'}
                            value={kitSearch}
                            onChange={(v) => { setKitSearch(v); if (!kitError) setShowKitDrop(true); }}
                            onFocus={() => { if (!kitError) setShowKitDrop(true); }}
                            loading={loadingKits}
                        />
                        {!kitError && showKitDrop && filteredKits.length > 0 && (
                            <Dropdown>
                                {filteredKits.map((k) => (
                                    <DropdownItem key={k.id} onClick={() => handleAddKit(k)}>
                                        <span className="z-dropdown-item-title">{k.name}</span>
                                        {k.code && <span className="z-dropdown-item-sub">Code: {k.code}</span>}
                                    </DropdownItem>
                                ))}
                            </Dropdown>
                        )}
                    </div>
                    {kitError && kitSearch && (
                        <button
                            type="button"
                            onClick={() => handleAddKit({ id: `manual_${Date.now()}`, name: kitSearch, price: 0 })}
                            className="z-btn-ghost is-sm u-mt-2"
                        >
                            <Plus className="u-w-4 u-h-4" />
                            Add &ldquo;{kitSearch}&rdquo; as custom item
                        </button>
                    )}
                    {selectedKits.length > 0 && (
                        <div className="u-stack-sm u-mt-3">
                            {selectedKits.map((kit) => (
                                <div key={kit.id} className="consumption-row">
                                    <span className="consumption-row-title u-flex-1 u-truncate">{kit.name}</span>
                                    <div className="u-flex u-items-center u-gap-2">
                                        <input
                                            type="number" min="1" value={kit.quantity}
                                            onChange={(e) => setSelectedKits((kits) => kits.map((k) => k.id === kit.id
                                                ? { ...k, quantity: Math.max(1, Number(e.target.value)) } : k))}
                                            className="z-input is-sm kit-qty-input"
                                            aria-label="Quantity"
                                        />
                                        <span className="u-text-xs u-text-muted">qty</span>
                                        <input
                                            type="number" step="0.01" min="0" value={kit.unitPrice}
                                            onChange={(e) => setSelectedKits((kits) => kits.map((k) => k.id === kit.id
                                                ? { ...k, unitPrice: Math.max(0, Number(e.target.value)) } : k))}
                                            className="z-input is-sm kit-price-input"
                                            aria-label="Unit price"
                                        />
                                        <span className="u-text-xs u-text-muted">₹</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedKits((kits) => kits.filter((k) => k.id !== kit.id))}
                                        className="consumption-row-delete"
                                        aria-label="Remove kit"
                                    >
                                        <Trash2 />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </FormCard>

                <FormCard title="Notes" icon={FileText}>
                    <textarea
                        className="z-textarea"
                        rows={4}
                        placeholder="Clinical notes, allergies, special requirements…"
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value.slice(0, 1000) }))}
                    />
                </FormCard>
            </div>

            <div className="u-flex u-justify-end u-gap-2 u-pt-2">
                <button onClick={() => navigate('/cases')} className="z-btn-cancel">Cancel</button>
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`z-btn-primary${submitting ? ' z-btn-loading' : ''}`}
                >
                    <Plus className="u-w-4 u-h-4" />
                    {submitting ? 'Creating…' : 'Create Booking'}
                </button>
            </div>
        </div>
    );
}

// ─── Form scaffolding ─────────────────────────────────────────────────────────

function FormCard({ title, icon: Icon, required, children }) {
    return (
        <div className="z-card">
            <div className="u-flex u-items-center u-gap-2 u-mb-3">
                {Icon && (
                    <div className="z-card-icon-pill">
                        <Icon />
                    </div>
                )}
                <h3 className="z-card-section-title">{title}</h3>
                {required && <span className="u-text-danger u-text-xs">*</span>}
            </div>
            <div className="u-relative">{children}</div>
        </div>
    );
}

function SearchField({ placeholder, value, onChange, onFocus, loading }) {
    return (
        <div className="z-search-bar">
            <Search className="z-search-icon" />
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={onFocus}
                className="z-input"
            />
            {loading && <Loader2 className="z-search-spinner" />}
        </div>
    );
}

function Dropdown({ children }) {
    return <div className="z-dropdown">{children}</div>;
}

function DropdownItem({ onClick, children }) {
    return (
        <button type="button" onClick={onClick} className="z-dropdown-item">
            {children}
        </button>
    );
}

function SelectedTag({ label, sub, onClear }) {
    return (
        <div className="z-selected-tag">
            <div className="z-selected-tag-text">
                <p className="z-selected-tag-label">{label}</p>
                {sub && <p className="z-selected-tag-sub">{sub}</p>}
            </div>
            <button type="button" onClick={onClear} className="z-selected-tag-clear" aria-label="Clear selection">
                <X />
            </button>
        </div>
    );
}

// ─── Room availability grid ───────────────────────────────────────────────────

function RoomGrid({ start, end, selectedRoomId, onSelect }) {
    const [rooms, setRooms] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hmsDown, setHmsDown] = useState(false);
    const [manualInput, setManualInput] = useState('');

    useEffect(() => {
        if (!start || !end) { setRooms(null); setHmsDown(false); return; }
        let active = true;
        setLoading(true);
        setHmsDown(false);
        getAvailableRooms(start, end, null)
            .then((res) => { if (active) setRooms(Array.isArray(res.data) ? res.data : []); })
            .catch(() => { if (active) setHmsDown(true); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [start, end]);

    if (!start || !end) {
        return (
            <div className="room-availability-empty">
                <Calendar />
                <p>Set a start and end time above to see room availability</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="room-availability-grid">
                {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="room-tile-skeleton" />)}
            </div>
        );
    }

    if (hmsDown) {
        return (
            <div className="u-stack-md">
                <div className="z-alert is-warning">
                    <AlertCircle />
                    <span>Room availability is unavailable. Enter a room name manually.</span>
                </div>
                <input
                    type="text"
                    placeholder="e.g. OT-3, Theatre B…"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onBlur={() => {
                        if (manualInput.trim()) onSelect({ id: 0, roomNumber: manualInput.trim(), available: true });
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && manualInput.trim()) {
                            onSelect({ id: 0, roomNumber: manualInput.trim(), available: true });
                        }
                    }}
                    className="z-input"
                />
            </div>
        );
    }

    if (!rooms || rooms.length === 0) {
        return (
            <div className="room-availability-empty">
                <Calendar />
                <p>No OT rooms configured in HMS</p>
            </div>
        );
    }

    const available = rooms.filter((r) => r.available);
    const occupied = rooms.filter((r) => !r.available);

    return (
        <div className="u-stack-md">
            {available.length === 0 && (
                <div className="z-alert is-danger">
                    <Lock />
                    <div>
                        <p className="u-font-bold">No rooms available for this time slot</p>
                        <p className="u-text-xs u-mt-1">All rooms are occupied or booked. Try a different time.</p>
                    </div>
                </div>
            )}

            {available.length > 0 && (
                <div className="room-availability-section">
                    <span className="room-availability-header is-available">
                        <span className="room-tile-status-dot" />
                        Available — {available.length} room{available.length > 1 ? 's' : ''}
                    </span>
                    <div className="room-availability-grid">
                        {available.map((room) => (
                            <RoomTile
                                key={room.id}
                                room={room}
                                selected={String(room.id) === String(selectedRoomId)}
                                onSelect={() => onSelect(room)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {occupied.length > 0 && (
                <div className="room-availability-section">
                    <span className="room-availability-header is-occupied">
                        <span className="room-tile-status-dot" />
                        Unavailable — {occupied.length} room{occupied.length > 1 ? 's' : ''}
                    </span>
                    <div className="room-availability-grid">
                        {occupied.map((room) => (
                            <RoomTile key={room.id} room={room} selected={false} onSelect={() => {}} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function RoomTile({ room, selected, onSelect }) {
    const isInProgress = room.occupiedStatus === 'IN_PROGRESS';
    const isSanitation = room.occupiedStatus === 'PENDING_SANITATION';
    const isHmsOccupied = room.occupiedStatus === 'HMS_OCCUPIED';
    const roomLabel = room.roomNumber || room.roomName || `OT-${room.id}`;

    const freeLabel = (() => {
        if (!room.freeAt) return null;
        if (room.freeAt === 'After sanitation') return 'After sanitation';
        try {
            return `Free at ${new Date(room.freeAt).toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', hour12: true,
            })}`;
        } catch { return null; }
    })();

    if (room.available) {
        return (
            <button
                type="button"
                onClick={onSelect}
                className={`room-tile is-available${selected ? ' is-selected' : ''}`}
            >
                <p className="room-tile-name">{roomLabel}</p>
                {room.ward && <p className="room-tile-ward">{room.ward}</p>}
                <div className="room-tile-status">
                    <span className="room-tile-status-dot" />
                    {selected ? 'Selected' : 'Free'}
                </div>
                {selected && <CheckCircle2 className="room-tile-check" />}
            </button>
        );
    }

    const statusClass = isInProgress ? 'is-in-progress'
        : isSanitation ? 'is-sanitation'
        : isHmsOccupied ? 'is-hms-occupied'
        : 'is-booked';

    const statusLabel = isInProgress ? 'In Progress'
        : isSanitation ? 'Cleaning'
        : isHmsOccupied ? 'In Use'
        : 'Booked';

    return (
        <div className={`room-tile is-occupied ${statusClass}`}>
            <p className="room-tile-name">{roomLabel}</p>
            <div className="room-tile-status">
                <span className="room-tile-status-dot" />
                {statusLabel}
            </div>
            {room.occupiedBy && (
                <p className="room-tile-occupied-by">{room.occupiedBy}</p>
            )}
            {freeLabel && (
                <p className="room-tile-free-at">{freeLabel}</p>
            )}
        </div>
    );
}
