import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Typing "localhost:5174/admin" (no trailing slash) is a 404 in Vite's dev
// server — it only serves the app from "/admin/". Nobody types the slash, so
// redirect for them. Behind nginx in production, do the same with:
//   location = /admin { return 301 /admin/; }
function adminSlashRedirect() {
  return {
    name: 'admin-slash-redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/admin') {
          res.writeHead(301, { Location: '/admin/' })
          return res.end()
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), adminSlashRedirect()],

  // The panel lives at /admin, not at the root — so the owner types
  // http://localhost:5174/admin and lands on the login page. Must match the
  // BrowserRouter basename in src/main.jsx.
  base: '/admin/',

  server: {
    // Pinned because the backend's CORS allow-list names this exact origin
    // (see backend/src/server.js). strictPort stops Vite silently moving to
    // 5175 when the port is busy, which would fail every API call instead.
    port: 5174,
    strictPort: true,

    // The refresh cookie is SameSite=Lax, and browsers count localhost:5174
    // and 127.0.0.1:5000 as *different sites* — so a direct call to the API
    // would silently drop the cookie and no session would ever survive a
    // reload. Proxying /api through the dev server makes those calls
    // same-origin, which also means no CORS preflights in development.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: false,
      },
      // Product and branding images are stored as root-relative paths, so
      // the browser asks this dev server for them — proxy them to Express,
      // which is what actually has the files on disk.
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: false,
      },
    },
  },
})
