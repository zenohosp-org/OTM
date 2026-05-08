import { createContext, useState, useCallback, useEffect } from 'react';
import { getMyProfile, logout as apiLogout } from '../api/client';
import api from '../api/client';

export const AuthContext = createContext(null);
const LOGOUT_FLAG_KEY = 'sso_logout_flag';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (import.meta.env.VITE_DEV_MOCK_AUTH === 'true') {
            setUser({
                userId: import.meta.env.VITE_MOCK_USER_ID || '1',
                email: import.meta.env.VITE_MOCK_USER_EMAIL || 'dev@zenohosp.com',
                role: import.meta.env.VITE_MOCK_USER_ROLE || 'super_admin',
                hospitalId: import.meta.env.VITE_MOCK_HOSPITAL_ID || 'e1b924ba-3cac-426d-a775-3c978fd95490',
                modules: ['ot'],
            });
            setLoading(false);
            return;
        }

        const justLoggedOut = localStorage.getItem(LOGOUT_FLAG_KEY);
        if (justLoggedOut) {
            localStorage.removeItem(LOGOUT_FLAG_KEY);
            sessionStorage.removeItem('ot_user');
            setUser(null);
            setLoading(false);
            return;
        }

        getMyProfile()
            .then((res) => {
                const userData = res.data;
                sessionStorage.setItem('ot_user', JSON.stringify(userData));
                setUser(userData);
            })
            .catch(() => {
                sessionStorage.removeItem('ot_user');
                setUser(null);
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const verifyOnFocus = async () => {
            if (!user) return;
            if (import.meta.env.VITE_DEV_MOCK_AUTH === 'true') return;
            try {
                await getMyProfile();
            } catch {
                sessionStorage.removeItem('ot_user');
                setUser(null);
                window.location.href = '/login?logged_out=1';
            }
        };

        window.addEventListener('focus', verifyOnFocus);
        return () => window.removeEventListener('focus', verifyOnFocus);
    }, [user]);

    useEffect(() => {
        const handleStorageChange = (event) => {
            if (event.key === 'sso-logout') {
                sessionStorage.removeItem('ot_user');
                setUser(null);
                window.location.href = '/login?logged_out=1';
            }
        };

        const handleCustomLogoutEvent = () => {
            sessionStorage.removeItem('ot_user');
            setUser(null);
            window.location.href = '/login?logged_out=1';
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('sso-logout', handleCustomLogoutEvent);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('sso-logout', handleCustomLogoutEvent);
        };
    }, []);

    const logout = useCallback(async () => {
        localStorage.setItem(LOGOUT_FLAG_KEY, '1');
        sessionStorage.removeItem('ot_user');
        setUser(null);

        try {
            localStorage.setItem('sso-logout', `${Date.now()}`);
            window.dispatchEvent(new Event('sso-logout'));
        } catch (e) { }

        try {
            await apiLogout();
        } catch (e) {
            console.error("OT logout failed", e);
        }

        window.location.href = '/login?logged_out=1';
    }, []);

    const validateSession = useCallback(async () => {
        try {
            const res = await getMyProfile();
            sessionStorage.removeItem('ot_auth_redirect_lock');
            const userData = res.data;
            sessionStorage.setItem('ot_user', JSON.stringify(userData));
            setUser(userData);
            localStorage.removeItem(LOGOUT_FLAG_KEY);
            return true;
        } catch (err) {
            console.error('Session validation failed:', err);
            setUser(null);
            return false;
        }
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                logout,
                validateSession,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

