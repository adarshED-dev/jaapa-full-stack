// Who is signed in, and everything that changes that answer.
//
// Session lifecycle
// -----------------
//   mount / reload  -> silentRestore(): asks the server to trade the httpOnly
//                      refresh cookie for a fresh access token. Succeeds only
//                      if a live session row still exists in admin_sessions.
//   login()         -> credentials in, access token in memory, cookie set.
//   logout()        -> session row revoked server-side, token dropped, the
//                      router sends you back to /login.
//   idle 30 min     -> automatic logout. An unattended laptop shouldn't stay
//                      inside the dashboard.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
    loginRequest,
    logoutRequest,
    logoutEverywhereRequest,
    refreshSession,
    onSessionLost,
    setAccessToken,
} from "../lib/api";

const AuthContext = createContext(null);

// Signed out after this long with no keyboard, mouse or scroll activity.
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const IDLE_EVENTS = ["mousedown", "keydown", "wheel", "touchstart", "scroll", "visibilitychange"];

export function AuthProvider({ children }) {
    const [admin, setAdmin] = useState(null);
    // `restoring` is the gate that stops the app flashing the login screen on
    // every reload while the refresh call is still in the air.
    const [restoring, setRestoring] = useState(true);
    const [expiredNotice, setExpiredNotice] = useState("");

    const idleTimer = useRef(null);

    const clearSession = useCallback((notice = "") => {
        setAccessToken(null);
        setAdmin(null);
        setExpiredNotice(notice);
    }, []);

    /* -------------------------------------------------------------- */
    /* Restore on load                                                 */
    /* -------------------------------------------------------------- */

    useEffect(() => {
        let cancelled = false;

        refreshSession()
            .then((data) => {
                if (!cancelled) setAdmin(data.admin);
            })
            .catch(() => {
                // No cookie, expired, or revoked — all mean "show the login
                // page", and none of them are worth an error message on a
                // first visit.
                if (!cancelled) setAdmin(null);
            })
            .finally(() => {
                if (!cancelled) setRestoring(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    /* -------------------------------------------------------------- */
    /* Server said the session is gone                                 */
    /* -------------------------------------------------------------- */

    useEffect(
        () =>
            onSessionLost(() => {
                clearSession("Your session expired. Please sign in again.");
            }),
        [clearSession]
    );

    /* -------------------------------------------------------------- */
    /* Actions                                                         */
    /* -------------------------------------------------------------- */

    const login = useCallback(async (email, password) => {
        const data = await loginRequest(email, password);
        setExpiredNotice("");
        setAdmin(data.admin);
        return data.admin;
    }, []);

    const logout = useCallback(async () => {
        try {
            await logoutRequest();
        } finally {
            clearSession();
        }
    }, [clearSession]);

    const logoutEverywhere = useCallback(async () => {
        try {
            await logoutEverywhereRequest();
        } finally {
            clearSession();
        }
    }, [clearSession]);

    /* -------------------------------------------------------------- */
    /* Idle timeout                                                    */
    /* -------------------------------------------------------------- */

    useEffect(() => {
        if (!admin) return undefined;

        function signOutIdle() {
            logoutRequest().finally(() => {
                clearSession("You were signed out after 30 minutes of inactivity.");
            });
        }

        function resetTimer() {
            // A backgrounded tab still fires visibilitychange; only count it
            // as activity when the tab is actually being looked at.
            if (document.visibilityState === "hidden") return;
            window.clearTimeout(idleTimer.current);
            idleTimer.current = window.setTimeout(signOutIdle, IDLE_LIMIT_MS);
        }

        resetTimer();
        for (const event of IDLE_EVENTS) {
            window.addEventListener(event, resetTimer, { passive: true });
        }

        return () => {
            window.clearTimeout(idleTimer.current);
            for (const event of IDLE_EVENTS) {
                window.removeEventListener(event, resetTimer);
            }
        };
    }, [admin, clearSession]);

    const value = useMemo(
        () => ({
            admin,
            isAuthenticated: Boolean(admin),
            restoring,
            expiredNotice,
            clearExpiredNotice: () => setExpiredNotice(""),
            login,
            logout,
            logoutEverywhere,
        }),
        [admin, restoring, expiredNotice, login, logout, logoutEverywhere]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used inside <AuthProvider>");
    }
    return context;
}
