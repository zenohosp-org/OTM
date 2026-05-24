import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getBookings, createBooking, addConsumptionItem,
    getHmsPatients, getHmsDoctors,
    getInventoryKits, getActiveAdmissions, getAvailableRooms,
    getHospitalServices,
} from '../api/client';
import {
    Plus, Search, Trash2, AlertCircle, CheckCircle2, XCircle,
    Calendar, Lock, Loader2, X,
} from 'lucide-react';

const STATUS_CONFIG = {
    REQUESTED:          { label: 'Requested',          classes: 'bg-gray-100 text-gray-700 border border-gray-200' },
    CONFIRMED:          { label: 'Confirmed',           classes: 'bg-blue-100 text-blue-800 border border-blue-200' },
    IN_PROGRESS:        { label: 'In Progress',         classes: 'bg-green-100 text-green-800 border border-green-200' },
    PENDING_SANITATION: { label: 'Pending Sanitation',  classes: 'bg-amber-100 text-amber-800 border border-amber-200' },
    COMPLETED:          { label: 'Completed',           classes: 'bg-slate-100 text-slate-700 border border-slate-200' },
    CANCELLED:          { label: 'Cancelled',           classes: 'bg-red-100 text-red-700 border border-red-200' },
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
    const [bookings, setBookings] = useState([]);
    const [admissions, setAdmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showDrawer, setShowDrawer] = useState(false);
    const [activeTab, setActiveTab] = useState('bookings');
    const [prefilledPatient, setPrefilledPatient] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchBookings();
        fetchAdmissions();
    }, []);

    const fetchBookings = async () => {
        try {
            const res = await getBookings({});
            setBookings(Array.isArray(res.data) ? res.data : []);
        } catch {
            setBookings([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchAdmissions = async () => {
        try {
            const res = await getActiveAdmissions();
            setAdmissions(Array.isArray(res.data) ? res.data : []);
        } catch {
            setAdmissions([]);
        }
    };

    const handleBookFromAdmission = (admission) => {
        setPrefilledPatient({
            patientId: admission.patientId,
            patientName: admission.patientName,
            patientMrn: admission.patientMrn,
            admissionId: admission.id,
        });
        setShowDrawer(true);
    };

    const activeAdmissions = admissions.filter(a =>
        !bookings.some(
            b => String(b.patientId) === String(a.patientId) &&
                 !['COMPLETED', 'CANCELLED'].includes(b.status)
        )
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={24} className="animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Cases</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage OT bookings and surgical cases</p>
                </div>
                <button
                    onClick={() => setShowDrawer(true)}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
                >
                    <Plus size={16} />
                    New Booking
                </button>
            </div>

            {/* Segmented tab control */}
            <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 gap-1">
                <button
                    onClick={() => setActiveTab('bookings')}
                    className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                        activeTab === 'bookings'
                            ? 'bg-white text-slate-900 ring-2 ring-blue-500 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Bookings
                    <span className={`ml-2 text-xs ${activeTab === 'bookings' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {bookings.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('awaiting')}
                    className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${
                        activeTab === 'awaiting'
                            ? 'bg-white text-slate-900 ring-2 ring-blue-500 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Awaiting OT
                    {activeAdmissions.length > 0 && (
                        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                            {activeAdmissions.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Tab content */}
            <section>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-gray-700">
                            {activeTab === 'bookings' ? 'All Bookings' : 'Admitted Patients Awaiting OT Booking'}
                        </h2>
                        <span className="text-xs text-gray-400">
                            {activeTab === 'bookings' ? `${bookings.length} total` : `${activeAdmissions.length} awaiting`}
                        </span>
                    </div>

                    {activeTab === 'bookings' ? (
                        bookings.length === 0 ? (
                            <div className="py-16 text-center">
                                <CheckCircle2 size={40} className="mx-auto text-gray-200 mb-3" />
                                <p className="text-gray-500 text-sm">No bookings yet</p>
                                <button
                                    onClick={() => setShowDrawer(true)}
                                    className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                    Create the first booking
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                            <th className="px-6 py-3">Patient</th>
                                            <th className="px-6 py-3">Procedure</th>
                                            <th className="px-6 py-3">Room</th>
                                            <th className="px-6 py-3">Surgeon</th>
                                            <th className="px-6 py-3">Schedule</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {bookings.map(booking => (
                                            <BookingRow
                                                key={booking.id}
                                                booking={booking}
                                                onClick={() => navigate(`/cases/${booking.id}`)}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    ) : (
                        activeAdmissions.length === 0 ? (
                            <div className="py-16 text-center">
                                <CheckCircle2 size={40} className="mx-auto text-gray-200 mb-3" />
                                <p className="text-gray-500 text-sm">No admitted patients awaiting OT booking</p>
                                <p className="text-gray-400 text-xs mt-1">All current admissions already have a booking in progress.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                            <th className="px-6 py-3">Patient</th>
                                            <th className="px-6 py-3">MRN</th>
                                            <th className="px-6 py-3">Room</th>
                                            <th className="px-6 py-3">Type</th>
                                            <th className="px-6 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {activeAdmissions.map(admission => (
                                            <AdmissionRow
                                                key={admission.id}
                                                admission={admission}
                                                onBook={() => handleBookFromAdmission(admission)}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>
            </section>

            {showDrawer && (
                <CreateBookingDrawer
                    prefilled={prefilledPatient}
                    admissions={admissions}
                    onClose={() => { setShowDrawer(false); setPrefilledPatient(null); }}
                    onSuccess={() => {
                        setShowDrawer(false);
                        setPrefilledPatient(null);
                        fetchBookings();
                        fetchAdmissions();
                    }}
                />
            )}
        </div>
    );
}

function AdmissionRow({ admission, onBook }) {
    const isOT = admission.roomType === 'OT';
    return (
        <tr className="hover:bg-gray-50 transition-colors">
            <td className="px-6 py-4">
                <p className="font-semibold text-gray-900">{admission.patientName}</p>
            </td>
            <td className="px-6 py-4 text-gray-700">{admission.patientMrn || '—'}</td>
            <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                    ${isOT ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {admission.roomNumber || 'No room'}
                </span>
            </td>
            <td className="px-6 py-4 text-xs text-gray-500 uppercase tracking-wide">{admission.roomType || '—'}</td>
            <td className="px-6 py-4 text-right">
                <button
                    onClick={onBook}
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                    <Plus size={13} />
                    Book for OT
                </button>
            </td>
        </tr>
    );
}

function BookingRow({ booking, onClick }) {
    return (
        <tr className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={onClick}>
            <td className="px-6 py-4">
                <p className="font-semibold text-gray-900">{booking.patientName}</p>
                {booking.patientMrn && (
                    <p className="text-xs text-gray-500 mt-0.5">MRN: {booking.patientMrn}</p>
                )}
            </td>
            <td className="px-6 py-4">
                <p className="text-gray-800">{booking.procedureName}</p>
                {booking.procedureCharge && (
                    <p className="text-xs text-gray-500 mt-0.5">
                        ₹{Number(booking.procedureCharge).toLocaleString('en-IN')}
                    </p>
                )}
            </td>
            <td className="px-6 py-4 text-gray-700">{booking.roomName}</td>
            <td className="px-6 py-4 text-gray-700">{booking.surgeonName}</td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-1.5">
                    <p className="text-gray-800">{formatDate(booking.scheduledStart)}</p>
                    {isToday(booking.scheduledStart) && (
                        <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-1.5 py-0.5 rounded">
                            Today
                        </span>
                    )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                    {formatTime(booking.scheduledStart)} – {formatTime(booking.scheduledEnd)}
                    <span className="ml-1 text-gray-400">
                        ({getDuration(booking.scheduledStart, booking.scheduledEnd)})
                    </span>
                </p>
            </td>
            <td className="px-6 py-4">
                <StatusBadge status={booking.status} />
            </td>
            <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                <button onClick={onClick} className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                    View
                </button>
            </td>
        </tr>
    );
}

// ─── Create Booking Drawer ─────────────────────────────────────────────────────

const MAX_RETRIES = 3;

function CreateBookingDrawer({ onClose, onSuccess, prefilled = null, admissions = [] }) {
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

    const [services, setServices] = useState([]);
    const [serviceSearch, setServiceSearch] = useState('');
    const [showServiceDrop, setShowServiceDrop] = useState(false);
    const [loadingServices, setLoadingServices] = useState(false);

    const kitRetry = useRef(null);

    const [form, setForm] = useState({
        patientId: prefilled?.patientId ?? '',
        patientName: prefilled?.patientName ?? '',
        patientMrn: prefilled?.patientMrn ?? '',
        admissionId: prefilled?.admissionId ?? null,
        procedureName: '',
        procedureCharge: '',
        hmsServiceId: '',
        roomId: '',
        roomName: '',
        surgeonId: '',
        surgeonName: '',
        scheduledStart: '',
        scheduledEnd: '',
        notes: '',
    });

    useEffect(() => {
        const fetchKits = async (retry = 0) => {
            if (retry === 0) setLoadingKits(true);
            setKitError(null);
            try {
                const res = await getInventoryKits();
                setAllKits(res.data || []);
            } catch {
                if (retry < MAX_RETRIES) {
                    setKitError('Loading inventory...');
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
            .then(res => setServices(Array.isArray(res.data) ? res.data.filter(s => s.isActive !== false) : []))
            .catch(() => setServices([]))
            .finally(() => setLoadingServices(false));
    }, []);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

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
        const activeAdmission = admissions.find(a => String(a.patientId) === String(p.id));
        setForm(f => ({
            ...f,
            patientId: p.id,
            patientName: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
            patientMrn: p.mrn || '',
            admissionId: activeAdmission?.id ?? null,
        }));
        setPatientSearch(''); setShowPatientDrop(false); setPatients([]);
    };

    const handleSurgeonSelect = (s) => {
        setForm(f => ({
            ...f,
            surgeonId: s.id || s.userId || '',
            surgeonName: s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
        }));
        setSurgeonSearch(''); setShowSurgeonDrop(false); setSurgeons([]);
    };

    const handleRoomSelect = (room) => {
        setForm(f => ({ ...f, roomId: room.id || 0, roomName: room.roomNumber || '' }));
    };

    const handleServiceSelect = (svc) => {
        setForm(f => ({
            ...f,
            procedureName: svc.name,
            procedureCharge: svc.price != null ? String(svc.price) : '',
            hmsServiceId: svc.id,
        }));
        setServiceSearch('');
        setShowServiceDrop(false);
    };

    const handleAddKit = (kit) => {
        if (selectedKits.find(k => k.id === kit.id)) return;
        setSelectedKits(prev => [...prev, { id: kit.id, name: kit.name, quantity: 1, unitPrice: kit.price || 0 }]);
        setKitSearch(''); setShowKitDrop(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.patientId) { setError('Please select a patient'); return; }
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
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create booking. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredKits = allKits.filter(k =>
        !kitSearch || k.name?.toLowerCase().includes(kitSearch.toLowerCase()) ||
        k.code?.toLowerCase().includes(kitSearch.toLowerCase())
    );

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
            <div className="fixed right-0 top-0 bottom-0 w-[540px] bg-white shadow-2xl z-50 flex flex-col">

                <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">New OT Booking</h2>
                            <p className="text-sm text-gray-500 mt-0.5">Schedule a surgical case for the operating theatre</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
                    {error && (
                        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                            <XCircle size={16} className="flex-shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}

                    {/* ── Patient ─────────────────────────────────────────── */}
                    <DrawerSection title="Patient" required>
                        <div className="relative">
                            <SearchField
                                placeholder="Search by name, MRN or phone…"
                                value={patientSearch}
                                onChange={v => { setPatientSearch(v); setShowPatientDrop(true); searchPatients(v); }}
                                onFocus={() => setShowPatientDrop(true)}
                                loading={searchingPatients}
                            />
                            {showPatientDrop && patients.length > 0 && (
                                <Dropdown>
                                    {patients.map(p => {
                                        const isInpatient = admissions.some(
                                            a => String(a.patientId) === String(p.id)
                                        );
                                        return (
                                            <DropdownItem key={p.id} onClick={() => handlePatientSelect(p)}>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900">
                                                        {p.name || `${p.firstName} ${p.lastName}`}
                                                    </span>
                                                    {isInpatient && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">
                                                            Inpatient
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-gray-500">
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
                                sub={`MRN: ${form.patientMrn}`}
                                onClear={() => setForm(f => ({ ...f, patientId: '', patientName: '', patientMrn: '' }))}
                            />
                        )}
                    </DrawerSection>

                    {/* ── Procedure ───────────────────────────────────────── */}
                    <DrawerSection title="Procedure" required>
                        <div className="space-y-2.5">
                            <div className="relative">
                                <SearchField
                                    placeholder={loadingServices ? 'Loading services…' : 'Search by procedure name…'}
                                    value={serviceSearch}
                                    onChange={v => { setServiceSearch(v); setShowServiceDrop(true); }}
                                    onFocus={() => setShowServiceDrop(true)}
                                    loading={loadingServices}
                                />
                                {showServiceDrop && services.length > 0 && (() => {
                                    const q = serviceSearch.toLowerCase();
                                    const filtered = services.filter(s =>
                                        !q || s.name?.toLowerCase().includes(q)
                                    );
                                    return filtered.length > 0 ? (
                                        <Dropdown>
                                            {filtered.map(svc => (
                                                <DropdownItem key={svc.id} onClick={() => handleServiceSelect(svc)}>
                                                    <span className="font-medium text-gray-900">{svc.name}</span>
                                                    {svc.price != null && (
                                                        <span className="text-xs text-green-600 font-semibold">
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
                                    onClear={() => setForm(f => ({ ...f, procedureName: '', procedureCharge: '', hmsServiceId: '' }))}
                                />
                            ) : (
                                <input
                                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Or type procedure name manually…"
                                    value={form.procedureName}
                                    onChange={e => setForm(f => ({ ...f, procedureName: e.target.value.slice(0, 300), hmsServiceId: '' }))}
                                />
                            )}
                            {form.procedureName && !form.hmsServiceId && (
                                <input
                                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    type="number" step="0.01" min="0"
                                    placeholder="Procedure charge (₹)"
                                    value={form.procedureCharge}
                                    onChange={e => setForm(f => ({ ...f, procedureCharge: e.target.value }))}
                                />
                            )}
                        </div>
                    </DrawerSection>

                    {/* ── Schedule ────────────────────────────────────────── */}
                    <DrawerSection title="Schedule" required>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">Start time</label>
                                <input
                                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    type="datetime-local"
                                    value={form.scheduledStart}
                                    onChange={e => setForm(f => ({
                                        ...f, scheduledStart: e.target.value, roomId: '', roomName: '',
                                    }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">End time</label>
                                <input
                                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    type="datetime-local"
                                    value={form.scheduledEnd}
                                    onChange={e => setForm(f => ({
                                        ...f, scheduledEnd: e.target.value, roomId: '', roomName: '',
                                    }))}
                                    required
                                />
                            </div>
                        </div>
                    </DrawerSection>

                    {/* ── OT Room ─────────────────────────────────────────── */}
                    <DrawerSection title="OT Room" required>
                        <RoomGrid
                            start={form.scheduledStart}
                            end={form.scheduledEnd}
                            selectedRoomId={form.roomId}
                            onSelect={handleRoomSelect}
                        />
                    </DrawerSection>

                    {/* ── Surgeon ─────────────────────────────────────────── */}
                    <DrawerSection title="Surgeon" required>
                        <div className="space-y-2.5">
                            <select
                                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                value={specialization}
                                onChange={e => { setSpecialization(e.target.value); setSurgeons([]); setSurgeonSearch(''); }}
                            >
                                <option value="">All Specializations</option>
                                <option>Cardiology</option>
                                <option>Orthopedics</option>
                                <option>Neurosurgery</option>
                                <option>General Surgery</option>
                                <option>ENT</option>
                                <option>Ophthalmology</option>
                                <option>Urology</option>
                                <option>Oncology</option>
                            </select>
                            <div className="relative">
                                <SearchField
                                    placeholder="Search by surgeon name…"
                                    value={surgeonSearch}
                                    onChange={v => { setSurgeonSearch(v); setShowSurgeonDrop(true); searchSurgeons(v); }}
                                    onFocus={() => setShowSurgeonDrop(true)}
                                    loading={searchingSurgeons}
                                />
                                {showSurgeonDrop && surgeons.length > 0 && (
                                    <Dropdown>
                                        {surgeons.map(s => (
                                            <DropdownItem key={s.id || s.userId} onClick={() => handleSurgeonSelect(s)}>
                                                <span className="font-medium text-gray-900">
                                                    {s.name || `${s.firstName} ${s.lastName}`}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {s.specialization && <span className="text-blue-600 mr-2">{s.specialization}</span>}
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
                                    onClear={() => setForm(f => ({ ...f, surgeonId: '', surgeonName: '' }))}
                                />
                            )}
                        </div>
                    </DrawerSection>

                    {/* ── Inventory Kits ──────────────────────────────────── */}
                    <DrawerSection title="Inventory Kits">
                        {kitError && (
                            <p className="text-xs text-amber-600 mb-2">{kitError}</p>
                        )}
                        <div className="relative">
                            <SearchField
                                placeholder={kitError ? 'Enter kit name…' : 'Search kits by name or code…'}
                                value={kitSearch}
                                onChange={v => { setKitSearch(v); if (!kitError) setShowKitDrop(true); }}
                                onFocus={() => { if (!kitError) setShowKitDrop(true); }}
                                loading={loadingKits}
                            />
                            {!kitError && showKitDrop && filteredKits.length > 0 && (
                                <Dropdown>
                                    {filteredKits.map(k => (
                                        <DropdownItem key={k.id} onClick={() => handleAddKit(k)}>
                                            <span className="font-medium text-gray-900">{k.name}</span>
                                            {k.code && <span className="text-xs text-gray-500">Code: {k.code}</span>}
                                        </DropdownItem>
                                    ))}
                                </Dropdown>
                            )}
                        </div>
                        {kitError && kitSearch && (
                            <button
                                type="button"
                                onClick={() => handleAddKit({ id: `manual_${Date.now()}`, name: kitSearch, price: 0 })}
                                className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                                + Add &ldquo;{kitSearch}&rdquo; as custom item
                            </button>
                        )}
                        {selectedKits.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {selectedKits.map(kit => (
                                    <div key={kit.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 border border-gray-200">
                                        <span className="flex-1 text-sm font-medium text-gray-900 truncate">{kit.name}</span>
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number" min="1" value={kit.quantity}
                                                onChange={e => setSelectedKits(kits => kits.map(k => k.id === kit.id
                                                    ? { ...k, quantity: Math.max(1, Number(e.target.value)) } : k))}
                                                className="w-14 border border-gray-300 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <span className="text-xs text-gray-500">qty</span>
                                            <input
                                                type="number" step="0.01" min="0" value={kit.unitPrice}
                                                onChange={e => setSelectedKits(kits => kits.map(k => k.id === kit.id
                                                    ? { ...k, unitPrice: Math.max(0, Number(e.target.value)) } : k))}
                                                className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <span className="text-xs text-gray-500">₹</span>
                                        </div>
                                        <button type="button" onClick={() => setSelectedKits(kits => kits.filter(k => k.id !== kit.id))}>
                                            <Trash2 size={14} className="text-red-400 hover:text-red-600" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </DrawerSection>

                    {/* ── Notes ───────────────────────────────────────────── */}
                    <DrawerSection title="Notes">
                        <textarea
                            className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            rows={3}
                            placeholder="Clinical notes, allergies, special requirements…"
                            value={form.notes}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value.slice(0, 1000) }))}
                        />
                    </DrawerSection>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0 bg-white">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={handleSubmit}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm shadow-sm"
                    >
                        {submitting ? 'Creating…' : 'Create Booking'}
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Room Availability Grid ────────────────────────────────────────────────────

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
            .then(res => { if (active) setRooms(Array.isArray(res.data) ? res.data : []); })
            .catch(() => { if (active) setHmsDown(true); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [start, end]);

    if (!start || !end) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
                <Calendar size={20} className="text-gray-300" />
                <p className="text-sm text-gray-400 text-center">
                    Set a start and end time above to see room availability
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
                ))}
            </div>
        );
    }

    if (hmsDown) {
        return (
            <div className="space-y-3">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <AlertCircle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700">
                        Room availability is unavailable. Enter a room name manually.
                    </p>
                </div>
                <input
                    type="text"
                    placeholder="e.g. OT-3, Theatre B…"
                    value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    onBlur={() => {
                        if (manualInput.trim()) onSelect({ id: 0, roomNumber: manualInput.trim(), available: true });
                    }}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && manualInput.trim()) {
                            onSelect({ id: 0, roomNumber: manualInput.trim(), available: true });
                        }
                    }}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>
        );
    }

    if (!rooms || rooms.length === 0) {
        return (
            <div className="py-8 text-center text-sm text-gray-400 rounded-xl bg-gray-50 border border-gray-200">
                No OT rooms configured in HMS
            </div>
        );
    }

    const available = rooms.filter(r => r.available);
    const occupied = rooms.filter(r => !r.available);

    return (
        <div className="space-y-4">
            {available.length === 0 && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-center">
                    <Lock size={16} className="mx-auto text-red-400 mb-1.5" />
                    <p className="text-sm font-semibold text-red-700">No rooms available for this time slot</p>
                    <p className="text-xs text-red-500 mt-0.5">All rooms are occupied or booked. Try a different time.</p>
                </div>
            )}

            {available.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2.5">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                            Available — {available.length} room{available.length > 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {available.map(room => (
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
                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Unavailable — {occupied.length} room{occupied.length > 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {occupied.map(room => (
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
                    'relative w-full rounded-xl border-2 p-3 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                    selected
                        ? 'border-green-500 bg-green-500 shadow-md'
                        : 'border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100 hover:shadow-sm',
                ].join(' ')}
            >
                <p className={`text-sm font-bold truncate ${selected ? 'text-white' : 'text-gray-900'}`}>
                    {roomLabel}
                </p>
                {room.ward && (
                    <p className={`text-xs mt-0.5 ${selected ? 'text-green-100' : 'text-gray-500'}`}>
                        {room.ward}
                    </p>
                )}
                <div className="mt-2 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selected ? 'bg-white' : 'bg-green-500'}`} />
                    <span className={`text-xs font-semibold ${selected ? 'text-green-100' : 'text-green-700'}`}>
                        {selected ? 'Selected' : 'Free'}
                    </span>
                    {selected && <CheckCircle2 size={12} className="ml-auto text-white" />}
                </div>
            </button>
        );
    }

    const cardCls = isInProgress
        ? 'border-red-100 bg-red-50/70'
        : isSanitation
            ? 'border-amber-100 bg-amber-50/70'
            : isHmsOccupied
                ? 'border-slate-200 bg-slate-50/70'
                : 'border-blue-100 bg-blue-50/70';

    const badgeCls = isInProgress
        ? 'bg-red-100 text-red-700'
        : isSanitation
            ? 'bg-amber-100 text-amber-700'
            : isHmsOccupied
                ? 'bg-slate-100 text-slate-600'
                : 'bg-blue-100 text-blue-700';

    const dotCls = isInProgress
        ? 'bg-red-500 animate-pulse'
        : isSanitation
            ? 'bg-amber-500'
            : isHmsOccupied
                ? 'bg-slate-400'
                : 'bg-blue-500';

    const statusLabel = isInProgress ? 'In Progress' : isSanitation ? 'Cleaning' : isHmsOccupied ? 'In Use' : 'Booked';

    return (
        <div className={`rounded-xl border-2 p-3 cursor-not-allowed select-none ${cardCls}`}>
            <p className="text-sm font-bold text-gray-600 truncate">{roomLabel}</p>
            <div className={`mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold ${badgeCls}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
                {statusLabel}
            </div>
            {room.occupiedBy && (
                <p className="text-xs text-gray-500 mt-1.5 truncate leading-snug">{room.occupiedBy}</p>
            )}
            {freeLabel && (
                <p className="text-xs text-gray-400 mt-0.5">{freeLabel}</p>
            )}
        </div>
    );
}

// ─── Shared form primitives ────────────────────────────────────────────────────

function DrawerSection({ title, required, children }) {
    return (
        <div>
            <div className="flex items-center gap-1 mb-2.5">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</h3>
                {required && <span className="text-red-400 text-xs">*</span>}
            </div>
            <div className="relative">{children}</div>
        </div>
    );
}

function SearchField({ placeholder, value, onChange, onFocus, loading }) {
    return (
        <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                onFocus={onFocus}
                className="w-full border border-gray-300 rounded-xl pl-9 pr-9 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {loading && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <Loader2 size={14} className="animate-spin text-blue-500" />
                </div>
            )}
        </div>
    );
}

function Dropdown({ children }) {
    return (
        <div className="absolute top-full mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-52 overflow-y-auto">
            {children}
        </div>
    );
}

function DropdownItem({ onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-b-0 flex flex-col gap-0.5 transition-colors"
        >
            {children}
        </button>
    );
}

function SelectedTag({ label, sub, onClear }) {
    return (
        <div className="mt-2.5 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2.5">
            <div>
                <p className="text-sm font-semibold text-blue-900 leading-tight">{label}</p>
                {sub && <p className="text-xs text-blue-500 mt-0.5">{sub}</p>}
            </div>
            <button
                type="button"
                onClick={onClear}
                className="text-blue-300 hover:text-blue-600 ml-3 transition-colors"
            >
                <X size={14} />
            </button>
        </div>
    );
}
