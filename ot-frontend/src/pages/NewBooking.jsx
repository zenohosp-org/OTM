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

    // Patient
    const [patients, setPatients] = useState([]);
    const [patientSearch, setPatientSearch] = useState('');
    const [showPatientDrop, setShowPatientDrop] = useState(false);
    const [searchingPatients, setSearchingPatients] = useState(false);

    // Surgeon
    const [surgeons, setSurgeons] = useState([]);
    const [surgeonSearch, setSurgeonSearch] = useState('');
    const [showSurgeonDrop, setShowSurgeonDrop] = useState(false);
    const [searchingSurgeons, setSearchingSurgeons] = useState(false);
    const [specialization, setSpecialization] = useState('');

    // Inventory kits
    const [allKits, setAllKits] = useState([]);
    const [kitSearch, setKitSearch] = useState('');
    const [showKitDrop, setShowKitDrop] = useState(false);
    const [loadingKits, setLoadingKits] = useState(false);
    const [kitError, setKitError] = useState(null);
    const [selectedKits, setSelectedKits] = useState([]);
    const kitRetry = useRef(null);

    // Procedure / service
    const [services, setServices] = useState([]);
    const [serviceSearch, setServiceSearch] = useState('');
    const [showServiceDrop, setShowServiceDrop] = useState(false);
    const [loadingServices, setLoadingServices] = useState(false);

    // Admissions (for resolving admissionId on patient pick — no UI list)
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
        <div className="max-w-7xl mx-auto space-y-5">
            {/* Page header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/cases')}
                        className="p-2 rounded-lg text-slate-500 dark:text-[#888888] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] hover:text-slate-800 dark:hover:text-white transition-colors"
                        aria-label="Back to Cases"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New OT Booking</h1>
                        <p className="text-sm text-slate-500 dark:text-[#888888] mt-0.5">
                            Schedule a surgical case for the operating theatre
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/cases')} className="btn-secondary">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="btn-primary"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {submitting ? 'Creating…' : 'Create Booking'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 px-4 py-3 rounded-lg text-sm">
                    <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {error}
                </div>
            )}

            {/* Form grid — two columns on lg+, stacked on smaller */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Patient */}
                <FormCard title="Patient" icon={User} required>
                    <div className="relative">
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
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-slate-900 dark:text-white">
                                                    {p.name || `${p.firstName} ${p.lastName}`}
                                                </span>
                                                {isInpatient && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                                                        Inpatient
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-500 dark:text-[#888888]">
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

                {/* Procedure */}
                <FormCard title="Procedure" icon={Activity} required>
                    <div className="space-y-2.5">
                        <div className="relative">
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
                                                <span className="font-medium text-slate-900 dark:text-white">{svc.name}</span>
                                                {svc.price != null && (
                                                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
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
                                className="input"
                                placeholder="Or type procedure name manually…"
                                value={form.procedureName}
                                onChange={(e) => setForm((f) => ({ ...f, procedureName: e.target.value.slice(0, 300), hmsServiceId: '' }))}
                            />
                        )}
                        {form.procedureName && !form.hmsServiceId && (
                            <input
                                className="input"
                                type="number" step="0.01" min="0"
                                placeholder="Procedure charge (₹)"
                                value={form.procedureCharge}
                                onChange={(e) => setForm((f) => ({ ...f, procedureCharge: e.target.value }))}
                            />
                        )}
                    </div>
                </FormCard>

                {/* Schedule */}
                <FormCard title="Schedule" icon={Calendar} required>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label">Start time</label>
                            <input
                                className="input"
                                type="datetime-local"
                                value={form.scheduledStart}
                                onChange={(e) => setForm((f) => ({
                                    ...f, scheduledStart: e.target.value, roomId: '', roomName: '',
                                }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="label">End time</label>
                            <input
                                className="input"
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

                {/* Surgeon */}
                <FormCard title="Surgeon" icon={Stethoscope} required>
                    <div className="space-y-2.5">
                        <select
                            className="input"
                            value={specialization}
                            onChange={(e) => { setSpecialization(e.target.value); setSurgeons([]); setSurgeonSearch(''); }}
                        >
                            <option value="">All Specializations</option>
                            {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="relative">
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
                                            <span className="font-medium text-slate-900 dark:text-white">
                                                {s.name || `${s.firstName} ${s.lastName}`}
                                            </span>
                                            <span className="text-xs text-slate-500 dark:text-[#888888]">
                                                {s.specialization && <span className="text-blue-600 dark:text-blue-400 mr-2">{s.specialization}</span>}
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

                {/* OT Room — full width row */}
                <div className="lg:col-span-2">
                    <FormCard title="OT Room" icon={Calendar} required>
                        <RoomGrid
                            start={form.scheduledStart}
                            end={form.scheduledEnd}
                            selectedRoomId={form.roomId}
                            onSelect={handleRoomSelect}
                        />
                    </FormCard>
                </div>

                {/* Inventory kits */}
                <FormCard title="Inventory Kits" icon={Boxes}>
                    {kitError && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">{kitError}</p>
                    )}
                    <div className="relative">
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
                                        <span className="font-medium text-slate-900 dark:text-white">{k.name}</span>
                                        {k.code && <span className="text-xs text-slate-500 dark:text-[#888888]">Code: {k.code}</span>}
                                    </DropdownItem>
                                ))}
                            </Dropdown>
                        )}
                    </div>
                    {kitError && kitSearch && (
                        <button
                            type="button"
                            onClick={() => handleAddKit({ id: `manual_${Date.now()}`, name: kitSearch, price: 0 })}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                        >
                            + Add &ldquo;{kitSearch}&rdquo; as custom item
                        </button>
                    )}
                    {selectedKits.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {selectedKits.map((kit) => (
                                <div key={kit.id} className="flex items-center gap-2 bg-slate-50 dark:bg-[#1a1a1a] rounded-lg p-3 border border-slate-200 dark:border-[#2a2a2a]">
                                    <span className="flex-1 text-sm font-medium text-slate-900 dark:text-white truncate">{kit.name}</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number" min="1" value={kit.quantity}
                                            onChange={(e) => setSelectedKits((kits) => kits.map((k) => k.id === kit.id
                                                ? { ...k, quantity: Math.max(1, Number(e.target.value)) } : k))}
                                            className="w-14 input py-1 text-xs text-center"
                                        />
                                        <span className="text-xs text-slate-500 dark:text-[#888888]">qty</span>
                                        <input
                                            type="number" step="0.01" min="0" value={kit.unitPrice}
                                            onChange={(e) => setSelectedKits((kits) => kits.map((k) => k.id === kit.id
                                                ? { ...k, unitPrice: Math.max(0, Number(e.target.value)) } : k))}
                                            className="w-20 input py-1 text-xs text-center"
                                        />
                                        <span className="text-xs text-slate-500 dark:text-[#888888]">₹</span>
                                    </div>
                                    <button type="button" onClick={() => setSelectedKits((kits) => kits.filter((k) => k.id !== kit.id))}>
                                        <Trash2 className="w-3.5 h-3.5 text-rose-400 hover:text-rose-600 transition-colors" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </FormCard>

                {/* Notes */}
                <FormCard title="Notes" icon={FileText}>
                    <textarea
                        className="input resize-none"
                        rows={4}
                        placeholder="Clinical notes, allergies, special requirements…"
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value.slice(0, 1000) }))}
                    />
                </FormCard>
            </div>

            {/* Bottom action row mirrors the top for tall pages */}
            <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => navigate('/cases')} className="btn-secondary">Cancel</button>
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {submitting ? 'Creating…' : 'Create Booking'}
                </button>
            </div>
        </div>
    );
}

// ─── Form scaffolding ─────────────────────────────────────────────────────────

function FormCard({ title, icon: Icon, required, children }) {
    return (
        <div className="rounded-lg bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] p-5">
            <div className="flex items-center gap-2 mb-3">
                {Icon && (
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#1a1a1a] flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-[#888888]" />
                    </div>
                )}
                <h3 className="text-xs font-bold text-slate-500 dark:text-[#888888] uppercase tracking-wider">
                    {title}
                </h3>
                {required && <span className="text-rose-400 text-xs">*</span>}
            </div>
            <div className="relative">{children}</div>
        </div>
    );
}

function SearchField({ placeholder, value, onChange, onFocus, loading }) {
    return (
        <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={onFocus}
                className="input pl-9 pr-9"
            />
            {loading && (
                <Loader2 className="w-3.5 h-3.5 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />
            )}
        </div>
    );
}

function Dropdown({ children }) {
    return (
        <div className="absolute top-full mt-1.5 w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#2a2a2a] rounded-lg shadow-xl z-20 max-h-52 overflow-y-auto">
            {children}
        </div>
    );
}

function DropdownItem({ onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-500/10 border-b border-slate-50 dark:border-[#1a1a1a] last:border-b-0 flex flex-col gap-0.5 transition-colors"
        >
            {children}
        </button>
    );
}

function SelectedTag({ label, sub, onClear }) {
    return (
        <div className="mt-2.5 flex items-center justify-between bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg px-3.5 py-2.5">
            <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 leading-tight">{label}</p>
                {sub && <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">{sub}</p>}
            </div>
            <button
                type="button"
                onClick={onClear}
                className="text-blue-300 hover:text-blue-600 dark:text-blue-400/60 dark:hover:text-blue-400 ml-3 transition-colors"
            >
                <X className="w-3.5 h-3.5" />
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
            <div className="flex flex-col items-center justify-center gap-2 py-10 rounded-lg border-2 border-dashed border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#0d0d0d]">
                <Calendar className="w-5 h-5 text-slate-300 dark:text-[#444]" />
                <p className="text-sm text-slate-400 dark:text-[#666666] text-center">
                    Set a start and end time above to see room availability
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-24 rounded-lg bg-slate-100 dark:bg-[#1a1a1a] animate-pulse" />
                ))}
            </div>
        );
    }

    if (hmsDown) {
        return (
            <div className="space-y-3">
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                        Room availability is unavailable. Enter a room name manually.
                    </p>
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
                    className="input"
                />
            </div>
        );
    }

    if (!rooms || rooms.length === 0) {
        return (
            <div className="py-10 text-center text-sm text-slate-400 dark:text-[#666666] rounded-lg bg-slate-50 dark:bg-[#0d0d0d] border border-slate-200 dark:border-[#1e1e1e]">
                No OT rooms configured in HMS
            </div>
        );
    }

    const available = rooms.filter((r) => r.available);
    const occupied = rooms.filter((r) => !r.available);

    return (
        <div className="space-y-4">
            {available.length === 0 && (
                <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-center">
                    <Lock className="w-4 h-4 mx-auto text-rose-400 mb-1.5" />
                    <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">No rooms available for this time slot</p>
                    <p className="text-xs text-rose-500 dark:text-rose-400/70 mt-0.5">All rooms are occupied or booked. Try a different time.</p>
                </div>
            )}

            {available.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                            Available — {available.length} room{available.length > 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                        {available.map((room) => (
                            <RoomCard
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
                <div>
                    <div className="flex items-center gap-2 mb-2.5">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <p className="text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wide">
                            Unavailable — {occupied.length} room{occupied.length > 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                        {occupied.map((room) => (
                            <RoomCard key={room.id} room={room} selected={false} onSelect={() => {}} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function RoomCard({ room, selected, onSelect }) {
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
                className={[
                    'relative w-full rounded-lg border-2 p-3 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                    selected
                        ? 'border-emerald-500 bg-emerald-500 shadow-md'
                        : 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 hover:border-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20',
                ].join(' ')}
            >
                <p className={`text-sm font-bold truncate ${selected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {roomLabel}
                </p>
                {room.ward && (
                    <p className={`text-xs mt-0.5 ${selected ? 'text-emerald-100' : 'text-slate-500 dark:text-[#888888]'}`}>
                        {room.ward}
                    </p>
                )}
                <div className="mt-2 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selected ? 'bg-white' : 'bg-emerald-500'}`} />
                    <span className={`text-xs font-semibold ${selected ? 'text-emerald-100' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {selected ? 'Selected' : 'Free'}
                    </span>
                    {selected && <CheckCircle2 className="w-3 h-3 ml-auto text-white" />}
                </div>
            </button>
        );
    }

    const cardCls = isInProgress
        ? 'border-rose-100 dark:border-rose-500/20 bg-rose-50/70 dark:bg-rose-500/5'
        : isSanitation
            ? 'border-amber-100 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/5'
            : isHmsOccupied
                ? 'border-slate-200 dark:border-[#2a2a2a] bg-slate-50/70 dark:bg-[#1a1a1a]'
                : 'border-blue-100 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-500/5';

    const badgeCls = isInProgress
        ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
        : isSanitation
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
            : isHmsOccupied
                ? 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400';

    const dotCls = isInProgress
        ? 'bg-rose-500 animate-pulse'
        : isSanitation
            ? 'bg-amber-500'
            : isHmsOccupied
                ? 'bg-slate-400'
                : 'bg-blue-500';

    const statusLabel = isInProgress ? 'In Progress' : isSanitation ? 'Cleaning' : isHmsOccupied ? 'In Use' : 'Booked';

    return (
        <div className={`rounded-lg border-2 p-3 cursor-not-allowed select-none ${cardCls}`}>
            <p className="text-sm font-bold text-slate-600 dark:text-[#888888] truncate">{roomLabel}</p>
            <div className={`mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold ${badgeCls}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
                {statusLabel}
            </div>
            {room.occupiedBy && (
                <p className="text-xs text-slate-500 dark:text-[#888888] mt-1.5 truncate leading-snug">{room.occupiedBy}</p>
            )}
            {freeLabel && (
                <p className="text-xs text-slate-400 dark:text-[#666666] mt-0.5">{freeLabel}</p>
            )}
        </div>
    );
}
