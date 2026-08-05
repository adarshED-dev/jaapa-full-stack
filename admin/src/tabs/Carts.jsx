import React from "react";
import { ShoppingCart, Send } from "lucide-react";

const CARTS = [
  { customer: "Ananya Iyer", items: 3, value: "\u20B92,140", lastActive: "2 hours ago", status: "Abandoned" },
  { customer: "Rahul Kapoor", items: 1, value: "\u20B9799", lastActive: "5 hours ago", status: "Abandoned" },
  { customer: "Divya Menon", items: 5, value: "\u20B94,350", lastActive: "1 day ago", status: "Recovered" },
  { customer: "Sanjay Gupta", items: 2, value: "\u20B91,298", lastActive: "1 day ago", status: "Abandoned" },
  { customer: "Meera Joshi", items: 4, value: "\u20B93,196", lastActive: "3 days ago", status: "Recovered" },
];

const STATUS_STYLES = {
  Abandoned: "bg-amber-50 text-amber-700",
  Recovered: "bg-emerald-50 text-emerald-700",
};

export default function Carts() {
  const abandonedCount = CARTS.filter((c) => c.status === "Abandoned").length;
  const abandonedValue = CARTS.filter((c) => c.status === "Abandoned").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm text-gray-500">Active Carts</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">86</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm text-gray-500">Abandoned Carts</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{abandonedCount}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm text-gray-500">Potential Recovery Value</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">\u20B93,438</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Cart Value</th>
                <th className="px-5 py-3 font-medium">Last Active</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {CARTS.map((cart) => (
                <tr key={cart.customer} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5 font-medium text-gray-800">
                      <ShoppingCart className="h-4 w-4 text-gray-300" />
                      {cart.customer}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{cart.items}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-800">{cart.value}</td>
                  <td className="px-5 py-3.5 text-gray-500">{cart.lastActive}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[cart.status]}`}>
                      {cart.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {cart.status === "Abandoned" && (
                      <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                        <Send className="h-3.5 w-3.5" />
                        Remind
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}