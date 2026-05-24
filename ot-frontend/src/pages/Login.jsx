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
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-[#0f0f0f] px-4">
            <div className="w-full max-w-md">
                <div className="card p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center">
                            <Activity className="w-5 h-5 text-white dark:text-slate-900" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-[#888888]">ZenoHosp</p>
                            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">OT Management</h1>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Welcome back</h2>
                    <p className="text-sm text-slate-500 dark:text-[#888888] mb-8">
                        Sign in with your ZenoHosp Directory account to continue.
                    </p>

                    <button onClick={handleLogin} className="btn-primary w-full">
                        Sign in with SSO
                        <ArrowRight className="w-4 h-4" />
                    </button>

                    <p className="text-center text-xs text-slate-400 dark:text-[#666666] mt-6">
                        You will be redirected to Directory SSO.
                    </p>
                </div>

                <p className="text-center text-xs text-slate-400 dark:text-[#666666] mt-6">
                    Operating Theater Room Management · v1.0
                </p>
            </div>
        </div>
    );
}
