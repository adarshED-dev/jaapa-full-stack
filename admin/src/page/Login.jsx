// The only door into the admin panel.
//
// The server deliberately answers "Email or password is incorrect" whether the
// account is missing, disabled or the password is wrong, so this page never
// tries to be more helpful than that — guessing which half was wrong is
// exactly what an attacker wants to know.

import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { errorMessage } from "../lib/api";

export default function Login() {
    const { login, isAuthenticated, restoring, expiredNotice, clearExpiredNotice } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const emailRef = useRef(null);

    useEffect(() => {
        emailRef.current?.focus();
    }, []);

    // Wait for the silent restore before deciding anything — otherwise a
    // reload on /login would flash this form at an already signed-in owner.
    if (restoring) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-600" />
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to={location.state?.from || "/"} replace />;
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (submitting) return;

        setError("");
        clearExpiredNotice();
        setSubmitting(true);

        try {
            await login(email.trim(), password);
            navigate(location.state?.from || "/", { replace: true });
        } catch (requestError) {
            setError(errorMessage(requestError, "Unable to sign you in right now."));
            setPassword("");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8] px-4 py-10 font-sans antialiased">
            <div className="w-full max-w-[420px]">
                <div className="mb-7 flex flex-col items-center text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-white">
                        <ShieldCheck className="h-6 w-6" strokeWidth={1.8} />
                    </div>
                    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900">
                        Jaapa Admin
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Sign in to manage your store.
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
                    {expiredNotice && !error && (
                        <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} />
                            <span>{expiredNotice}</span>
                        </div>
                    )}

                    {error && (
                        <div
                            role="alert"
                            className="mb-5 flex items-start gap-2.5 rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-700"
                        >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                        <div>
                            <label
                                htmlFor="admin-email"
                                className="mb-1.5 block text-sm font-medium text-gray-700"
                            >
                                Email
                            </label>
                            <div className="relative">
                                <Mail
                                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                                    strokeWidth={1.8}
                                />
                                <input
                                    id="admin-email"
                                    ref={emailRef}
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="username"
                                    required
                                    disabled={submitting}
                                    placeholder="you@jaapa.in"
                                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
                                />
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="admin-password"
                                className="mb-1.5 block text-sm font-medium text-gray-700"
                            >
                                Password
                            </label>
                            <div className="relative">
                                <Lock
                                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                                    strokeWidth={1.8}
                                />
                                <input
                                    id="admin-password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyUp={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
                                    autoComplete="current-password"
                                    required
                                    disabled={submitting}
                                    placeholder="••••••••••"
                                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-10 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" strokeWidth={1.8} />
                                    ) : (
                                        <Eye className="h-4 w-4" strokeWidth={1.8} />
                                    )}
                                </button>
                            </div>
                            {capsLock && (
                                <p className="mt-1.5 text-xs text-amber-700">Caps Lock is on.</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={submitting || !email || !password}
                            className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-medium text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                    Signing in…
                                </>
                            ) : (
                                "Sign in"
                            )}
                        </button>
                    </form>
                </div>

                <p className="mt-5 text-center text-xs leading-relaxed text-gray-400">
                    This panel belongs to the store owner. Accounts are created from the
                    server, never from this page — there is no sign-up.
                </p>
            </div>
        </div>
    );
}
