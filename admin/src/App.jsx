// Two routes: the login page, and everything behind it.
//
// The app is mounted under the /admin basename (see main.jsx), so:
//   /admin        -> dashboard, or the login page if there is no session
//   /admin/login  -> login page, or straight to the dashboard if there is one

import { Navigate, Route, Routes } from "react-router-dom";

import Login from "./page/Login";
import Dashboard from "./page/Dashboard";
import ProtectedRoute from "./auth/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route
          path="/"
          element={
            <main className="main-layout--admin-dashboard">
              <Dashboard />
            </main>
          }
        />
      </Route>

      {/* Anything else inside /admin lands on the dashboard, which in turn
          sends a signed-out visitor to the login page. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
