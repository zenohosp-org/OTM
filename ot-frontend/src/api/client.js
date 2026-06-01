import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 8000,
});

if (import.meta.env.VITE_DEV_MOCK_AUTH === 'true' && import.meta.env.VITE_MOCK_JWT) {
    api.interceptors.request.use((config) => {
        config.headers.Authorization = `Bearer ${import.meta.env.VITE_MOCK_JWT}`;
        return config;
    });
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const shouldRetry = (error, config) => {
    const retryCount = config.__retryCount || 0;
    if (retryCount >= MAX_RETRIES) return false;
    const status = error.response?.status;
    return [502, 503, 504].includes(status) || !error.response || error.code === 'ECONNABORTED';
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config;
        const status = error.response?.status;

        // Unauthenticated: kick off the SSO dance via the backend's OAuth2
        // authorization endpoint. The backend will redirect to the Directory
        // login page, then bounce back here with a session cookie.
        // Skip on /login (so the explicit logout landing page stays visible)
        // and on /sso/callback (so the callback can surface its own error).
        if (status === 401 || status === 403) {
            const path = window.location.pathname;
            const onLogin = path === '/login' || path.startsWith('/login');
            const onCallback = path.startsWith('/sso/callback');
            if (!onLogin && !onCallback) {
                window.location.href = `${API_BASE_URL}/oauth2/authorization/directory`;
                // Hang the promise — browser is about to navigate away anyway.
                return new Promise(() => {});
            }
            return Promise.reject(error);
        }

        if (shouldRetry(error, config)) {
            config.__retryCount = (config.__retryCount || 0) + 1;
            const delay = RETRY_DELAY * Math.pow(2, config.__retryCount - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            return api(config);
        }

        return Promise.reject(error);
    }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const getMyProfile = () => api.get('/api/user/me');
export const logout = () => api.post('/api/auth/logout');

// ─── OT Bookings ──────────────────────────────────────────────────────────────
export const createBooking = (data) => api.post('/api/ot/bookings', data);
export const getBookings = (params) => api.get('/api/ot/bookings', { params });
export const getBooking = (id) => api.get(`/api/ot/bookings/${id}`);
export const updateBooking = (id, data) => api.put(`/api/ot/bookings/${id}`, data);
export const confirmBooking = (id) => api.patch(`/api/ot/bookings/${id}/confirm`);
export const startBooking = (id) => api.patch(`/api/ot/bookings/${id}/start`);
export const endBooking = (id, data) => api.patch(`/api/ot/bookings/${id}/end`, data || {});
export const sanitizeBooking = (id) => api.patch(`/api/ot/bookings/${id}/sanitize`);
export const cancelBooking = (id) => api.patch(`/api/ot/bookings/${id}/cancel`);

// ─── Consumption ──────────────────────────────────────────────────────────────
export const getConsumption = (bookingId) => api.get(`/api/ot/bookings/${bookingId}/consumption`);
export const addConsumptionItem = (bookingId, data) => api.post(`/api/ot/bookings/${bookingId}/consumption`, data);
// Correct path: /api/ot/bookings/consumption/{itemId}
export const deleteConsumptionItem = (itemId) => api.delete(`/api/ot/bookings/consumption/${itemId}`);

// ─── HMS Proxy ────────────────────────────────────────────────────────────────
export const getHmsRooms = () => api.get('/api/proxy/hms/rooms');
export const getAvailableRooms = (start, end, excludeBookingId) =>
    api.get('/api/proxy/hms/rooms/available', { params: { start, end, excludeBookingId } });

// All active admissions in the hospital (any room type) — for OT booking eligibility
export const getActiveAdmissions = () => api.get('/api/proxy/hms/admissions');

// Admissions already in OT rooms — for OT board / Schedules view
export const getOtAdmissions = () => api.get('/api/proxy/hms/ot-admissions');

export const getHmsPatients = (search) => api.get('/api/proxy/hms/patients', { params: { search } });
export const getHmsDoctors = (search, specialization) =>
    api.get('/api/proxy/hms/doctors', { params: { search, specialization } });

export const movePatientToOT = (admissionId, data) =>
    api.patch(`/api/proxy/hms/admissions/${admissionId}/move-to-ot`, data);
export const returnPatientFromOT = (admissionId, data) =>
    api.patch(`/api/proxy/hms/admissions/${admissionId}/return-from-ot`, data || {});

// ─── HMS Procedures & Rooms ───────────────────────────────────────────────────
export const getHospitalServices = () => api.get('/api/proxy/hms/hospital-services');
export const getPostOtRooms = () => api.get('/api/proxy/hms/rooms/post-ot');

// ─── HMS Patient / Admission (emergency) ──────────────────────────────────────
export const createHmsPatient = (data) => api.post('/api/proxy/hms/patients', data);
export const createHmsAdmission = (data) => api.post('/api/proxy/hms/admissions', data);
export const getPatientAdmissions = (patientId) => api.get(`/api/proxy/hms/admissions/patient/${patientId}`);

// ─── Directory Proxy ──────────────────────────────────────────────────────────
export const getDirectorySurgeons = (search) =>
    api.get('/api/proxy/directory/surgeons', { params: { search } });

// ─── Inventory Proxy ──────────────────────────────────────────────────────────
export const getInventoryKits = () => api.get('/api/proxy/inventory/kits');
export const createInventoryKit = (data) => api.post('/api/proxy/inventory/kits', data);
export const updateInventoryKit = (id, data) => api.put(`/api/proxy/inventory/kits/${id}`, data);
export const deleteInventoryKit = (id) => api.delete(`/api/proxy/inventory/kits/${id}`);
export const consumeInventoryKit = (id, data) => api.post(`/api/proxy/inventory/kits/${id}/consume`, data);
export const getInventoryKitConsumptions = () => api.get('/api/proxy/inventory/kits/consumptions');

export default api;
