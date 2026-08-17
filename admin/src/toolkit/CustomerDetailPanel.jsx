// One customer, plus their entire order history — fetched fresh from
// GET /api/customers/:id rather than reusing whatever row a list already
// had, since that endpoint is the one place order-count and total-spent are
// guaranteed current.
//
// Clicking an order here hands it to the caller (onViewOrder) rather than
// rendering OrderDetailPanel itself, so it stacks on top of this panel
// instead of replacing it — closing the order goes back to the customer,
// not out of the flow entirely.

import { useEffect, useState } from "react";
import { X, Mail, Phone, MapPin, Loader2, ShoppingBag, ChevronRight, Trash2 } from "lucide-react";
import api from "../lib/api";

const ORDER_STATUS_STYLES = {
  confirmed: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  cancelled: "bg-red-50 text-red-600",
};

function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function initials(nameOrEmail) {
  const value = String(nameOrEmail || "?").trim();
  const parts = value.split(/[\s@.]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
}

export default function CustomerDetailPanel({ customerId, onClose, onViewOrder, onRequestDelete }) {
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .get(`/customers/${customerId}`)
      .then((response) => {
        if (cancelled) return;
        setCustomer(response.data.customer);
        setOrders(response.data.orders || []);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.response?.data?.message || "Unable to load this customer.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
        aria-label="Customer details"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-semibold text-gray-900">Customer</p>
          <div className="flex items-center gap-1">
            {customer && onRequestDelete && (
              <button
                onClick={() => onRequestDelete(customer)}
                aria-label="Delete customer"
                title="Delete customer"
                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <div className="px-5 py-12 text-center text-sm text-red-600">{error}</div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-800">
                  {initials(customer.full_name || customer.email || customer.phone)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-800">{customer.full_name || "No name"}</p>
                  <p className="text-xs text-gray-400">Customer since {formatDate(customer.created_at)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 px-5 pb-4 text-sm">
                {customer.email && (
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <Mail className="h-3.5 w-3.5 text-gray-300" />
                    {customer.email}
                  </span>
                )}
                {customer.phone && (
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <Phone className="h-3.5 w-3.5 text-gray-300" />
                    {customer.phone}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 px-5 pb-4">
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-xs text-gray-400">Orders</p>
                  <p className="mt-0.5 text-lg font-semibold text-gray-900">{customer.orders_count}</p>
                </div>
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-xs text-gray-400">Total spent</p>
                  <p className="mt-0.5 text-lg font-semibold text-gray-900">{formatINR(customer.total_spent)}</p>
                </div>
              </div>

              {customer.default_address && (
                <div className="px-5 pb-4">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <MapPin className="h-3.5 w-3.5" />
                    Default address
                  </p>
                  <p className="text-sm text-gray-600">
                    {customer.default_address.address1}
                    {customer.default_address.city ? `, ${customer.default_address.city}` : ""}
                    {customer.default_address.state ? `, ${customer.default_address.state}` : ""}
                    {customer.default_address.pincode ? ` ${customer.default_address.pincode}` : ""}
                  </p>
                </div>
              )}

              <div className="border-t border-gray-100 px-5 py-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Orders
                </p>
              </div>

              <div className="divide-y divide-gray-50 pb-2">
                {orders.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-gray-400">No orders yet.</p>
                ) : (
                  orders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => onViewOrder(order)}
                      className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-gray-50/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">{order.order_number}</p>
                        <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <span className="text-sm font-medium text-gray-800">{formatINR(order.total_amount)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ORDER_STATUS_STYLES[order.status] || "bg-gray-100 text-gray-500"}`}>
                          {order.status}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
