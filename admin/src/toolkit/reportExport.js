// Turning a report into a file the client can actually keep.
//
// CSV and JSON are built in the browser and saved via a Blob; PDF goes
// through the browser's own print-to-PDF, which keeps this dependency-free
// and always matches what's on screen.

export const EXPORT_FORMATS = [
    { id: "csv", label: "CSV (Excel, Sheets)", extension: "csv" },
    { id: "json", label: "JSON (developers)", extension: "json" },
    { id: "pdf", label: "PDF (print)", extension: "pdf" },
];

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Escapes one cell.
 *
 * The leading apostrophe on =, +, -, @ matters: Excel and Sheets treat those
 * as the start of a formula, so a product named "=cmd|..." in an exported
 * file becomes a code-execution prompt when someone opens it.
 */
function escapeCell(value) {
    if (value === null || value === undefined) return "";

    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    if (/["\n,;]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
    return text;
}

export function toCsv(columns, rows) {
    const header = columns.map((column) => escapeCell(column.label)).join(",");
    const body = rows.map((row) =>
        columns.map((column) => escapeCell(row[column.key])).join(",")
    );
    return [header, ...body].join("\r\n");
}

/* ------------------------------------------------------------------ */
/* Downloading                                                         */
/* ------------------------------------------------------------------ */

export function downloadBlob(filename, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return blob.size;
}

/** Slug like "sales-report_2026-07-01_2026-07-31.csv". */
export function reportFilename(report, extension) {
    const slug = report.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return `${slug}_${report.from}_to_${report.to}.${extension}`;
}

/* ------------------------------------------------------------------ */
/* Printable HTML (used for PDF)                                       */
/* ------------------------------------------------------------------ */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatCell(column, row) {
    const raw = row[column.key];
    return column.format ? column.format(raw) : raw;
}

export function buildPrintableHtml(report, { storeName = "JAAPA" } = {}) {
    const generated = new Date(report.generatedAt).toLocaleString("en-IN");

    const summary = report.summary
        .map(
            (item) => `
        <div class="tile">
          <p class="tile-label">${escapeHtml(item.label)}</p>
          <p class="tile-value">${escapeHtml(item.value)}</p>
        </div>`
        )
        .join("");

    const head = report.columns
        .map((column) => `<th class="${column.align === "right" ? "right" : ""}">${escapeHtml(column.label)}</th>`)
        .join("");

    const body = report.rows
        .map(
            (row) =>
                `<tr>${report.columns
                    .map(
                        (column) =>
                            `<td class="${column.align === "right" ? "right" : ""}">${escapeHtml(formatCell(column, row))}</td>`
                    )
                    .join("")}</tr>`
        )
        .join("");

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(report.title)} — ${escapeHtml(report.from)} to ${escapeHtml(report.to)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1f2937; margin: 28px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #6b7280; margin-bottom: 18px; }
  .tiles { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
  .tile { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; min-width: 140px; }
  .tile-label { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #9ca3af; margin: 0 0 4px; }
  .tile-value { font-size: 15px; font-weight: 600; margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border-bottom: 1px solid #e5e7eb; padding: 7px 8px; text-align: left; }
  th { background: #f9fafb; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
  td.right, th.right { text-align: right; }
  tfoot { font-size: 10px; color: #9ca3af; }
  /* Repeat the header on every printed page and never split a row */
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  @page { margin: 14mm; }
</style>
</head>
<body>
  <h1>${escapeHtml(storeName)} — ${escapeHtml(report.title)}</h1>
  <p class="meta">
    ${escapeHtml(report.from)} to ${escapeHtml(report.to)} ·
    ${report.rows.length} row${report.rows.length === 1 ? "" : "s"} ·
    generated ${escapeHtml(generated)}
  </p>
  <div class="tiles">${summary}</div>
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
</body>
</html>`;
}

/**
 * Prints via a hidden iframe rather than window.open — popup blockers stop
 * the latter, and this keeps the admin page itself out of the printout.
 */
export function printReport(report, options) {
    const html = buildPrintableHtml(report, options);

    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);

    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) {
        frame.remove();
        throw new Error("Your browser blocked the print view.");
    }

    doc.open();
    doc.write(html);
    doc.close();

    // Give the iframe a tick to lay the document out before printing, then
    // clean it up once the dialog is done with it.
    frame.onload = () => {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        setTimeout(() => frame.remove(), 1000);
    };

    return new Blob([html]).size;
}

/* ------------------------------------------------------------------ */
/* One entry point the UI calls                                        */
/* ------------------------------------------------------------------ */

/** Returns the size in bytes of whatever was produced. */
export function exportReport(report, format, options) {
    if (format === "csv") {
        // The BOM is what makes Excel read ₹ and accented names correctly.
        const csv = `﻿${toCsv(report.columns, report.rows)}`;
        return downloadBlob(reportFilename(report, "csv"), "text/csv;charset=utf-8", csv);
    }

    if (format === "json") {
        const json = JSON.stringify(
            {
                report: report.title,
                from: report.from,
                to: report.to,
                generatedAt: report.generatedAt,
                summary: report.summary,
                rows: report.rows,
            },
            null,
            2
        );
        return downloadBlob(reportFilename(report, "json"), "application/json", json);
    }

    if (format === "pdf") {
        return printReport(report, options);
    }

    throw new Error(`Unknown export format: ${format}`);
}

export function formatBytes(bytes) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
