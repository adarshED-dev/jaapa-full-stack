// Report datasets.
//
// Every report is dummy data for now, but it's shaped exactly like what the
// API will return: { columns, rows, summary }. When the endpoints exist,
// replace the four build* functions with their fetch — Reports.jsx renders,
// exports and prints whatever shape comes back, so nothing else changes.
//
//   LIVE: GET /api/reports/:type?from=YYYY-MM-DD&to=YYYY-MM-DD
//         -> { columns: [...], rows: [...], summary: [...] }

/* ------------------------------------------------------------------ */
/* Deterministic randomness                                            */
/* ------------------------------------------------------------------ */

// Seeded so the same report over the same dates always produces the same
// numbers. Math.random() would reshuffle every render and make the preview
// disagree with the file you just downloaded.
function makeRandom(seedText) {
    let h = 1779033703 ^ String(seedText).length;
    for (let i = 0; i < String(seedText).length; i += 1) {
        h = Math.imul(h ^ String(seedText).charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return function random() {
        a += 0x6d2b79f5;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const between = (random, min, max) => Math.floor(random() * (max - min + 1)) + min;
const pick = (random, list) => list[Math.floor(random() * list.length)];
const round2 = (value) => Math.round(value * 100) / 100;

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

export function toISODate(date) {
    return date.toISOString().slice(0, 10);
}

export function eachDay(from, to) {
    const days = [];
    const cursor = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    // Guard against an inverted range producing an endless loop.
    while (cursor <= end && days.length < 400) {
        days.push(toISODate(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
}

export const DATE_PRESETS = [
    { id: "last7", label: "Last 7 days" },
    { id: "last30", label: "Last 30 days" },
    { id: "thisMonth", label: "This month" },
    { id: "lastMonth", label: "Last month" },
    { id: "thisQuarter", label: "This quarter" },
    { id: "custom", label: "Custom range" },
];

export function resolvePreset(id, today = new Date()) {
    const end = new Date(today);
    const start = new Date(today);

    switch (id) {
        case "last7":
            start.setDate(end.getDate() - 6);
            break;
        case "last30":
            start.setDate(end.getDate() - 29);
            break;
        case "thisMonth":
            start.setDate(1);
            break;
        case "lastMonth":
            start.setMonth(start.getMonth() - 1, 1);
            end.setDate(0); // last day of the previous month
            break;
        case "thisQuarter":
            start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
            break;
        default:
            start.setDate(end.getDate() - 29);
    }

    return { from: toISODate(start), to: toISODate(end) };
}

/* ------------------------------------------------------------------ */
/* Formatters used by the table and the printed report                 */
/* ------------------------------------------------------------------ */

export const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const formatNumber = (value) => Number(value || 0).toLocaleString("en-IN");

export const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

/* ------------------------------------------------------------------ */
/* Sample catalog / customers the reports draw from                    */
/* ------------------------------------------------------------------ */

const PRODUCTS = [
    { title: "Lactomama Tea", sku: "JP-LMT-200", category: "Postpartum Care", price: 699 },
    { title: "Stress Balance Oil", sku: "JP-SBO-030", category: "Wellness", price: 499 },
    { title: "Nourishing Drink Mix", sku: "JP-NDM-250", category: "Postpartum Care", price: 649 },
    { title: "Jatamansi Hair Oil", sku: "JP-JHO-030", category: "Hair Care", price: 549 },
    { title: "Detox Herbal Powder", sku: "JP-DHP-200", category: "Wellness", price: 499 },
    { title: "Postnatal Care Kit", sku: "JP-PNC-KIT", category: "Hampers", price: 2499 },
    { title: "Tulsi Drops", sku: "JP-TSD-030", category: "Wellness", price: 449 },
    { title: "Triphala Churna", sku: "JP-TPC-200", category: "Digestive", price: 429 },
];

const NAMES = [
    "Ananya Sharma", "Rhea Kapoor", "Meera Iyer", "Sneha Patil", "Divya Menon",
    "Kavya Reddy", "Priya Nair", "Ishita Bose", "Nandini Rao", "Aarti Desai",
];

const CITIES = [
    ["Indore", "Madhya Pradesh"], ["Mumbai", "Maharashtra"], ["Bengaluru", "Karnataka"],
    ["Chennai", "Tamil Nadu"], ["Delhi", "Delhi"], ["Pune", "Maharashtra"],
    ["Kochi", "Kerala"], ["Jaipur", "Rajasthan"],
];

/* ------------------------------------------------------------------ */
/* The four reports                                                    */
/* ------------------------------------------------------------------ */

function buildSalesReport(from, to) {
    const random = makeRandom(`sales|${from}|${to}`);
    const rows = eachDay(from, to).map((date) => {
        const orders = between(random, 3, 28);
        const units = orders + between(random, 0, orders);
        const gross = round2(units * between(random, 420, 1450));
        const discount = round2(gross * (between(random, 0, 12) / 100));
        const net = round2(gross - discount);
        const tax = round2(net - net / 1.18); // prices are GST-inclusive
        const refunds = random() > 0.88 ? round2(between(random, 400, 2200)) : 0;

        return { date, orders, units, gross, discount, tax, refunds, net: round2(net - refunds) };
    });

    const sum = (key) => round2(rows.reduce((total, row) => total + row[key], 0));
    const totalOrders = rows.reduce((total, row) => total + row.orders, 0);
    const net = sum("net");

    return {
        columns: [
            { key: "date", label: "Date", format: formatDate },
            { key: "orders", label: "Orders", align: "right", format: formatNumber },
            { key: "units", label: "Units", align: "right", format: formatNumber },
            { key: "gross", label: "Gross Sales", align: "right", format: formatCurrency },
            { key: "discount", label: "Discounts", align: "right", format: formatCurrency },
            { key: "refunds", label: "Refunds", align: "right", format: formatCurrency },
            { key: "tax", label: "GST", align: "right", format: formatCurrency },
            { key: "net", label: "Net Sales", align: "right", format: formatCurrency },
        ],
        rows,
        summary: [
            { label: "Net sales", value: formatCurrency(net) },
            { label: "Orders", value: formatNumber(totalOrders) },
            { label: "Average order value", value: formatCurrency(totalOrders ? net / totalOrders : 0) },
            { label: "Discounts given", value: formatCurrency(sum("discount")) },
            { label: "GST collected", value: formatCurrency(sum("tax")) },
            { label: "Refunds", value: formatCurrency(sum("refunds")) },
        ],
    };
}

function buildInventoryReport(from, to) {
    const random = makeRandom(`inventory|${from}|${to}`);
    const rows = PRODUCTS.map((product) => {
        const threshold = between(random, 8, 20);
        const quantity = between(random, 0, 60);
        const sold = between(random, 5, 90);

        return {
            title: product.title,
            sku: product.sku,
            category: product.category,
            quantity,
            threshold,
            sold,
            stockValue: round2(quantity * product.price),
            status: quantity === 0 ? "Out of stock" : quantity <= threshold ? "Low stock" : "In stock",
        };
    });

    return {
        columns: [
            { key: "title", label: "Product" },
            { key: "sku", label: "SKU" },
            { key: "category", label: "Category" },
            { key: "quantity", label: "In Stock", align: "right", format: formatNumber },
            { key: "threshold", label: "Low Stock At", align: "right", format: formatNumber },
            { key: "sold", label: "Units Sold", align: "right", format: formatNumber },
            { key: "stockValue", label: "Stock Value", align: "right", format: formatCurrency },
            { key: "status", label: "Status" },
        ],
        rows,
        summary: [
            { label: "Products tracked", value: formatNumber(rows.length) },
            { label: "Units in stock", value: formatNumber(rows.reduce((t, r) => t + r.quantity, 0)) },
            { label: "Stock value", value: formatCurrency(rows.reduce((t, r) => t + r.stockValue, 0)) },
            { label: "Low stock", value: formatNumber(rows.filter((r) => r.status === "Low stock").length) },
            { label: "Out of stock", value: formatNumber(rows.filter((r) => r.status === "Out of stock").length) },
        ],
    };
}

function buildCustomerReport(from, to) {
    const random = makeRandom(`customers|${from}|${to}`);
    const days = eachDay(from, to);

    const rows = NAMES.map((name, index) => {
        const [city, state] = pick(random, CITIES);
        const orders = between(random, 1, 9);
        const spent = round2(orders * between(random, 480, 2600));
        const firstOrder = days[between(random, 0, Math.max(0, days.length - 1))];
        const lastOrder = days[between(random, 0, Math.max(0, days.length - 1))];

        return {
            name,
            email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
            phone: `98${between(random, 10000000, 99999999)}`,
            city,
            state,
            orders,
            spent,
            type: orders > 1 ? "Returning" : "New",
            firstOrder: firstOrder < lastOrder ? firstOrder : lastOrder,
            lastOrder: firstOrder < lastOrder ? lastOrder : firstOrder,
            _index: index,
        };
    }).map(({ _index, ...row }) => row);

    const totalSpent = round2(rows.reduce((total, row) => total + row.spent, 0));

    return {
        columns: [
            { key: "name", label: "Customer" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "city", label: "City" },
            { key: "state", label: "State" },
            { key: "type", label: "Type" },
            { key: "orders", label: "Orders", align: "right", format: formatNumber },
            { key: "spent", label: "Total Spent", align: "right", format: formatCurrency },
            { key: "firstOrder", label: "First Order", format: formatDate },
            { key: "lastOrder", label: "Last Order", format: formatDate },
        ],
        rows,
        summary: [
            { label: "Customers", value: formatNumber(rows.length) },
            { label: "New", value: formatNumber(rows.filter((r) => r.type === "New").length) },
            { label: "Returning", value: formatNumber(rows.filter((r) => r.type === "Returning").length) },
            { label: "Revenue", value: formatCurrency(totalSpent) },
            { label: "Average per customer", value: formatCurrency(rows.length ? totalSpent / rows.length : 0) },
        ],
    };
}

function buildTaxReport(from, to) {
    const random = makeRandom(`tax|${from}|${to}`);
    const slabs = [5, 12, 18];

    // One row per slab per month in the range — the shape a CA expects.
    const months = [...new Set(eachDay(from, to).map((day) => day.slice(0, 7)))];
    const rows = [];

    for (const month of months) {
        for (const rate of slabs) {
            const taxable = round2(between(random, 18000, 240000));
            const tax = round2((taxable * rate) / 100);
            const interState = random() > 0.55;

            rows.push({
                period: `${month}-01`,
                rate,
                taxableValue: taxable,
                cgst: interState ? 0 : round2(tax / 2),
                sgst: interState ? 0 : round2(tax / 2),
                igst: interState ? tax : 0,
                totalTax: tax,
                supply: interState ? "Inter-state" : "Intra-state",
            });
        }
    }

    const sum = (key) => round2(rows.reduce((total, row) => total + row[key], 0));

    return {
        columns: [
            { key: "period", label: "Period", format: (v) => formatDate(v).slice(3) },
            { key: "supply", label: "Supply" },
            { key: "rate", label: "Rate", align: "right", format: (v) => `${v}%` },
            { key: "taxableValue", label: "Taxable Value", align: "right", format: formatCurrency },
            { key: "cgst", label: "CGST", align: "right", format: formatCurrency },
            { key: "sgst", label: "SGST", align: "right", format: formatCurrency },
            { key: "igst", label: "IGST", align: "right", format: formatCurrency },
            { key: "totalTax", label: "Total Tax", align: "right", format: formatCurrency },
        ],
        rows,
        summary: [
            { label: "Taxable value", value: formatCurrency(sum("taxableValue")) },
            { label: "CGST", value: formatCurrency(sum("cgst")) },
            { label: "SGST", value: formatCurrency(sum("sgst")) },
            { label: "IGST", value: formatCurrency(sum("igst")) },
            { label: "Total GST", value: formatCurrency(sum("totalTax")) },
        ],
    };
}

/* ------------------------------------------------------------------ */
/* Public surface                                                      */
/* ------------------------------------------------------------------ */

export const REPORT_TYPES = [
    {
        id: "sales",
        name: "Sales Report",
        description: "Revenue, orders and refunds by period.",
        build: buildSalesReport,
    },
    {
        id: "inventory",
        name: "Inventory Report",
        description: "Stock levels and low-stock alerts.",
        build: buildInventoryReport,
    },
    {
        id: "customers",
        name: "Customer Report",
        description: "New vs returning customer breakdown.",
        build: buildCustomerReport,
    },
    {
        id: "tax",
        name: "Tax Report",
        description: "GST collected, split by rate slab.",
        build: buildTaxReport,
    },
];

export function getReportType(id) {
    return REPORT_TYPES.find((type) => type.id === id) || REPORT_TYPES[0];
}

/**
 * Builds a report. Async, and slow enough to show a spinner, because the real
 * version will be a network call — the UI already handles that.
 *
 * LIVE: const { data } = await axios.get(`.../api/reports/${typeId}`, { params: { from, to } });
 *       return { ...data, typeId, from, to, generatedAt: new Date().toISOString() };
 */
export async function generateReport(typeId, from, to) {
    const type = getReportType(typeId);
    await new Promise((resolve) => setTimeout(resolve, 450));

    const { columns, rows, summary } = type.build(from, to);
    return {
        typeId: type.id,
        title: type.name,
        from,
        to,
        generatedAt: new Date().toISOString(),
        columns,
        rows,
        summary,
    };
}
