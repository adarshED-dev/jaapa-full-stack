// Everyone the store knows about — buyers and brochure leads in one list.
//
// A brochure lead is a `customers` row with is_brochure_lead = TRUE: an email
// captured by the newsletter form on the storefront, usually with no phone
// and no orders yet. The badge and the filter below are what tell them apart.

import React, { useEffect, useMemo, useState } from "react";
import { Search, Mail, Phone, Download, RefreshCw, FileText, Trash2 } from "lucide-react";

import api from "../lib/api";
import CustomerDetailPanel from "../toolkit/CustomerDetailPanel";
import OrderDetailPanel from "../toolkit/OrderDetailPanel";
import ConfirmDeleteModal from "../toolkit/ConfirmDeleteModal";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "buyers", label: "Buyers" },
  { id: "brochure", label: "Brochure leads" },
];

function initials(nameOrEmail) {
  const value = String(nameOrEmail || "?").trim();
  const parts = value.split(/[\s@.]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
}

function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

function formatJoined(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/customers");
      setCustomers(response.data.customers || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const [downloading, setDownloading] = useState(false);

  // Interconnection: a customer row opens their full history; an order in
  // that history opens on top of it, and closing the order returns here
  // rather than out of the flow.
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Delete confirmation — nothing is removed until this is explicitly
  // accepted. Their orders survive the delete (see the route's own
  // comment); only the account itself, its sessions, cart and wishlist go.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/customers/${deleteTarget.id}`);
      setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      // Closes the detail panel too, if the delete was requested from
      // there — it would otherwise keep showing a customer that's gone.
      setSelectedCustomerId((current) => (current === deleteTarget.id ? null : current));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Unable to delete this customer.");
    } finally {
      setDeleting(false);
    }
  }

  async function downloadLeadsCsv() {
    setDownloading(true);
    try {
      const response = await api.get("/newsletter/leads?format=csv", { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "brochure-leads.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Unable to download the leads CSV.");
    } finally {
      setDownloading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "brochure" && c.is_brochure_lead) ||
        (filter === "buyers" && Number(c.orders_count) > 0);

      const matchesQuery =
        !q ||
        (c.full_name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q);

      return matchesFilter && matchesQuery;
    });
  }, [customers, query, filter]);

  const leadCount = customers.filter((c) => c.is_brochure_lead).length;

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or phone"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                filter === f.id
                  ? "bg-emerald-700 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
              {f.id === "brochure" && leadCount > 0 && (
                <span className="ml-1.5 text-xs opacity-80">{leadCount}</span>
              )}
            </button>
          ))}

          <button
            onClick={load}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Fetched rather than linked: /newsletter/leads is admin-only, and
              a plain <a> can't send the Authorization header — it would 401. */}
          <button
            onClick={downloadLeadsCsv}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Preparing…" : "Leads CSV"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={load} className="ml-2 font-medium underline">Try again</button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Orders</th>
                <th className="px-5 py-3 font-medium">Total Spent</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedCustomerId(c.id)}
                  className="cursor-pointer hover:bg-gray-50/50"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-800">
                        {initials(c.full_name || c.email || c.phone)}
                      </div>
                      <span className="font-medium text-gray-800">
                        {c.full_name || <span className="text-gray-400">No name</span>}
                      </span>
                    </div>
                  </td>

                  <td className="px-5 py-3.5 text-gray-500">
                    <div className="flex flex-col gap-0.5">
                      {c.email && (
                        <span className="flex items-center gap-1.5 text-xs">
                          <Mail className="h-3 w-3 text-gray-300" />
                          {c.email}
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-1.5 text-xs">
                          <Phone className="h-3 w-3 text-gray-300" />
                          {c.phone}
                        </span>
                      )}
                      {!c.email && !c.phone && <span className="text-xs text-gray-300">—</span>}
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    {c.is_brochure_lead ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                        title={
                          c.brochure_download_count > 1
                            ? `Downloaded ${c.brochure_download_count} times`
                            : "Downloaded the brochure"
                        }
                      >
                        <FileText className="h-3 w-3" />
                        Brochure customer
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-500">
                        {Number(c.orders_count) > 0 ? "Buyer" : "Customer"}
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-3.5 text-gray-600">{c.orders_count}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-800">{formatINR(c.total_spent)}</td>
                  <td className="px-5 py-3.5 text-gray-500">{formatJoined(c.created_at)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(c);
                        setDeleteError(null);
                      }}
                      aria-label={`Delete ${c.full_name || c.email || c.phone}`}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">
                    {loading
                      ? "Loading customers…"
                      : customers.length === 0
                        ? "No customers yet."
                        : "No customers match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCustomerId && (
        <CustomerDetailPanel
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onViewOrder={(order) => {
            setSelectedCustomerId(null);
            setSelectedOrder(order);
          }}
          onRequestDelete={(customer) => {
            setDeleteTarget(customer);
            setDeleteError(null);
          }}
        />
      )}

      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onViewCustomer={(customerId) => {
            setSelectedOrder(null);
            setSelectedCustomerId(customerId);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Delete customer?"
          description={
            <>
              Are you sure you want to delete{" "}
              <span className="font-medium text-gray-700">
                {deleteTarget.full_name || deleteTarget.email || deleteTarget.phone || "this customer"}
              </span>
              ? Their sessions, cart and wishlist go with them. Their past orders stay — this can't be undone.
            </>
          }
          deleting={deleting}
          error={deleteError}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
