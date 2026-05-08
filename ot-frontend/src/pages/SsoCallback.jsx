import { useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';

export default function SsoCallback() {
    const { validateSession } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const completeAuth = async () => {
            const success = await validateSession();
            if (success) {
                navigate('/dashboard', { replace: true });
            } else {
                navigate('/login', { replace: true });
            }
        };

        completeAuth();
    }, [validateSession, navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <h2 className="text-2xl font-semibold mb-4 text-black">Completing sign-in...</h2>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
        </div>
    );
}
