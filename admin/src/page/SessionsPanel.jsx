// Every device currently holding a live sign-in.
//
// Only the owner can be in here, so anything listed that the owner doesn't
// recognise is the signal that a password needs changing — and "Sign out
// everywhere" is the button that ends it, immediately, on every device.

import { useCallback, useEffect, useState } from "react";
import { Loader2, LogOut, MonitorSmartphone, X } from "lucide-react";

import { fetchSessions, revokeSessionRequest, errorMessage } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

/** "Chrome on Windows" out of a user-agent string, or a shrug. */
function describeDevice(userAgent) {
    if (!userAgent) return "Unknown device";

    const browser =
        /Edg\//.test(userAgent) ? "Edge"
        : /OPR\//.test(userAgent) ? "Opera"
        : /Chrome\//.test(userAgent) ? "Chrome"
        : /Safari\//.test(userAgent) ? "Safari"
        : /Firefox\//.test(userAgent) ? "Firefox"
        : "Browser";

    const platform =
        /Windows/.test(userAgent) ? "Windows"
        : /Android/.test(userAgent) ? "Android"
        : /iPhone|iPad/.test(userAgent) ? "iOS"
        : /Mac OS X/.test(userAgent) ? "macOS"
        : /Linux/.test(userAgent) ? "Linux"
        : "";

    return platform ? `${browser} on ${platform}` : browser;
}

function formatWhen(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
    });
}

export default function SessionsPanel({ onClose }) {
    const { logoutEverywhere } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setSessions(await fetchSessions());
        } catch (requestError) {
            setError(errorMessage(requestError, "Unable to load your sessions."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        function onKeyDown(event) {
            if (event.key === "Escape") onClose();
        }
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    async function revoke(sessionId) {
        setBusyId(sessionId);
        try {
            await revokeSessionRequest(sessionId);
            setSessions((prev) => prev.filter((session) => session.id !== sessionId));
        } catch (requestError) {
            setError(errorMessage(requestError, "Unable to sign that device out."));
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Signed-in devices"
                className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
            >
                <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
                    <div>
                        <p className="text-sm font-semibold text-gray-900">Signed-in devices</p>
                        <p className="mt-0.5 text-xs text-gray-400">
                            Sessions expire after 7 days, or 30 minutes of inactivity.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="max-h-[340px] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-gray-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading…
                        </div>
                    ) : error ? (
                        <div className="px-5 py-8 text-center">
                            <p className="text-sm text-red-600">{error}</p>
                            <button
                                onClick={load}
                                className="mt-3 text-xs font-medium text-emerald-700 hover:underline"
                            >
                                Try again
                            </button>
                        </div>
                    ) : sessions.length === 0 ? (
                        <p className="px-5 py-12 text-center text-sm text-gray-400">
                            No other sessions.
                        </p>
                    ) : (
                        sessions.map((session) => (
                            <div
                                key={session.id}
                                className="flex items-start gap-3 border-b border-gray-50 px-5 py-3.5 last:border-b-0"
                            >
                                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                                    <MonitorSmartphone className="h-4 w-4" strokeWidth={1.8} />
                                </span>

                                <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-2 text-sm font-medium text-gray-800">
                                        {describeDevice(session.userAgent)}
                                        {session.current && (
                                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                                This device
                                            </span>
                                        )}
                                    </p>
                                    <p className="mt-0.5 text-xs text-gray-400">
                                        {session.ipAddress || "IP unknown"} · signed in {formatWhen(session.createdAt)}
                                    </p>
                                </div>

                                {!session.current && (
                                    <button
                                        onClick={() => revoke(session.id)}
                                        disabled={busyId === session.id}
                                        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50"
                                    >
                                        {busyId === session.id ? "…" : "Revoke"}
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="border-t border-gray-100 px-5 py-3.5">
                    <button
                        onClick={logoutEverywhere}
                        className="flex items-center gap-2 text-sm font-medium text-red-600 hover:underline"
                    >
                        <LogOut className="h-4 w-4" />
                        Sign out everywhere
                    </button>
                    <p className="mt-1 text-xs text-gray-400">
                        Ends every session including this one, and invalidates tokens already issued.
                    </p>
                </div>
            </div>
        </div>
    );
}
