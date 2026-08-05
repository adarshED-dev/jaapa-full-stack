import React, { useState } from "react";
import { Search, Mail, Phone } from "lucide-react";

const CUSTOMERS = [
  { name: "Riya Sharma", email: "riya.sharma@email.com", phone: "+91 98765 43210", orders: 12, spent: "\u20B914,860", joined: "Jan 2025" },
  { name: "Amit Verma", email: "amit.verma@email.com", phone: "+91 91234 56780", orders: 8, spent: "\u20B99,240", joined: "Mar 2025" },
  { name: "Neha Patel", email: "neha.patel@email.com", phone: "+91 99887 66554", orders: 3, spent: "\u20B92,697", joined: "Nov 2025" },
  { name: "Vikram Singh", email: "vikram.singh@email.com", phone: "+91 90011 22334", orders: 15, spent: "\u20B921,340", joined: "Jun 2024" },
  { name: "Pooja Mehta", email: "pooja.mehta@email.com", phone: "+91 98123 45670", orders: 5, spent: "\u20B94,995", joined: "Feb 2026" },
  { name: "Karan Malhotra", email: "karan.m@email.com", phone: "+91 97654 32109", orders: 21, spent: "\u20B932,580", joined: "Aug 2024" },
];

function initials(name) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("");
}

export default function Customers() {
  const [query, setQuery] = useState("");
  const filtered = CUSTOMERS.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Orders</th>
                <th className="px-5 py-3 font-medium">Total Spent</th>
                <th className="px-5 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <tr key={c.email} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-800">
                        {initials(c.name)}
                      </div>
                      <span className="font-medium text-gray-800">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 text-xs"><Mail className="h-3 w-3 text-gray-300" />{c.email}</span>
                      <span className="flex items-center gap-1.5 text-xs"><Phone className="h-3 w-3 text-gray-300" />{c.phone}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{c.orders}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-800">{c.spent}</td>
                  <td className="px-5 py-3.5 text-gray-500">{c.joined}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                    No customers match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}