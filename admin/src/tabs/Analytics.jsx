import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { TrendingUp, Users, ShoppingBag, Percent } from "lucide-react";

const TRAFFIC_DATA = [
  { month: "Jan", visitors: 4200, orders: 320 },
  { month: "Feb", visitors: 4800, orders: 380 },
  { month: "Mar", visitors: 5100, orders: 410 },
  { month: "Apr", visitors: 4700, orders: 360 },
  { month: "May", visitors: 6200, orders: 512 },
];

const CATEGORY_DATA = [
  { category: "Wellness Tea", revenue: 185250 },
  { category: "Essential Oils", revenue: 124750 },
  { category: "Nutrition", revenue: 96500 },
  { category: "Supplements", revenue: 74300 },
  { category: "Skin Care", revenue: 58200 },
];

const KPIS = [
  { label: "Conversion Rate", value: "3.8%", icon: Percent },
  { label: "Avg. Order Value", value: "\u20B91,845", icon: TrendingUp },
  { label: "Repeat Customers", value: "42%", icon: Users },
  { label: "Cart Completion", value: "68%", icon: ShoppingBag },
];

export default function Analytics() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{kpi.label}</p>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
                <kpi.icon className="h-4 w-4 text-emerald-700" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-semibold text-gray-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-[15px] font-semibold text-gray-900">Visitors vs Orders</h2>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={TRAFFIC_DATA} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#F1F2F4" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} width={40} />
                <Tooltip />
                <Line type="monotone" dataKey="visitors" stroke="#1F5D3E" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="orders" stroke="#D98E3E" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-[15px] font-semibold text-gray-900">Revenue by Category</h2>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CATEGORY_DATA} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#F1F2F4" />
                <XAxis dataKey="category" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#9CA3AF" }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} tickFormatter={(v) => `\u20B9${v / 1000}K`} width={44} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#2F7A4F" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}