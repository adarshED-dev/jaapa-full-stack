// The one axios instance the whole admin panel talks through.
//
// Why everything must go through here:
//
//   1. The access token lives in a module variable, never in localStorage or
//      sessionStorage. Anything a script on the page can read, a script that
//      shouldn't be on the page can read too. Reloading the tab throws the
//      token away — the httpOnly refresh cookie is what brings the session
//      back, and JavaScript can't touch that.
//
//   2. Access tokens last 15 minutes. When one expires mid-click the response
//      interceptor below quietly gets a new one and replays the request, so
//      the owner is never bounced to the login screen in the middle of saving
//      a product.
//
//   3. `withCredentials` has to be on for the refresh cookie to travel at all.

import axios from "axios";

// Relative by default: in development Vite proxies /api to the backend (see
// vite.config.js), which keeps API calls same-origin so the SameSite=Lax
// refresh cookie is actually sent. Set VITE_API_URL only when the API lives
// on a different host in production — and if you do, the backend needs
// NODE_ENV=production so the cookie goes out as SameSite=None; Secure.
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const AUTH_URL = `${API_BASE_URL}/admin/auth`;

/* ------------------------------------------------------------------ */
/* Access token — in memory only                                       */
/* ------------------------------------------------------------------ */

let accessToken = null;

export function setAccessToken(token) {
    accessToken = token || null;
}

export function getAccessToken() {
    return accessToken;
}

/* ------------------------------------------------------------------ */
/* Session-lost broadcast                                              */
/* ------------------------------------------------------------------ */

// When the refresh cookie is gone or revoked there is nothing left to retry
// with. AuthContext subscribes to this and sends the owner back to /login.
const sessionLostHandlers = new Set();

export function onSessionLost(handler) {
    sessionLostHandlers.add(handler);
    return () => sessionLostHandlers.delete(handler);
}

function broadcastSessionLost() {
    setAccessToken(null);
    for (const handler of sessionLostHandlers) handler();
}

/* ------------------------------------------------------------------ */
/* Instances                                                           */
/* ------------------------------------------------------------------ */

export const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

// A bare instance for the auth calls themselves. Using `api` for the refresh
// request would let a failed refresh trigger another refresh, and so on.
const authClient = axios.create({
    baseURL: AUTH_URL,
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

/* ------------------------------------------------------------------ */
/* Refresh — one in flight at a time                                   */
/* ------------------------------------------------------------------ */

// Three widgets loading at once will all 401 together. Without this they would
// fire three refreshes, and since the server rotates the token on every use,
// two of them would present a token that the first call had already killed —
// logging the owner out for being logged in twice. One promise, shared.
let refreshInFlight = null;

export function refreshSession() {
    if (!refreshInFlight) {
        refreshInFlight = authClient
            .post("/refresh")
            .then((response) => {
                setAccessToken(response.data.accessToken);
                return response.data;
            })
            .finally(() => {
                refreshInFlight = null;
            });
    }
    return refreshInFlight;
}

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;
        const status = error.response?.status;

        // Retry once, and only for an expired/absent token. A 403 means the
        // account is signed in but not allowed — retrying changes nothing.
        if (status !== 401 || !original || original._retried) {
            return Promise.reject(error);
        }

        original._retried = true;

        try {
            await refreshSession();
        } catch {
            broadcastSessionLost();
            return Promise.reject(error);
        }

        original.headers = { ...original.headers, Authorization: `Bearer ${accessToken}` };
        return api(original);
    }
);

/* ------------------------------------------------------------------ */
/* Auth calls                                                          */
/* ------------------------------------------------------------------ */

export async function loginRequest(email, password) {
    const { data } = await authClient.post("/login", { email, password });
    setAccessToken(data.accessToken);
    return data;
}

export async function logoutRequest() {
    try {
        await authClient.post("/logout");
    } finally {
        // Even if the call fails (server down, offline) the browser must stop
        // acting signed in. The cookie is single-use on the next refresh
        // anyway, and the token in memory dies with this line.
        setAccessToken(null);
    }
}

export async function logoutEverywhereRequest() {
    try {
        await api.post("/admin/auth/logout-all");
    } finally {
        setAccessToken(null);
    }
}

export async function fetchMe() {
    const { data } = await api.get("/admin/auth/me");
    return data.admin;
}

export async function fetchSessions() {
    const { data } = await api.get("/admin/auth/sessions");
    return data.sessions;
}

export async function revokeSessionRequest(sessionId) {
    await api.delete(`/admin/auth/sessions/${sessionId}`);
}

export async function changePasswordRequest(currentPassword, newPassword) {
    const { data } = await api.post("/admin/auth/change-password", {
        currentPassword,
        newPassword,
    });
    setAccessToken(data.accessToken);
    return data;
}

/** Turns an axios error into the sentence the server wanted to show. */
export function errorMessage(error, fallback = "Something went wrong. Please try again.") {
    if (error?.response?.data?.message) return error.response.data.message;
    if (error?.code === "ERR_NETWORK") return "Can't reach the server. Is the backend running?";
    return fallback;
}

export default api;
