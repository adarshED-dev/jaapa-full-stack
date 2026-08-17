// Payments aren't a separate thing from orders in this store — there's no
// payments table. Every payment fact (method, Razorpay ids, paid_at, the
// gateway's own payment_details) already lives on the order row, so this
// tab reads the same /orders the Orders tab does and presents it
// transaction-first instead of order-first.

import React, { useEffect, useMemo, useState } from "react";
import { CreditCard, Landmark, Smartphone, Wallet, RefreshCw, Loader2 } from "lucide-react";

import api from "../lib/api";
import OrderDetailPanel from "../toolkit/OrderDetailPanel";
import CustomerDetailPanel from "../toolkit/CustomerDetailPanel";

const STATUS_STYLES = {
  paid: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  created: "bg-sky-50 text-sky-700",
  failed: "bg-red-50 text-red-600",
  abandoned: "bg-gray-100 text-gray-500",
};

const METHOD_ICON = { razorpay: Smartphone, cod: Wallet };

function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isThisMonth(value) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export default function Payments() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/orders");
      setOrders(response.data.orders || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load payments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const thisMonth = orders
      .filter((o) => o.payment_status === "paid" && isThisMonth(o.paid_at))
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    // COD money is collected on delivery, not at checkout — until that
    // order's payment_status flips to paid, its total sits here as
    // uncollected rather than as revenue.
    const pendingPayouts = orders
      .filter((o) => o.payment_method === "cod" && o.payment_status === "pending")
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    // No refund flow exists yet, so this is correctly ₹0 today rather than a
    // stand-in number — it'll start moving the moment refunds are built.
    const refunded = orders
      .filter((o) => o.payment_status === "refunded")
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    return { thisMonth, pendingPayouts, refunded };
  }, [orders]);

  // Every paid-or-attempted order is a "transaction" here — newest first,
  // same underlying rows the Orders tab shows, just reordered by payment
  // recency rather than placement date.
  const transactions = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at)
      ),
    [orders]
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">This Month</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
              <Landmark className="h-4 w-4 text-emerald-700" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{formatINR(stats.thisMonth)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Pending COD Collection</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50">
              <Wallet className="h-4 w-4 text-amber-700" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{formatINR(stats.pendingPayouts)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Refunded</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-50">
              <CreditCard className="h-4 w-4 text-sky-700" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{formatINR(stats.refunded)}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={load} className="ml-2 font-medium underline">Try again</button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <p className="text-sm font-medium text-gray-700">Transactions</p>
          <button onClick={load} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50" aria-label="Refresh">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Payment ID</th>
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Method</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading transactions...
                  </td>
                </tr>
              )}
              {!loading && transactions.map((order) => {
                const Icon = METHOD_ICON[order.payment_method] || CreditCard;
                return (
                  <tr key={order.id} onClick={() => setSelectedOrder(order)} className="cursor-pointer hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-600">
                      {order.razorpay_payment_id || (order.payment_method === "cod" ? "COD" : "—")}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{order.order_number}</td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {order.customer_id ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedCustomerId(order.customer_id); }}
                          className="hover:text-emerald-700 hover:underline"
                        >
                          {order.customer_name || "Guest"}
                        </button>
                      ) : (
                        order.customer_name || "Guest"
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-gray-300" />
                        {order.payment_method === "cod" ? "COD" : "Online"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-800">{formatINR(order.total_amount)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[order.payment_status] || "bg-gray-100 text-gray-500"}`}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{formatDate(order.paid_at || order.created_at)}</td>
                  </tr>
                );
              })}
              {!loading && transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">No transactions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
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
