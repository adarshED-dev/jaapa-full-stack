// One order, in full: line items, shipping address, and exactly how it was
// paid — the Razorpay order/payment ids and the gateway's own payment_details
// (card network, UPI VPA, bank) alongside the order and payment status.
//
// Shared by Orders, Payments and CustomerDetailPanel so an admin can jump
// order -> customer -> their other orders -> a payment, and back, from
// wherever they started.

import { useEffect, useState } from "react";
import { X, MapPin, CreditCard, Package, User, ExternalLink, Truck, Loader2, Info, AlertTriangle } from "lucide-react";
import api from "../lib/api";

const ORDER_STATUS_STYLES = {
  confirmed: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  cancelled: "bg-red-50 text-red-600",
};

const PAYMENT_STATUS_STYLES = {
  paid: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  created: "bg-sky-50 text-sky-700",
  failed: "bg-red-50 text-red-600",
  abandoned: "bg-gray-100 text-gray-500",
};

const FULFILMENT_STATUS_STYLES = {
  unfulfilled: "bg-gray-100 text-gray-500",
  processing: "bg-sky-50 text-sky-700",
  shipped: "bg-emerald-50 text-emerald-700",
  delivered: "bg-emerald-50 text-emerald-700",
};

const FULFILMENT_STATUS_LABELS = {
  unfulfilled: "Unfulfilled",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
};

function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// The gateway's own payload for how this was actually paid — different keys
// show up depending on the instrument (card / UPI / netbanking / wallet).
function describePaymentInstrument(order) {
  const d = order.payment_details;
  if (order.payment_method === "cod") return "Cash on Delivery";
  if (!d) return order.payment_method === "razorpay" ? "Online payment" : order.payment_method || "—";

  if (d.card_network) return `${d.card_network} card${d.card_last4 ? ` •••• ${d.card_last4}` : ""}`;
  if (d.vpa) return `UPI — ${d.vpa}`;
  if (d.bank) return `Net Banking — ${d.bank}`;
  if (d.wallet) return `Wallet — ${d.wallet}`;
  return d.method || "Online payment";
}

export default function OrderDetailPanel({ order: orderProp, onClose, onViewCustomer, onOrderUpdated }) {
  // Local copy so a successful Ship Now updates this panel immediately
  // instead of waiting for the parent list to refetch — reset whenever a
  // different order is opened.
  const [order, setOrder] = useState(orderProp);
  const [shipping, setShipping] = useState(false);
  const [shipError, setShipError] = useState(null);

  useEffect(() => {
    setOrder(orderProp);
    setShipError(null);
  }, [orderProp]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!order) return null;

  async function handleShipNow() {
    setShipping(true);
    setShipError(null);
    try {
      const response = await api.post(`/orders/${order.id}/ship`);
      const updated = { ...order, ...response.data.order };
      setOrder(updated);
      onOrderUpdated?.(updated);
    } catch (error) {
      setShipError({
        // A 501 means Shiprocket just isn't connected yet — an expected,
        // actionable state right now, not a failure — so it reads calmer
        // than a real error (a rejected pincode, a Shiprocket outage).
        notConfigured: error.response?.status === 501,
        message: error.response?.data?.message || "Unable to start shipping this order.",
      });
    } finally {
      setShipping(false);
    }
  }

  // /orders (admin list) carries customer_name/email/phone from the SQL
  // join; a customer's own order history (via CustomerDetailPanel) doesn't
  // need the join and falls back to the snapshot taken at checkout.
  const customerName = order.customer_name || order.customer?.fullName || "Guest";
  const customerEmail = order.customer_email || order.customer?.email;
  const customerPhone = order.customer_phone || order.customer?.phone;
  const address = order.shipping_address;
  const fulfilmentStatus = order.fulfilment_status || "unfulfilled";
  const canShip = order.status === "confirmed" && fulfilmentStatus === "unfulfilled";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${order.order_number}`}
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">{order.order_number}</p>
            <p className="mt-0.5 text-xs text-gray-400">Placed {formatDate(order.created_at)}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ORDER_STATUS_STYLES[order.status] || "bg-gray-100 text-gray-500"}`}>
              {order.status}
            </span>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${PAYMENT_STATUS_STYLES[order.payment_status] || "bg-gray-100 text-gray-500"}`}>
              Payment {order.payment_status}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${FULFILMENT_STATUS_STYLES[fulfilmentStatus] || "bg-gray-100 text-gray-500"}`}>
              <Truck className="h-3 w-3" />
              {FULFILMENT_STATUS_LABELS[fulfilmentStatus] || fulfilmentStatus}
            </span>
          </div>

          {/* Customer */}
          <div className="mt-4 rounded-xl border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                <div className="min-w-0">
                  <p className="font-medium text-gray-800">{customerName}</p>
                  {customerEmail && <p className="text-xs text-gray-500">{customerEmail}</p>}
                  {customerPhone && <p className="text-xs text-gray-500">{customerPhone}</p>}
                </div>
              </div>
              {order.customer_id && onViewCustomer && (
                <button
                  onClick={() => onViewCustomer(order.customer_id)}
                  className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                >
                  View customer
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <Package className="h-3.5 w-3.5" />
              Items
            </p>
            <div className="divide-y divide-gray-50 rounded-xl border border-gray-100">
              {(order.items || []).map((item, i) => (
                <div key={item.product_id || i} className="flex items-center gap-3 px-4 py-3">
                  {item.image ? (
                    <img src={item.image} alt={item.title} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-300">
                      <Package className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{item.title}</p>
                    <p className="text-xs text-gray-400">{formatINR(item.unit_price)} × {item.quantity}</p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-gray-800">{formatINR(item.line_total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping */}
          {address && (
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <MapPin className="h-3.5 w-3.5" />
                Shipping address
              </p>
              <div className="rounded-xl border border-gray-100 p-4 text-sm text-gray-600">
                <p className="font-medium text-gray-800">{address.fullName}</p>
                <p>{address.address1}{address.address2 ? `, ${address.address2}` : ""}</p>
                <p>{address.city}, {address.state} {address.pincode}</p>
                <p>{address.phone}</p>
              </div>
            </div>
          )}

          {/* Fulfilment */}
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <Truck className="h-3.5 w-3.5" />
              Fulfilment
            </p>
            <div className="rounded-xl border border-gray-100 p-4">
              {fulfilmentStatus === "unfulfilled" ? (
                <>
                  {order.status !== "confirmed" ? (
                    <p className="text-sm text-gray-500">
                      This order can be shipped once it's confirmed{order.payment_method === "razorpay" ? " (payment received)" : ""}.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-gray-600">Not yet handed to a courier.</p>
                        <button
                          onClick={handleShipNow}
                          disabled={shipping || !canShip}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-800 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {shipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                          {shipping ? "Starting…" : "Ship Now"}
                        </button>
                      </div>

                      {shipError?.notConfigured ? (
                        <div className="mt-3 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2.5 text-xs text-sky-800">
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{shipError.message}</span>
                        </div>
                      ) : shipError ? (
                        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{shipError.message}</span>
                        </div>
                      ) : order.fulfilment_error ? (
                        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>Last attempt failed: {order.fulfilment_error}</span>
                        </div>
                      ) : null}
                    </>
                  )}
                </>
              ) : (
                <div className="space-y-1.5 text-sm">
                  {order.courier_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Courier</span>
                      <span className="font-medium text-gray-800">{order.courier_name}</span>
                    </div>
                  )}
                  {order.awb_code && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-500">AWB</span>
                      <span className="truncate font-mono text-xs text-gray-600">{order.awb_code}</span>
                    </div>
                  )}
                  {order.tracking_url && (
                    <a
                      href={order.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Track shipment
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {!order.courier_name && !order.awb_code && (
                    <p className="text-gray-500">
                      Handed to Shiprocket — courier and tracking will appear here once assigned.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Payment */}
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <CreditCard className="h-3.5 w-3.5" />
              Payment
            </p>
            <div className="space-y-2 rounded-xl border border-gray-100 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Paid via</span>
                <span className="font-medium text-gray-800">{describePaymentInstrument(order)}</span>
              </div>
              {order.razorpay_order_id && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Razorpay order</span>
                  <span className="truncate font-mono text-xs text-gray-600">{order.razorpay_order_id}</span>
                </div>
              )}
              {order.razorpay_payment_id && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Razorpay payment</span>
                  <span className="truncate font-mono text-xs text-gray-600">{order.razorpay_payment_id}</span>
                </div>
              )}
              {order.paid_at && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Paid at</span>
                  <span className="text-gray-800">{formatDate(order.paid_at)}</span>
                </div>
              )}
            </div>

            <div className="mt-3 space-y-1.5 rounded-xl border border-gray-100 p-4 text-sm">
              <div className="flex items-center justify-between text-gray-500">
                <span>Subtotal</span>
                <span className="text-gray-800">{formatINR(order.subtotal_amount)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex items-center justify-between text-emerald-700">
                  <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
                  <span>− {formatINR(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-gray-500">
                <span>Shipping</span>
                <span className="text-gray-800">{order.shipping_amount > 0 ? formatINR(order.shipping_amount) : "FREE"}</span>
              </div>
              {order.cod_fee > 0 && (
                <div className="flex items-center justify-between text-gray-500">
                  <span>COD fee</span>
                  <span className="text-gray-800">{formatINR(order.cod_fee)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-gray-500">
                <span>GST ({order.tax_rate}%)</span>
                <span className="text-gray-800">{formatINR(order.tax_amount)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-2 text-sm font-semibold text-gray-900">
                <span>Total</span>
                <span>{formatINR(order.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
