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
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-[#0f0f0f]">
            <div className="flex items-center gap-3 text-slate-600 dark:text-[#888888]">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-semibold">Completing sign-in…</span>
            </div>
        </div>
    );
}
