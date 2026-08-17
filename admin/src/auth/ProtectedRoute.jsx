// Nothing inside the dashboard renders until the session is confirmed.
//
// This is a convenience gate, not the security boundary — the real one is
// requireAdmin on the server. Someone can always edit their own JavaScript;
// they cannot forge a signed token.

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute() {
    const { isAuthenticated, restoring } = useAuth();
    const location = useLocation();

    // On a hard reload the refresh call is still in flight. Redirecting now
    // would kick a perfectly valid session out to the login page.
    if (restoring) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
                <div className="flex flex-col items-center gap-3">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-600" />
                    <p className="text-sm text-gray-400">Checking your session…</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        // `state.from` lets the login page drop you back where you were headed.
        return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
    }

    return <Outlet />;
}
