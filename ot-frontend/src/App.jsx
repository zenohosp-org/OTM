import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';
import SsoCallback from './pages/SsoCallback';
import Dashboard from './pages/Dashboard';
import OtBoard from './pages/OtBoard';
import Schedules from './pages/Schedules';
import Cases from './pages/Cases';
import NewBooking from './pages/NewBooking';
import BookingDetail from './pages/BookingDetail';
import Layout from './components/layout/Layout';

function App() {
    return (
        <ThemeProvider>
            <BrowserRouter>
                <AuthProvider>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/sso/callback" element={<SsoCallback />} />

                        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/ot-board" element={<OtBoard />} />
                            <Route path="/schedules" element={<Schedules />} />
                            <Route path="/cases" element={<Cases />} />
                            <Route path="/cases/new" element={<NewBooking />} />
                            <Route path="/cases/:id" element={<BookingDetail />} />
                        </Route>
                    </Routes>
                </AuthProvider>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;
