import React, { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Loader2, Trash2 } from "lucide-react";
import api from "../lib/api";

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700",
  abandoned: "bg-amber-50 text-amber-700",
  empty: "bg-gray-100 text-gray-500",
};

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function relativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) === 1 ? "" : "s"} ago`;
}

export default function Carts() {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    async function loadCarts() {
      try {
        const response = await api.get("/cart/admin/list");
        setCarts(response.data.carts || []);
      } catch (requestError) {
        console.error(requestError);
        setError("Unable to load carts. Check that the backend is running.");
      } finally {
        setLoading(false);
      }
    }

    loadCarts();
  }, []);

  async function deleteCart(cartId) {
    if (!window.confirm("Delete this cart and all of its items? This cannot be undone.")) return;

    setDeletingId(cartId);
    setError(null);
    try {
      await api.delete(`/cart/admin/${cartId}`);
      setCarts((currentCarts) => currentCarts.filter((cart) => cart.id !== cartId));
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.response?.data?.message || "Unable to delete this cart.");
    } finally {
      setDeletingId(null);
    }
  }

  const metrics = useMemo(() => {
    const active = carts.filter((cart) => cart.cart_status === "active");
    const abandoned = carts.filter((cart) => cart.cart_status === "abandoned");
    return {
      activeCount: active.length,
      abandonedCount: abandoned.length,
      recoveryValue: abandoned.reduce((total, cart) => total + Number(cart.cart_value || 0), 0),
    };
  }, [carts]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm text-gray-500">Active Carts</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{metrics.activeCount}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm text-gray-500">Abandoned Carts</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{metrics.abandonedCount}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm text-gray-500">Potential Recovery Value</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatPrice(metrics.recoveryValue)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Cart</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Cart Value</th>
                <th className="px-5 py-3 font-medium">Last Active</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading carts...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-red-600">{error}</td>
                </tr>
              )}
              {!loading && !error && carts.map((cart) => (
                <tr key={cart.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5 font-medium text-gray-800">
                      <ShoppingCart className="h-4 w-4 text-gray-300" />
                      <span title={cart.id}>Cart #{cart.id.slice(0, 8)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{cart.item_count}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-800">{formatPrice(cart.cart_value)}</td>
                  <td className="px-5 py-3.5 text-gray-500">{relativeTime(cart.updated_at)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[cart.cart_status]}`}>
                      {cart.cart_status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => deleteCart(cart.id)}
                      disabled={deletingId === cart.id}
                      aria-label={`Delete cart ${cart.id}`}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === cart.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && !error && carts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">No carts yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
