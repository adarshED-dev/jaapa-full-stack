import React, { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Eye } from "lucide-react";

import api from "../lib/api";
import OrderDetailPanel from "../toolkit/OrderDetailPanel";
import CustomerDetailPanel from "../toolkit/CustomerDetailPanel";

const FILTERS = ["All", "confirmed", "pending", "cancelled"];

const STATUS_STYLES = {
  confirmed: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  cancelled: "bg-red-50 text-red-600",
};

const PAYMENT_METHOD_LABEL = { razorpay: "Online", cod: "COD" };

function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  // Interconnection: an order can open the customer who placed it, and that
  // panel can open any of their other orders — the two stack rather than
  // replace each other, so closing one returns to where you were.
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/orders");
      setOrders(response.data.orders || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesFilter = filter === "All" || o.status === filter;
      const matchesQuery =
        !q ||
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_name || "").toLowerCase().includes(q) ||
        (o.customer_email || "").toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [orders, query, filter]);

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order # or customer"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-lg bg-gray-50 p-1 md:flex">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === f ? "bg-white text-emerald-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={load} className="ml-2 font-medium underline">Try again</button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Payment</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="cursor-pointer hover:bg-gray-50/50"
                >
                  <td className="px-5 py-3.5 font-medium text-gray-800">{order.order_number}</td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {order.customer_id ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomerId(order.customer_id);
                        }}
                        className="hover:text-emerald-700 hover:underline"
                      >
                        {order.customer_name || order.customer?.fullName || "Guest"}
                      </button>
                    ) : (
                      order.customer_name || order.customer?.fullName || "Guest"
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{formatDate(order.created_at)}</td>
                  <td className="px-5 py-3.5 text-gray-500">{(order.items || []).length}</td>
                  <td className="px-5 py-3.5 text-gray-500">{PAYMENT_METHOD_LABEL[order.payment_method] || order.payment_method}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-800">{formatINR(order.total_amount)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[order.status] || "bg-gray-100 text-gray-500"}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                      }}
                      aria-label={`View order ${order.order_number}`}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">
                    {orders.length === 0 ? "No orders yet." : "No orders match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3.5">
          <p className="text-xs text-gray-400">
            {loading ? "Loading…" : `Showing ${filtered.length} of ${orders.length} orders`}
          </p>
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={(updated) => {
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
          }}
          onViewCustomer={(customerId) => {
            setSelectedOrder(null);
            setSelectedCustomerId(customerId);
          }}
        />
      )}

      {selectedCustomerId && (
        <CustomerDetailPanel
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onViewOrder={(order) => {
            setSelectedCustomerId(null);
            setSelectedOrder(order);
          }}
        />
      )}
    </div>
  );
}
