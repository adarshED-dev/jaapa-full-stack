const multer = require("multer");
const path = require("path");
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/products");
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);   // For testing only
    }
});
const upload = multer({ storage });
module.exports = upload;