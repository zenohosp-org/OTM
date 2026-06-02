import { useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { Activity, ArrowRight } from 'lucide-react';

export default function Login() {
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            window.location.href = '/dashboard';
            return;
        }
        if (import.meta.env.VITE_DEV_MOCK_AUTH === 'true') {
            window.location.href = '/dashboard';
            return;
        }
    }, [user]);

    const handleLogin = () => {
        const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://api-ot.zenohosp.com';
        window.location.href = `${backendUrl}/oauth2/authorization/directory`;
    };

    return (
        <div className="auth-shell">
            <div className="auth-card">
                <div className="auth-brand">
                    <div className="auth-brand-mark">
                        <Activity />
                    </div>
                    <div className="auth-brand-text">
                        <p className="auth-brand-overline">ZenoHosp</p>
                        <p className="auth-brand-title">OT Management</p>
                    </div>
                </div>

                <h2 className="auth-title">Welcome back</h2>
                <p className="auth-description">
                    Sign in with your ZenoHosp Directory account to continue.
                </p>

                <button onClick={handleLogin} className="z-btn-primary is-full is-lg">
                    Sign in with SSO
                    <ArrowRight className="u-w-4 u-h-4" />
                </button>

                <p className="auth-footer-note">
                    You will be redirected to Directory SSO.
                </p>
            </div>

            <p className="auth-version">
                Operating Theater Room Management · v1.0
            </p>
        </div>
    );
}
