// Separate from middleware/upload.js because branding assets live in their
// own folder and are name-stamped — reusing the original filename would let
// a replaced logo keep serving from the browser cache at the same URL.

const multer = require("multer");
const fs = require("fs");
const path = require("path");

const BRANDING_DIR = "uploads/branding";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdirSync(BRANDING_DIR, { recursive: true });
        cb(null, BRANDING_DIR);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const base = path
            .basename(file.originalname, extension)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "") || "asset";
        cb(null, `${base}-${Date.now()}${extension}`);
    },
});

const uploadBranding = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) return cb(null, true);
        cb(new Error("Only image files can be uploaded as branding assets"));
    },
});

module.exports = uploadBranding;
