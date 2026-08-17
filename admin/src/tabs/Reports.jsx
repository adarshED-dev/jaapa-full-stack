import React, { useEffect, useState } from "react";
import {
  FileText,
  Download,
  Package,
  Users,
  Receipt,
  TrendingUp,
  Loader2,
  AlertCircle,
  Printer,
  ChevronDown,
  RotateCcw,
} from "lucide-react";

import {
  REPORT_TYPES,
  DATE_PRESETS,
  resolvePreset,
  generateReport,
  formatDate,
} from "../toolkit/reportData";
import { EXPORT_FORMATS, exportReport, formatBytes } from "../toolkit/reportExport";

const TYPE_ICONS = {
  sales: TrendingUp,
  inventory: Package,
  customers: Users,
  tax: Receipt,
};

const PREVIEW_ROWS = 12;
const RECENT_STORAGE_KEY = "jaapa_admin_recent_reports";

function readRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecent(entries) {
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(entries.slice(0, 8)));
}

const inputClasses =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100";

function Select({ value, onChange, options, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <select value={value} onChange={onChange} className={`${inputClasses} w-full appearance-none pr-9`}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

export default function Reports() {
  const [typeId, setTypeId] = useState("sales");
  const [preset, setPreset] = useState("last30");
  const [range, setRange] = useState(() => resolvePreset("last30"));
  const [format, setFormat] = useState("csv");

  const [report, setReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [recent, setRecent] = useState(readRecent);

  // Picking a preset rewrites the dates; "custom" leaves them alone so they
  // can be edited by hand.
  useEffect(() => {
    if (preset === "custom") return;
    setRange(resolvePreset(preset));
  }, [preset]);

  const rangeIsValid = range.from && range.to && range.from <= range.to;

  async function handleGenerate(nextTypeId = typeId) {
    if (!rangeIsValid) {
      setError("The start date has to come before the end date.");
      return;
    }

    setTypeId(nextTypeId);
    setError(null);
    setGenerating(true);
    try {
      setReport(await generateReport(nextTypeId, range.from, range.to));
    } catch (generateError) {
      console.error(generateError);
      setError("Couldn't generate this report. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function recordRecent(generated, size, usedFormat) {
    const entry = {
      id: `${generated.typeId}_${Date.now()}`,
      typeId: generated.typeId,
      title: generated.title,
      from: generated.from,
      to: generated.to,
      format: usedFormat,
      size,
      generatedAt: new Date().toISOString(),
    };
    const next = [entry, ...recent];
    setRecent(next);
    writeRecent(next);
  }

  async function handleExport(target = report, usedFormat = format) {
    if (!target) return;
    setError(null);
    setExporting(true);
    try {
      const size = exportReport(target, usedFormat);
      recordRecent(target, size, usedFormat);
    } catch (exportError) {
      console.error(exportError);
      setError(exportError.message || "Couldn't export this report.");
    } finally {
      setExporting(false);
    }
  }

  // Recent entries store their parameters, not the data, so re-downloading
  // rebuilds the report rather than serving something stale.
  async function handleRedownload(entry) {
    setError(null);
    setExporting(true);
    try {
      const rebuilt = await generateReport(entry.typeId, entry.from, entry.to);
      exportReport(rebuilt, entry.format);
    } catch (redownloadError) {
      console.error(redownloadError);
      setError("Couldn't rebuild that report.");
    } finally {
      setExporting(false);
    }
  }

  const previewRows = report ? report.rows.slice(0, PREVIEW_ROWS) : [];

  return (
    <div className="flex flex-col gap-5">
      {/* Report type cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {REPORT_TYPES.map((type) => {
          const Icon = TYPE_ICONS[type.id] || FileText;
          const isActive = type.id === typeId;
          return (
            <div
              key={type.id}
              className={`flex flex-col justify-between rounded-2xl border bg-white p-5 transition-colors ${
                isActive ? "border-emerald-200 ring-1 ring-emerald-100" : "border-gray-100"
              }`}
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                  <Icon className="h-5 w-5 text-emerald-700" strokeWidth={1.9} />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900">{type.name}</p>
                <p className="mt-1 text-xs text-gray-400">{type.description}</p>
              </div>
              <button
                onClick={() => handleGenerate(type.id)}
                disabled={generating}
                className={`mt-4 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors disabled:opacity-60 ${
                  isActive
                    ? "bg-emerald-800 text-white hover:bg-emerald-900"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {generating && isActive && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {generating && isActive ? "Syncing..." : "Sync Data"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-500">Date range</span>
              <Select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                options={DATE_PRESETS}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-500">From</span>
              <input
                type="date"
                value={range.from}
                max={range.to}
                onChange={(e) => {
                  setPreset("custom");
                  setRange((prev) => ({ ...prev, from: e.target.value }));
                }}
                className={inputClasses}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-500">To</span>
              <input
                type="date"
                value={range.to}
                min={range.from}
                onChange={(e) => {
                  setPreset("custom");
                  setRange((prev) => ({ ...prev, to: e.target.value }));
                }}
                className={inputClasses}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-500">Format</span>
              <Select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                options={EXPORT_FORMATS}
              />
            </label>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              onClick={() => handleGenerate()}
              disabled={generating || !rangeIsValid}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 text-gray-400" />}
              {generating ? "Syncing..." : "Sync Data Report"}
            </button>
            <button
              onClick={() => handleExport()}
              disabled={!report || exporting || generating}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : format === "pdf" ? (
                <Printer className="h-4 w-4" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {format === "pdf" ? "Print / Save PDF" : "Download"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Generated report */}
      {report && (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900">{report.title}</h2>
              <p className="text-xs text-gray-400">
                {formatDate(report.from)} – {formatDate(report.to)} · {report.rows.length} row
                {report.rows.length === 1 ? "" : "s"}
              </p>
            </div>
            <span className="text-xs text-gray-400">
              Generated {new Date(report.generatedAt).toLocaleTimeString("en-IN")}
            </span>
          </div>

          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-px border-y border-gray-100 bg-gray-100 sm:grid-cols-3 xl:grid-cols-6">
            {report.summary.map((item) => (
              <div key={item.label} className="bg-white px-5 py-4">
                <p className="text-[11px] uppercase tracking-wide text-gray-400">{item.label}</p>
                <p className="mt-1 text-base font-semibold text-gray-900">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-400">
                  {report.columns.map((column) => (
                    <th
                      key={column.key}
                      className={`px-5 py-3 font-medium ${column.align === "right" ? "text-right" : ""}`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {previewRows.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50/50">
                    {report.columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-5 py-3 text-gray-600 ${column.align === "right" ? "text-right" : ""}`}
                      >
                        {column.format ? column.format(row[column.key]) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
                {previewRows.length === 0 && (
                  <tr>
                    <td colSpan={report.columns.length} className="px-5 py-10 text-center text-sm text-gray-400">
                      No data in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {report.rows.length > PREVIEW_ROWS && (
            <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
              Showing the first {PREVIEW_ROWS} of {report.rows.length} rows — the download contains all of them.
            </p>
          )}
        </div>
      )}

      {/* Recent reports */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-[15px] font-semibold text-gray-900">Recent Reports</h2>
          {recent.length > 0 && (
            <button
              onClick={() => {
                setRecent([]);
                writeRecent([]);
              }}
              className="text-xs font-medium text-gray-400 hover:text-gray-700"
            >
              Clear history
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="border-t border-b border-gray-100 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Report</th>
                <th className="px-5 py-3 font-medium">Format</th>
                <th className="px-5 py-3 font-medium">Generated</th>
                <th className="px-5 py-3 font-medium">Size</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recent.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-2.5 font-medium text-gray-800">
                      <FileText className="h-4 w-4 text-gray-300" />
                      <span>
                        {entry.title}
                        <span className="ml-1.5 text-xs font-normal text-gray-400">
                          {formatDate(entry.from)} – {formatDate(entry.to)}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 uppercase text-gray-500">{entry.format}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {new Date(entry.generatedAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{formatBytes(entry.size)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleRedownload(entry)}
                      disabled={exporting}
                      title="Rebuild and download again"
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                    Nothing generated yet — pick a report above and hit Sync Data.
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
