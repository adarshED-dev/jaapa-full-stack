// The public URL of an uploaded file.
//
// These URLs get written into the database and outlive the request that
// created them, so they must not be built from that request's Host header.
// Both frontends reach the API through a dev proxy, which means `req.get(
// "host")` is the *frontend's* origin (localhost:5173 / :5174) — baking that
// in produces image links that 404 the moment anything else loads them.
//
// So: store a root-relative path by default. The browser resolves it against
// whatever origin it is on, which is correct in development (both Vite
// servers proxy /uploads) and in production when the API is served from the
// same domain.
//
// Set PUBLIC_UPLOADS_BASE when the API lives on its own host and images have
// to be absolute, e.g. PUBLIC_UPLOADS_BASE=https://api.jaapa.in

function publicUploadUrl(folder, filename) {
    const path = `/uploads/${folder}/${encodeURIComponent(filename)}`;
    const base = (process.env.PUBLIC_UPLOADS_BASE || "").replace(/\/+$/, "");
    return base ? `${base}${path}` : path;
}

module.exports = { publicUploadUrl };
