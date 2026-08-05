import React from "react";
import { FileText, Download, Package, Users, Receipt, TrendingUp } from "lucide-react";

const REPORT_TYPES = [
  { name: "Sales Report", description: "Revenue, orders and refunds by period.", icon: TrendingUp },
  { name: "Inventory Report", description: "Stock levels and low-stock alerts.", icon: Package },
  { name: "Customer Report", description: "New vs returning customer breakdown.", icon: Users },
  { name: "Tax Report", description: "GST collected, split by rate slab.", icon: Receipt },
];

const RECENT_REPORTS = [
  { name: "Sales Report - April 2026", type: "Sales", generated: "1 May 2026", size: "482 KB" },
  { name: "Inventory Snapshot - April 2026", type: "Inventory", generated: "1 May 2026", size: "210 KB" },
  { name: "Tax Report - Q4 FY25-26", type: "Tax", generated: "12 Apr 2026", size: "156 KB" },
  { name: "Customer Report - March 2026", type: "Customer", generated: "1 Apr 2026", size: "334 KB" },
];

export default function Reports() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {REPORT_TYPES.map((report) => (
          <div key={report.name} className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                <report.icon className="h-5 w-5 text-emerald-700" strokeWidth={1.9} />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">{report.name}</p>
              <p className="mt-1 text-xs text-gray-400">{report.description}</p>
            </div>
            <button className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Generate
            </button>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-[15px] font-semibold text-gray-900">Recent Reports</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-t border-b border-gray-100 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Report</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Generated</th>
                <th className="px-5 py-3 font-medium">Size</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {RECENT_REPORTS.map((r) => (
                <tr key={r.name} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-2.5 font-medium text-gray-800">
                      <FileText className="h-4 w-4 text-gray-300" />
                      {r.name}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{r.type}</td>
                  <td className="px-5 py-3.5 text-gray-500">{r.generated}</td>
                  <td className="px-5 py-3.5 text-gray-500">{r.size}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <Download className="h-4 w-4" />
                    </button>
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