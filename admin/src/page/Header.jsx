import React, { useState, useRef, useEffect, useCallback } from "react";
import { Bell, ChevronDown, Menu, LogOut, PackageX, Check, MonitorSmartphone, Loader2 } from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import SessionsPanel from "./SessionsPanel";
import api from "../lib/api";

// "3 hours ago" / "Yesterday" / "5 days ago" — matches the style the panel
// always used, just computed from a real timestamp now instead of typed in.
function timeAgo(isoString) {
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return "";

  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

const PAGE_COPY = {
  home: {
    title: "Dashboard",
    subtitle: "Here's what's happening with your store today.",
  },
  orders: { title: "Orders", subtitle: "Track and manage every order in one place." },
  customers: { title: "Customers", subtitle: "See who's shopping with you." },
  products: { title: "Products", subtitle: "Manage your catalog and stock levels." },
  carts: { title: "Carts", subtitle: "Recover abandoned and active carts." },
  payments: { title: "Payments", subtitle: "Review transactions and payouts." },
  blogs: { title: "Blogs", subtitle: "Write, edit and publish posts for your storefront." },
  analytics: { title: "Analytics", subtitle: "Understand how your store is performing." },
  reports: { title: "Reports", subtitle: "Generate and download store reports." },
  settings: { title: "Settings", subtitle: "Configure your store preferences." },
};

function getCopy(activeTab) {
  if (activeTab.startsWith("settings")) return PAGE_COPY.settings;
  return PAGE_COPY[activeTab] || PAGE_COPY.home;
}

export default function Header({ activeTab, onOpenMobileMenu, user }) {
  const { title, subtitle } = getCopy(activeTab);
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [dismissed, setDismissed] = useState([]);
  const [rawAlerts, setRawAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState("");
  const menuRef = useRef(null);
  const alertsRef = useRef(null);

  // No navigate() call afterwards: clearing the session flips
  // isAuthenticated, and ProtectedRoute redirects to /login on its own.
  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError("");
    try {
      const response = await api.get("/product/alerts/low-stock");
      setRawAlerts(response.data.alerts || []);
    } catch (error) {
      setAlertsError(error.response?.data?.message || "Couldn't load low-stock alerts.");
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  // Once when the dashboard first loads, and again whenever the owner
  // actually opens the panel — placing an order and then checking a minute
  // later shouldn't require a full page reload to see the new count.
  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    if (alertsOpen) loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertsOpen]);

  const alerts = rawAlerts.filter((alert) => !dismissed.includes(alert.id));

  // One listener closes whichever popup the click landed outside of, so
  // opening one doesn't leave the other hanging open behind it.
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (alertsRef.current && !alertsRef.current.contains(e.target)) {
        setAlertsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8 sm:py-7">
      <div className="flex items-center gap-3">
        <button
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
          onClick={onOpenMobileMenu}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 sm:text-[26px]">{title}</h1>
          <p className="mt-0.5 hidden text-sm text-gray-500 sm:block">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        <div className="relative" ref={alertsRef}>
          <button
            onClick={() => {
              setAlertsOpen((v) => !v);
              setMenuOpen(false);
            }}
            className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100"
            aria-label={`Notifications${alerts.length ? ` (${alerts.length} unread)` : ""}`}
          >
            <Bell className="h-5 w-5" strokeWidth={1.8} />
            {alerts.length > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {alerts.length}
              </span>
            )}
          </button>

          {alertsOpen && (
            <div className="absolute right-0 z-30 mt-2 w-[330px] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg sm:w-[360px]">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Low stock alerts</p>
                  <p className="text-xs text-gray-400">
                    {alerts.length === 0
                      ? "Nothing needs restocking"
                      : `${alerts.length} ${alerts.length === 1 ? "product needs" : "products need"} restocking`}
                  </p>
                </div>
                {alerts.length > 0 && (
                  <button
                    onClick={() => setDismissed(rawAlerts.map((alert) => alert.id))}
                    className="text-xs font-medium text-emerald-700 hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="max-h-[340px] overflow-y-auto">
                {alertsLoading ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    <p className="text-sm text-gray-500">Checking stock levels…</p>
                  </div>
                ) : alertsError ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-red-600">{alertsError}</p>
                    <button onClick={loadAlerts} className="mt-2 text-xs font-medium text-emerald-700 hover:underline">
                      Try again
                    </button>
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <Check className="h-6 w-6 text-emerald-600" strokeWidth={1.8} />
                    <p className="text-sm text-gray-500">You're all caught up.</p>
                  </div>
                ) : (
                  alerts.map((alert) => {
                    const outOfStock = alert.quantity === 0;
                    return (
                      <div
                        key={alert.id}
                        className="flex items-start gap-3 border-b border-gray-50 px-4 py-3 last:border-b-0 hover:bg-gray-50/60"
                      >
                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            outOfStock ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          <PackageX className="h-4 w-4" strokeWidth={1.8} />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">{alert.title}</p>
                          <p className="text-xs text-gray-500">
                            {outOfStock ? (
                              <span className="font-medium text-red-600">Out of stock</span>
                            ) : (
                              <>
                                <span className="font-medium text-amber-700">{alert.quantity} left</span>
                                {" · alert set at "}
                                {alert.lowStockAlert}
                              </>
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-400">
                            {alert.sku || "No SKU"} · {timeAgo(alert.updatedAt)}
                          </p>
                        </div>

                        <button
                          onClick={() => setDismissed((prev) => [...prev, alert.id])}
                          className="shrink-0 rounded-md px-1.5 py-1 text-[11px] font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          Dismiss
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => {
              setMenuOpen((v) => !v);
              setAlertsOpen(false);
            }}
            className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-1 hover:bg-gray-50 sm:pr-2"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
              {user.initials}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-400">{user.role}</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-gray-400 sm:block" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-gray-100 bg-white py-1.5 shadow-lg">
              <button
                onClick={() => {
                  setSessionsOpen(true);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                <MonitorSmartphone className="h-4 w-4 text-gray-400" />
                Signed-in devices
              </button>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4 text-gray-400" />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          )}
        </div>
      </div>

      {sessionsOpen && <SessionsPanel onClose={() => setSessionsOpen(false)} />}
    </header>
  );
}