import { useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function SsoCallback() {
    const { validateSession } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const completeAuth = async () => {
            const success = await validateSession();
            navigate(success ? '/dashboard' : '/login', { replace: true });
        };
        completeAuth();
    }, [validateSession, navigate]);

    return (
        <div className="auth-shell">
            <div className="z-page-loader">
                <Loader2 />
                <span>Completing sign-in…</span>
            </div>
        </div>
    );
}
