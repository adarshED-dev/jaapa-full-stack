import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import './admin.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'

// basename "/admin" is what makes http://<host>/admin the front door. It has
// to match `base` in vite.config.js.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename="/admin">
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
