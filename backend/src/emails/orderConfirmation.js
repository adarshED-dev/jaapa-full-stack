// Order confirmation email — a self-contained HTML string, table-based
// layout with inline styles throughout. Email clients (Outlook especially)
// don't reliably support flexbox/grid or a <style> block, so this doesn't
// use either, unlike the rest of the codebase.
//
// Takes a full `orders` row (the same shape pool.query("SELECT * FROM
// orders...") returns) plus the store's public base URL.

const { publicUploadUrl } = require("../services/uploadUrl");

const LOGO_URL = publicUploadUrl("brand", "jaapa-logo.png");

const SUPPORT_EMAIL = "help@jaapa.info";
const SUPPORT_PHONE = "+91 9893702877";
const SUPPORT_HOURS = "10AM–6PM IST, Mon–Fri";

const BRAND_DARK = "#173a2c";
const BRAND_GOLD = "#c8933f";
const BG = "#f4efe4";
const CARD_BG = "#faf7ef";
const TEXT = "#1f1e1a";
const MUTED = "#7a776d";
const BORDER = "#eee2ce";

function formatINR(amount) {
    return `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));
}

function itemRow(item) {
    const image = item.image
        ? `<img src="${escapeHtml(item.image)}" width="56" height="56" alt="" style="display:block;border-radius:8px;object-fit:cover;background:#efe6d3;" />`
        : `<div style="width:56px;height:56px;border-radius:8px;background:#efe6d3;"></div>`;

    return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${BORDER};" width="56">${image}</td>
      <td style="padding:12px 0 12px 14px;border-bottom:1px solid ${BORDER};font-family:Arial,sans-serif;">
        <span style="display:block;font-size:14px;color:${TEXT};font-weight:600;">${escapeHtml(item.title)}</span>
        <span style="display:block;font-size:12px;color:${MUTED};margin-top:2px;">${formatINR(item.unit_price)} × ${item.quantity}</span>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid ${BORDER};font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:${TEXT};text-align:right;white-space:nowrap;">
        ${formatINR(item.line_total)}
      </td>
    </tr>`;
}

function totalRow(label, value, { emphasis = false, negative = false } = {}) {
    return `
    <tr>
      <td style="padding:4px 0;font-family:Arial,sans-serif;font-size:${emphasis ? "16px" : "13px"};color:${emphasis ? TEXT : MUTED};${emphasis ? "font-weight:700;padding-top:10px;" : ""}">${label}</td>
      <td style="padding:4px 0;font-family:Arial,sans-serif;font-size:${emphasis ? "16px" : "13px"};color:${negative ? "#2f6b32" : TEXT};text-align:right;${emphasis ? "font-weight:700;padding-top:10px;" : ""}">${negative ? "− " : ""}${value}</td>
    </tr>`;
}

/**
 * order: a full `orders` row.
 * storefrontUrl: e.g. process.env.STOREFRONT_URL — no trailing slash assumed.
 *
 * Returns { subject, html }.
 */
function buildOrderConfirmationEmail(order, storefrontUrl) {
    const items = Array.isArray(order.items) ? order.items : [];
    const address = order.shipping_address || {};
    const customer = order.customer_info || {};
    const accountUrl = `${storefrontUrl}/account?tab=orders`;

    const paymentLine =
        order.payment_method === "cod"
            ? "Cash on Delivery"
            : order.payment_status === "paid"
                ? "Paid online"
                : "Online payment";

    const html = `
<!doctype html>
<html>
<body style="margin:0;padding:0;background:${BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <img src="${LOGO_URL}" alt="JAAPA" width="64" style="display:inline-block;width:64px;height:auto;" />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:16px;padding:32px;">

              <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND_GOLD};font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Order confirmed</p>
              <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:${TEXT};">
                Thank you${customer.fullName ? `, ${escapeHtml(customer.fullName.split(" ")[0])}` : ""}!
              </h1>
              <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${MUTED};line-height:1.6;">
                Your order <strong style="color:${TEXT};">${escapeHtml(order.order_number)}</strong> was placed on ${formatDate(order.created_at)}
                and is now confirmed. ${paymentLine}.
              </p>

              <!-- Items -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${items.map(itemRow).join("")}
              </table>

              <!-- Totals -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                ${totalRow("Subtotal", formatINR(order.subtotal_amount))}
                ${Number(order.discount_amount) > 0 ? totalRow(`Discount${order.coupon_code ? ` (${escapeHtml(order.coupon_code)})` : ""}`, formatINR(order.discount_amount), { negative: true }) : ""}
                ${totalRow("Shipping", Number(order.shipping_amount) > 0 ? formatINR(order.shipping_amount) : "FREE")}
                ${Number(order.cod_fee) > 0 ? totalRow("COD Fee", formatINR(order.cod_fee)) : ""}
                ${totalRow(`GST (${order.tax_rate}%)`, formatINR(order.tax_amount))}
                <tr><td colspan="2" style="border-top:1px solid ${BORDER};padding-top:4px;"></td></tr>
                ${totalRow("Total", formatINR(order.total_amount), { emphasis: true })}
              </table>

              <!-- Shipping address -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">
                    Shipping to
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,sans-serif;font-size:14px;color:${TEXT};line-height:1.6;">
                    ${escapeHtml(address.fullName)}<br />
                    ${escapeHtml(address.address1)}${address.address2 ? `, ${escapeHtml(address.address2)}` : ""}<br />
                    ${escapeHtml(address.city)}, ${escapeHtml(address.state)} ${escapeHtml(address.pincode)}<br />
                    ${escapeHtml(address.phone)}
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
                <tr>
                  <td align="center">
                    <a href="${accountUrl}" style="display:inline-block;background:${BRAND_DARK};color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.5px;text-decoration:none;padding:14px 32px;border-radius:999px;">
                      VIEW YOUR ORDER
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 8px;text-align:center;">
              <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;color:${MUTED};">
                Questions about your order? We're here to help.
              </p>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:${MUTED};">
                <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_DARK};text-decoration:none;">${SUPPORT_EMAIL}</a>
                &nbsp;·&nbsp; ${SUPPORT_PHONE} &nbsp;·&nbsp; ${SUPPORT_HOURS}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return {
        subject: `Order confirmed — ${order.order_number}`,
        html,
    };
}

module.exports = { buildOrderConfirmationEmail };
