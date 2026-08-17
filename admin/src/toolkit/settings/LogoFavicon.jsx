import React, { useState } from "react";
import { Image as ImageIcon, UploadCloud, Loader2, Trash2 } from "lucide-react";
import { Card, FieldBlock, SettingsPanel, Banner } from "./FormControls";
import { useSettingsSection, uploadBrandingAsset } from "./settingsApi";

const DEFAULTS = {
  logoUrl: "",
  logoDarkUrl: "",
  faviconUrl: "",
  altText: "",
};

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — plenty for a logo, keeps pages fast

/**
 * One drop zone + preview. The file is uploaded as soon as it's chosen so the
 * preview is real; `onChange` then stores the returned URL in the form, and
 * the panel's Save button persists it.
 */
function AssetUploader({
  label,
  hint,
  accept = "image/png,image/jpeg,image/svg+xml,image/webp",
  value,
  onChange,
  previewClassName = "h-16 w-auto max-w-[220px]",
  previewBoxClassName = "h-24",
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFile(file) {
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Please pick a file under 2 MB.");
      return;
    }

    setUploading(true);
    try {
      const url = await uploadBrandingAsset(file);
      onChange(url);
    } catch (err) {
      console.error(err);
      setError(
        err.response
          ? `Upload failed — server responded with ${err.response.status}.`
          : "Upload failed — couldn't reach the server."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <FieldBlock label={label} hint={error ? undefined : hint} error={error}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Preview — checkerboard so transparent PNGs are readable */}
        <div
          className={`flex ${previewBoxClassName} w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-[length:14px_14px] bg-[linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f4f6_75%),linear-gradient(-45deg,transparent_75%,#f3f4f6_75%)] bg-[position:0_0,0_7px,7px_-7px,-7px_0] sm:w-56`}
        >
          {value ? (
            <img src={value} alt={label} className={`${previewClassName} object-contain`} />
          ) : (
            <span className="text-xs text-gray-400">No image yet</span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <input
                type="file"
                accept={accept}
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <UploadCloud className="h-4 w-4 text-gray-400" />
              )}
              {uploading ? "Uploading..." : value ? "Replace" : "Upload"}
            </label>

            {value && !uploading && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            )}
          </div>

          {value && (
            <p className="truncate text-xs text-gray-400" title={value}>
              {value}
            </p>
          )}
        </div>
      </div>
    </FieldBlock>
  );
}

export default function LogoFavicon() {
  const state = useSettingsSection("logo-favicon", DEFAULTS);
  const { form, update } = state;

  return (
    <SettingsPanel
      icon={ImageIcon}
      title="Logo & Favicon"
      description="Brand assets shown across the storefront, checkout and browser tab."
      state={state}
    >
      <Card title="Store logo" description="Recommended: SVG or transparent PNG, at least 240 px tall.">
        <div className="flex flex-col gap-6">
          <AssetUploader
            label="Primary logo"
            hint="Shown in the storefront header and on invoices."
            value={form.logoUrl}
            onChange={(url) => update("logoUrl", url)}
          />
          <AssetUploader
            label="Logo for dark backgrounds"
            hint="Optional — used in the footer and any dark section."
            value={form.logoDarkUrl}
            onChange={(url) => update("logoDarkUrl", url)}
          />
        </div>
      </Card>

      <Card title="Favicon" description="Recommended: square PNG, ICO or SVG at 32 × 32 px or larger.">
        <AssetUploader
          label="Browser tab icon"
          hint="Shown in browser tabs, bookmarks and mobile home-screen shortcuts."
          accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
          value={form.faviconUrl}
          onChange={(url) => update("faviconUrl", url)}
          previewClassName="h-10 w-10"
          previewBoxClassName="h-24"
        />
      </Card>

      <Card title="Accessibility">
        <FieldBlock
          label="Logo alt text"
          hint="Read aloud by screen readers and shown if the image fails to load."
        >
          <input
            value={form.altText}
            onChange={(e) => update("altText", e.target.value)}
            placeholder="JAAPA — Rooted in Ayurveda"
            className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </FieldBlock>
      </Card>

      {!form.faviconUrl && (
        <Banner tone="info">
          No favicon set yet — browsers will fall back to a blank page icon for your store.
        </Banner>
      )}
    </SettingsPanel>
  );
}
