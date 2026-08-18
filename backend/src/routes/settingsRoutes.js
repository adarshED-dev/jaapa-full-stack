// Store settings, one JSON blob per section. Run sql/store-settings.sql once
// before using these routes.
//
// GET    /api/settings                  -> { settings: { "store-details": {...}, ... } }
// GET    /api/settings/:section         -> { settings: {...} }
// PUT    /api/settings/:section         -> { settings: {...} }   body: { data: {...} }
// POST   /api/settings/upload-branding  -> { url }               field: "file"

const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const uploadBranding = require("../middleware/uploadBranding");
const { publicUploadUrl } = require("../services/uploadUrl");
const { requireAdmin } = require("../middleware/requireAdmin");

function parseJsonField(value, fallback) {
    if (value == null) return fallback;
    if (Array.isArray(value) || typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function settingsRowData(row) {
    return parseJsonField(row?.data, {});
}

// Every route below is admin-only: this is store configuration (GST rates,
// policy text, billing info) with no public reader — the storefront reads
// GST straight from the DB (see services/pricing.js), never through this
// HTTP route.
router.use(requireAdmin);

// Whitelisted so a typo in the admin panel can't quietly create a section
// nothing ever reads back.
const SECTIONS = [
    "store-details",
    "meta-data",
    "logo-favicon",
    "gst-settings",
    "email-notifications",
    "domains",
    "policies",
    "billing",
];

router.post("/upload-branding", (req, res) => {
    uploadBranding.single("file")(req, res, (error) => {
        if (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file was uploaded" });
        }
        res.json({
            success: true,
            url: publicUploadUrl("branding", req.file.filename),
        });
    });
});

router.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT section, data FROM store_settings");
        const settings = Object.fromEntries(result.rows.map((row) => [row.section, settingsRowData(row)]));
        res.json({ success: true, settings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load store settings" });
    }
});

router.get("/:section", async (req, res) => {
    if (!SECTIONS.includes(req.params.section)) {
        return res.status(404).json({ success: false, message: "Unknown settings section" });
    }

    try {
        const result = await pool.query(
            "SELECT data FROM store_settings WHERE section = $1",
            [req.params.section]
        );
        // A section that's never been saved is not an error — the admin panel
        // falls back to its own empty defaults.
        res.json({ success: true, settings: settingsRowData(result.rows[0]) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load these settings" });
    }
});

router.put("/:section", async (req, res) => {
    if (!SECTIONS.includes(req.params.section)) {
        return res.status(404).json({ success: false, message: "Unknown settings section" });
    }

    const data = req.body.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return res.status(400).json({ success: false, message: "data must be an object" });
    }

    try {
        const existing = await pool.query(
            "SELECT section FROM store_settings WHERE section = $1",
            [req.params.section]
        );
        if (existing.rows.length > 0) {
            await pool.query(
                "UPDATE store_settings SET data = $2, updated_at = CURRENT_TIMESTAMP WHERE section = $1",
                [req.params.section, JSON.stringify(data)]
            );
        } else {
            await pool.query(
                "INSERT INTO store_settings (section, data) VALUES ($1, $2)",
                [req.params.section, JSON.stringify(data)]
            );
        }

        const result = await pool.query("SELECT data FROM store_settings WHERE section = $1", [req.params.section]);
        res.json({ success: true, settings: settingsRowData(result.rows[0]) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to save these settings" });
    }
});

module.exports = router;
