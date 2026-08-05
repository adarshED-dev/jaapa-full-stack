import React from "react";
import { CreditCard, Landmark, Smartphone, Wallet } from "lucide-react";

const TRANSACTIONS = [
  { id: "TXN-88421", order: "#ORD-1250", customer: "Riya Sharma", method: "UPI", amount: "\u20B91,299", status: "Success", date: "21 May 2026" },
  { id: "TXN-88420", order: "#ORD-1249", customer: "Amit Verma", method: "Card", amount: "\u20B92,499", status: "Success", date: "21 May 2026" },
  { id: "TXN-88419", order: "#ORD-1248", customer: "Neha Patel", method: "COD", amount: "\u20B9899", status: "Awaiting", date: "20 May 2026" },
  { id: "TXN-88418", order: "#ORD-1244", customer: "Sneha Rao", method: "UPI", amount: "\u20B93,250", status: "Refunded", date: "18 May 2026" },
  { id: "TXN-88417", order: "#ORD-1243", customer: "Arjun Nair", method: "COD", amount: "\u20B9499", status: "Failed", date: "18 May 2026" },
];

const STATUS_STYLES = {
  Success: "bg-emerald-50 text-emerald-700",
  Awaiting: "bg-amber-50 text-amber-700",
  Refunded: "bg-sky-50 text-sky-700",
  Failed: "bg-red-50 text-red-600",
};

const METHOD_ICON = { UPI: Smartphone, Card: CreditCard, COD: Wallet };

export default function Payments() {
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
          <p className="mt-3 text-2xl font-semibold text-gray-900">\u20B98,45,230</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Pending Payouts</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50">
              <Wallet className="h-4 w-4 text-amber-700" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">\u20B912,480</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Refunded</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-50">
              <CreditCard className="h-4 w-4 text-sky-700" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">\u20B93,250</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Transaction</th>
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Method</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {TRANSACTIONS.map((t) => {
                const Icon = METHOD_ICON[t.method];
                return (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-medium text-gray-800">{t.id}</td>
                    <td className="px-5 py-3.5 text-gray-500">{t.order}</td>
                    <td className="px-5 py-3.5 text-gray-600">{t.customer}</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-gray-300" />
                        {t.method}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-800">{t.amount}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[t.status]}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{t.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}