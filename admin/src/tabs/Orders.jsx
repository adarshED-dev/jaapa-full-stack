import React, { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Download, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";

const ORDERS = [
  { id: "#ORD-1250", customer: "Riya Sharma", date: "21 May 2026", items: 3, amount: "\u20B91,299", payment: "UPI", status: "Paid" },
  { id: "#ORD-1249", customer: "Amit Verma", date: "21 May 2026", items: 1, amount: "\u20B92,499", payment: "Card", status: "Paid" },
  { id: "#ORD-1248", customer: "Neha Patel", date: "20 May 2026", items: 2, amount: "\u20B9899", payment: "COD", status: "Pending" },
  { id: "#ORD-1247", customer: "Vikram Singh", date: "20 May 2026", items: 4, amount: "\u20B91,599", payment: "UPI", status: "Paid" },
  { id: "#ORD-1246", customer: "Pooja Mehta", date: "19 May 2026", items: 1, amount: "\u20B9999", payment: "COD", status: "Pending" },
  { id: "#ORD-1245", customer: "Karan Malhotra", date: "19 May 2026", items: 2, amount: "\u20B91,899", payment: "Card", status: "Paid" },
  { id: "#ORD-1244", customer: "Sneha Rao", date: "18 May 2026", items: 5, amount: "\u20B93,250", payment: "UPI", status: "Refunded" },
  { id: "#ORD-1243", customer: "Arjun Nair", date: "18 May 2026", items: 1, amount: "\u20B9499", payment: "COD", status: "Cancelled" },
];

const FILTERS = ["All", "Paid", "Pending", "Refunded", "Cancelled"];

const STATUS_STYLES = {
  Paid: "bg-emerald-50 text-emerald-700",
  Pending: "bg-amber-50 text-amber-700",
  Refunded: "bg-sky-50 text-sky-700",
  Cancelled: "bg-red-50 text-red-600",
};

export default function Orders() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  const filtered = useMemo(() => {
    return ORDERS.filter((o) => {
      const matchesFilter = filter === "All" || o.status === filter;
      const matchesQuery =
        o.customer.toLowerCase().includes(query.toLowerCase()) ||
        o.id.toLowerCase().includes(query.toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [query, filter]);

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order ID or customer"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-lg bg-gray-50 p-1 md:flex">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f ? "bg-white text-emerald-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 md:hidden">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
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
                <tr key={order.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5 font-medium text-gray-800">{order.id}</td>
                  <td className="px-5 py-3.5 text-gray-600">{order.customer}</td>
                  <td className="px-5 py-3.5 text-gray-500">{order.date}</td>
                  <td className="px-5 py-3.5 text-gray-500">{order.items}</td>
                  <td className="px-5 py-3.5 text-gray-500">{order.payment}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-800">{order.amount}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">
                    No orders match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3.5">
          <p className="text-xs text-gray-400">
            Showing {filtered.length} of {ORDERS.length} orders
          </p>
          <div className="flex items-center gap-1.5">
            <button className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}