import React from "react";
import {
  ShoppingBag,
  Wallet,
  Users,
  Package,
  ArrowUp,
  ChevronDown,
  Pencil,
  CheckCircle2,
  Layers,
  Calendar,
  IndianRupee,
  UserPlus,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ------------------------------------------------------------------ */
/* Mock data — swap these for real API responses                       */
/* ------------------------------------------------------------------ */

const STATS = [
  {
    label: "Total Orders",
    value: "1,248",
    change: "+18.2%",
    icon: ShoppingBag,
  },
  {
    label: "Total Revenue",
    value: "\u20B98,45,230",
    change: "+24.6%",
    icon: Wallet,
  },
  {
    label: "Total Customers",
    value: "2,350",
    change: "+15.7%",
    icon: Users,
  },
  {
    label: "Total Products",
    value: "532",
    change: "+8.3%",
    icon: Package,
  },
];

const SALES_DATA = [
  { date: "Apr 21", revenue: 68000 },
  { date: "Apr 23", revenue: 92000 },
  { date: "Apr 26", revenue: 118000 },
  { date: "Apr 28", revenue: 96000 },
  { date: "May 1", revenue: 108000 },
  { date: "May 3", revenue: 128000 },
  { date: "May 6", revenue: 82000 },
  { date: "May 8", revenue: 70000 },
  { date: "May 11", revenue: 76000 },
  { date: "May 13", revenue: 64000 },
  { date: "May 16", revenue: 92000 },
  { date: "May 18", revenue: 118000 },
  { date: "May 21", revenue: 150000 },
];

const RECENT_ORDERS = [
  { id: "#ORD-1250", customer: "Riya Sharma", amount: "\u20B91,299", status: "Paid" },
  { id: "#ORD-1249", customer: "Amit Verma", amount: "\u20B92,499", status: "Paid" },
  { id: "#ORD-1248", customer: "Neha Patel", amount: "\u20B9899", status: "Pending" },
  { id: "#ORD-1247", customer: "Vikram Singh", amount: "\u20B91,599", status: "Paid" },
  { id: "#ORD-1246", customer: "Pooja Mehta", amount: "\u20B9999", status: "Pending" },
];

const TOP_PRODUCTS = [
  {
    name: "Lactomama Tea",
    variant: "200g",
    revenue: "\u20B91,85,250",
    units: "1,250 units",
    color: "#8AA986",
  },
  {
    name: "Stress Balance Oil",
    variant: "30ml",
    revenue: "\u20B91,24,750",
    units: "980 units",
    color: "#D9C08A",
  },
  {
    name: "Nourishing Drink Mix",
    variant: "250g",
    revenue: "\u20B996,500",
    units: "670 units",
    color: "#C7CFC4",
  },
  {
    name: "Ashwagandha Capsules",
    variant: "60 Capsules",
    revenue: "\u20B974,300",
    units: "520 units",
    color: "#DDB876",
  },
];

const STORE_SUMMARY = [
  { icon: Pencil, label: "Active Theme", value: "JAAPA Theme" },
  { icon: CheckCircle2, label: "Store Status", value: "Active", badge: true },
  { icon: Layers, label: "Plan", value: "Premium Plan" },
  { icon: Calendar, label: "Orders This Month", value: "1,248" },
  { icon: IndianRupee, label: "Revenue This Month", value: "\u20B98,45,230" },
  { icon: UserPlus, label: "Customers This Month", value: "320" },
];

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, change, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
          <Icon className="h-4 w-4 text-emerald-700" strokeWidth={1.9} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-2 flex items-center gap-1 text-xs text-gray-400">
        <span className="flex items-center gap-0.5 font-medium text-emerald-600">
          <ArrowUp className="h-3 w-3" strokeWidth={2.5} />
          {change}
        </span>
        vs last 30 days
      </p>
    </div>
  );
}

function StatusBadge({ status }) {
  const isPaid = status === "Paid";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        isPaid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {status}
    </span>
  );
}

function CardShell({ title, action, children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-gray-700">{label}</p>
      <p className="text-emerald-700">
        {"\u20B9"}
        {payload[0].value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Home tab                                                            */
/* ------------------------------------------------------------------ */

export default function Home() {
  return (
    <div className="flex flex-col gap-5">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Sales overview + Recent orders */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <CardShell
          className="xl:col-span-2"
          title="Sales Overview"
          action={
            <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Last 30 days
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>
          }
        >
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SALES_DATA} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2F7A4F" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#2F7A4F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#F1F2F4" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  interval={1}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickFormatter={(v) => `\u20B9${v / 1000}K`}
                  width={48}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#1F5D3E"
                  strokeWidth={2.5}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardShell>

        <CardShell
          title="Recent Orders"
          action={
            <button className="text-xs font-medium text-emerald-700 hover:underline">
              View all
            </button>
          }
        >
          <ul className="flex flex-col divide-y divide-gray-50">
            {RECENT_ORDERS.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{order.id}</p>
                  <p className="text-xs text-gray-400">{order.customer}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-800">{order.amount}</span>
                  <StatusBadge status={order.status} />
                </div>
              </li>
            ))}
          </ul>
        </CardShell>
      </div>

      {/* Top selling products + Store summary */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <CardShell
          className="xl:col-span-2"
          title="Top Selling Products"
          action={
            <button className="text-xs font-medium text-emerald-700 hover:underline">
              View all
            </button>
          }
        >
          <ul className="flex flex-col divide-y divide-gray-50">
            {TOP_PRODUCTS.map((product) => (
              <li key={product.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${product.color}33` }}
                >
                  <div
                    className="h-5 w-5 rounded-full"
                    style={{ backgroundColor: product.color }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{product.name}</p>
                  <p className="text-xs text-gray-400">{product.variant}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium text-gray-800">{product.revenue}</p>
                  <p className="text-xs text-gray-400">{product.units}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardShell>

        <CardShell title="Store Summary">
          <ul className="flex flex-col divide-y divide-gray-50">
            {STORE_SUMMARY.map((row) => {
              const Icon = row.icon;
              return (
                <li key={row.label} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex items-center gap-2.5 text-sm text-gray-600">
                    <Icon className="h-4 w-4 text-gray-400" strokeWidth={1.9} />
                    {row.label}
                  </span>
                  {row.badge ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      {row.value}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-gray-800">{row.value}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </CardShell>
      </div>
    </div>
  );
}