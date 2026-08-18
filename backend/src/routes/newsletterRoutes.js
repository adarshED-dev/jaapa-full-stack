// Brochure / newsletter lead capture.
//
//   POST /api/newsletter/subscribe   { email }  -> { brochureUrl }   public
//   GET  /api/newsletter/brochure               -> the PDF itself    public
//   POST /api/newsletter/brochure    (file)     -> upload it         admin
//   GET  /api/newsletter/leads                  -> lead list + CSV   admin
//
// Subscribing creates a `customers` row flagged is_brochure_lead, so brochure
// leads and buyers live in one list. Someone who later orders keeps the same
// row and simply gains an order history.

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { randomUUID } = require("crypto");

const pool = require("../config/db");
const { requireAdmin } = require("../middleware/requireAdmin");
const { EMAIL_RE, clean } = require("../services/validation");
const { publicUploadUrl } = require("../services/uploadUrl");

const BROCHURE_DIR = path.join(__dirname, "../../uploads/brochure");
const BROCHURE_SETTINGS_SECTION = "brochure";

function parseJsonField(value, fallback) {
    if (value == null) return fallback;
    if (Array.isArray(value) || typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function isUniqueViolation(error) {
    return error?.code === "23505" || error?.code === "ER_DUP_ENTRY";
}

async function saveSettings(section, data) {
    const existing = await pool.query("SELECT section FROM store_settings WHERE section = $1", [section]);
    if (existing.rows.length > 0) {
        await pool.query(
            "UPDATE store_settings SET data = $2, updated_at = CURRENT_TIMESTAMP WHERE section = $1",
            [section, JSON.stringify(data)]
        );
        return;
    }

    await pool.query(
        "INSERT INTO store_settings (section, data) VALUES ($1, $2)",
        [section, JSON.stringify(data)]
    );
}

async function updateNewsletterLead(customerId, fullName) {
    await pool.query(
        `UPDATE customers
         SET accepts_marketing = TRUE,
             is_brochure_lead = TRUE,
             full_name = COALESCE(full_name, $2),
             source = COALESCE(source, 'brochure'),
             subscribed_at = COALESCE(subscribed_at, CURRENT_TIMESTAMP),
             brochure_downloaded_at = CURRENT_TIMESTAMP,
             brochure_download_count = brochure_download_count + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [customerId, fullName]
    );

    const result = await pool.query(
        "SELECT id, email, brochure_download_count FROM customers WHERE id = $1",
        [customerId]
    );
    return result.rows[0];
}

async function saveNewsletterLead(email, fullName) {
    const existing = await pool.query(
        "SELECT id FROM customers WHERE LOWER(email) = $1 ORDER BY created_at ASC LIMIT 1",
        [email]
    );

    if (existing.rows.length > 0) {
        return updateNewsletterLead(existing.rows[0].id, fullName);
    }

    const id = randomUUID();
    try {
        await pool.query(
            `INSERT INTO customers
                 (id, email, full_name, accepts_marketing, is_brochure_lead, source,
                  subscribed_at, brochure_downloaded_at, brochure_download_count)
             VALUES ($1, $2, $3, TRUE, TRUE, 'brochure',
                     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)`,
            [id, email, fullName]
        );
    } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const retry = await pool.query(
            "SELECT id FROM customers WHERE LOWER(email) = $1 ORDER BY created_at ASC LIMIT 1",
            [email]
        );
        if (retry.rows.length === 0) throw error;
        return updateNewsletterLead(retry.rows[0].id, fullName);
    }

    const result = await pool.query(
        "SELECT id, email, brochure_download_count FROM customers WHERE id = $1",
        [id]
    );
    return result.rows[0];
}

/* ------------------------------------------------------------------ */
/* Per-IP throttle                                                     */
/* ------------------------------------------------------------------ */

// A public form that writes to the customer table is exactly the kind of
// thing that gets scripted, so one machine can't stuff the list.
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 20;
const hits = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) if (now > entry.resetAt) hits.delete(ip);
}, RATE_WINDOW_MS).unref();

function clientIp(req) {
    return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || null;
}

function rateLimit(req, res, next) {
    const ip = clientIp(req) || "unknown";
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now > entry.resetAt) {
        hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return next();
    }

    entry.count += 1;
    if (entry.count > RATE_MAX) {
        return res.status(429).json({
            success: false,
            message: "Too many requests. Please try again later.",
        });
    }
    next();
}

/* ------------------------------------------------------------------ */
/* Where the brochure file lives                                       */
/* ------------------------------------------------------------------ */

/** The filename saved by the admin upload, or null if none has been uploaded. */
async function currentBrochure() {
    try {
        const result = await pool.query(
            "SELECT data FROM store_settings WHERE section = $1",
            [BROCHURE_SETTINGS_SECTION]
        );
        const filename = parseJsonField(result.rows[0]?.data, {})?.filename;
        if (!filename) return null;
        // A settings row pointing at a file that has since been deleted would
        // otherwise hand out a link that 404s.
        if (!fs.existsSync(path.join(BROCHURE_DIR, filename))) return null;
        return filename;
    } catch (error) {
        console.warn("Brochure settings unavailable:", error.message);
        return null;
    }
}

/* ------------------------------------------------------------------ */
/* Subscribe                                                           */
/* ------------------------------------------------------------------ */

router.post("/subscribe", rateLimit, async (req, res) => {
    try {
        const email = clean(req.body.email, 255).toLowerCase();
        if (!EMAIL_RE.test(email)) {
            return res.status(400).json({ success: false, message: "Enter a valid email address" });
        }

        const fullName = clean(req.body.fullName) || null;

        const lead = await saveNewsletterLead(email, fullName);

        const brochure = await currentBrochure();

        res.status(201).json({
            success: true,
            message: brochure
                ? "Thanks! Your download is starting."
                : "Thanks! We'll email your guide shortly.",
            isReturning: lead.brochure_download_count > 1,
            // Absent when no brochure has been uploaded yet — the email is
            // still captured, the UI just doesn't promise a file.
            brochureUrl: brochure ? "/api/newsletter/brochure" : null,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to sign you up right now" });
    }
});

/* ------------------------------------------------------------------ */
/* Download                                                            */
/* ------------------------------------------------------------------ */

router.get("/brochure", async (req, res) => {
    try {
        const filename = await currentBrochure();
        if (!filename) {
            return res.status(404).json({
                success: false,
                message: "No brochure has been uploaded yet",
            });
        }

        // download() sets Content-Disposition, so the browser saves the file
        // instead of navigating away from the storefront to render it.
        res.download(path.join(BROCHURE_DIR, filename), "JAAPA-Postpartum-Guide.pdf");
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to download the brochure" });
    }
});

/* ------------------------------------------------------------------ */
/* Admin: upload the brochure                                          */
/* ------------------------------------------------------------------ */

const brochureUpload = multer({
    storage: multer.diskStorage({
        destination(req, file, cb) {
            fs.mkdirSync(BROCHURE_DIR, { recursive: true });
            cb(null, BROCHURE_DIR);
        },
        filename(req, file, cb) {
            // Timestamped so replacing the brochure doesn't leave browsers
            // and CDNs serving the previous one from cache.
            cb(null, `brochure-${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
        },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter(req, file, cb) {
        if (file.mimetype !== "application/pdf") {
            return cb(new Error("The brochure must be a PDF"));
        }
        cb(null, true);
    },
});

router.post("/brochure", requireAdmin, (req, res) => {
    brochureUpload.single("brochure")(req, res, async (uploadError) => {
        if (uploadError) {
            return res.status(400).json({ success: false, message: uploadError.message });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file was uploaded" });
        }

        try {
            const previous = await currentBrochure();

            await saveSettings(BROCHURE_SETTINGS_SECTION, {
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                uploadedAt: new Date().toISOString(),
            });

            // Only after the new one is safely recorded.
            if (previous && previous !== req.file.filename) {
                fs.unlink(path.join(BROCHURE_DIR, previous), () => {});
            }

            res.json({
                success: true,
                message: "Brochure uploaded",
                url: publicUploadUrl("brochure", req.file.filename),
                filename: req.file.filename,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: "Unable to save the brochure" });
        }
    });
});

/* ------------------------------------------------------------------ */
/* Admin: the leads                                                    */
/* ------------------------------------------------------------------ */

router.get("/leads", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, email, full_name, source, subscribed_at,
                    brochure_downloaded_at, brochure_download_count,
                    orders_count, total_spent, created_at
             FROM customers
             WHERE is_brochure_lead = TRUE
             ORDER BY subscribed_at IS NULL, subscribed_at DESC
             LIMIT 1000`
        );

        // ?format=csv gives the admin something to paste into a mailing tool.
        if (req.query.format === "csv") {
            const rows = [
                ["Email", "Name", "Source", "Subscribed", "Downloads", "Orders"],
                ...result.rows.map((r) => [
                    r.email,
                    r.full_name || "",
                    r.source || "",
                    r.subscribed_at ? new Date(r.subscribed_at).toISOString() : "",
                    r.brochure_download_count,
                    r.orders_count,
                ]),
            ];
            // Quotes doubled so a name containing one can't break the column.
            const csv = rows
                .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
                .join("\n");

            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", 'attachment; filename="brochure-leads.csv"');
            return res.send(csv);
        }

        res.json({ success: true, count: result.rows.length, leads: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load brochure leads" });
    }
});

module.exports = router;
