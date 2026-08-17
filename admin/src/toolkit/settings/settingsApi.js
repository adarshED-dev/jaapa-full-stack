// Data layer for the Settings tab.
//
// Every section is stored server-side as one JSON blob keyed by its sidebar
// id ("store-details", "gst-settings", ...):
//   GET  /api/settings/:section  -> { settings: {...} }
//   PUT  /api/settings/:section  -> { settings: {...} }
// Requests go through src/lib/api.js so the admin access token rides along.
// See backend/src/routes/settingsRoutes.js and backend/sql/store-settings.sql.

import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../lib/api";

const SETTINGS_URL = "/settings";

export async function fetchSection(section) {
  const response = await api.get(`${SETTINGS_URL}/${section}`);
  return response.data.settings || {};
}

export async function saveSection(section, data) {
  const response = await api.put(`${SETTINGS_URL}/${section}`, { data });
  return response.data.settings || data;
}

/**
 * Uploads a logo/favicon File and returns its public URL.
 * The field name "file" must match upload.single("file") on the Express side.
 */
export async function uploadBrandingAsset(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post(`${SETTINGS_URL}/upload-branding`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.url;
}

function describeError(error, fallback) {
  if (error?.response) return `Server responded with ${error.response.status}. ${fallback}`;
  return `Couldn't reach the server. ${fallback}`;
}

/**
 * Load / edit / save state for a single settings section.
 *
 * `defaults` is the empty shape of the section — anything the server hasn't
 * stored yet falls back to it, so a fresh install renders blank fields
 * instead of crashing on undefined.
 *
 * `validate` (optional) receives the form and returns a { field: message }
 * object. A non-empty result blocks the save and surfaces inline errors.
 */
export function useSettingsSection(section, defaults, validate) {
  const [form, setForm] = useState(defaults);
  const [snapshot, setSnapshot] = useState(defaults); // last persisted state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [errors, setErrors] = useState({});

  const savedTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    fetchSection(section)
      .then((stored) => {
        if (cancelled) return;
        const merged = { ...defaults, ...stored };
        setForm(merged);
        setSnapshot(merged);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(error);
        setLoadError(
          describeError(error, "Showing empty fields — saving will still work once it's back.")
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `defaults` is a module-level constant in every panel, so section alone
    // decides when a reload is needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const update = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }, []);

  const discard = useCallback(() => {
    setForm(snapshot);
    setErrors({});
    setSaveError(null);
  }, [snapshot]);

  const save = useCallback(async () => {
    const found = validate ? validate(form) : {};
    const cleaned = Object.fromEntries(Object.entries(found).filter(([, v]) => v));
    setErrors(cleaned);
    if (Object.keys(cleaned).length > 0) {
      setSaveError("Please fix the highlighted fields before saving.");
      return;
    }

    setSaveError(null);
    setSaving(true);
    try {
      const stored = await saveSection(section, form);
      const merged = { ...defaults, ...stored };
      setForm(merged);
      setSnapshot(merged);
      setJustSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 4000);
    } catch (error) {
      console.error(error);
      setSaveError(describeError(error, "Your changes were not saved."));
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, section, validate]);

  const dirty = JSON.stringify(form) !== JSON.stringify(snapshot);

  return {
    form,
    setForm,
    update,
    errors,
    loading,
    loadError,
    saving,
    saveError,
    justSaved,
    dirty,
    save,
    discard,
  };
}

/* ------------------------------------------------------------------ */
/* Validation helpers                                                  */
/* ------------------------------------------------------------------ */

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((value || "").trim());

// Indian mobile numbers: 10 digits starting 6-9, optional +91 / 0 prefix.
export const isMobile = (value) =>
  /^(\+?91[-\s]?|0)?[6-9]\d{9}$/.test((value || "").replace(/[\s-]/g, ""));

export const isPincode = (value) => /^[1-9]\d{5}$/.test((value || "").trim());

// 22AAAAA0000A1Z5 — state code, PAN, entity number, Z, checksum.
export const isGstin = (value) =>
  /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test((value || "").trim().toUpperCase());

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

// State name -> GST state code, used by the GST rate table.
export const INDIAN_STATES = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];

export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];
