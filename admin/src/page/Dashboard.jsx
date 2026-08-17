import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

import Home from "../tabs/Home";
import Orders from "../tabs/Orders";
import Products from "../tabs/Products";
import Customers from "../tabs/Customers";
import Carts from "../tabs/Carts";
import Payments from "../tabs/Payments";
import Blogs from "../tabs/Blogs";
import Analytics from "../tabs/Analytics";
import Reports from "../tabs/Reports";
import Settings from "../tabs/Settings";
import { useAuth } from "../auth/AuthContext";

const ROLE_LABELS = { owner: "Owner", admin: "Administrator" };

/**
 * Top-level admin dashboard shell. test
 *
 * `activeTab` drives which child component renders in the content area.
 * It's either a top-level id ("home", "orders", ...) or, for the
 * expandable Settings entry, a compound id like "settings:store-details".
 */
export default function Dashboard() {
  const { admin } = useAuth();
  const [activeTab, setActiveTab] = useState("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function handleNavigate(tab) {
    setActiveTab(tab);
    setMobileNavOpen(false);
  }

  function renderContent() {
    if (activeTab.startsWith("settings")) {
      const [, section] = activeTab.split(":");
      return <Settings section={section} onNavigate={handleNavigate} />;
    }

    switch (activeTab) {
      case "home":
        return <Home />;
      case "orders":
        return <Orders />;
      case "products":
        return <Products />;
      case "customers":
        return <Customers />;
      case "carts":
        return <Carts />;
      case "payments":
        return <Payments />;
      case "blogs":
        return <Blogs />;
      case "analytics":
        return <Analytics />;
      case "reports":
        return <Reports />;
      default:
        return <Home />;
    }
  }

  return (
    // h-screen + overflow-hidden pins the whole shell to the viewport —
    // Shopify-style: sidebar and header never move, and <main> below is the
    // only thing that scrolls. This used to be min-h-screen with no overflow
    // constraint, so a tall table grew the whole page and the *body*
    // scrolled, carrying the sidebar away with it.
    <div className="flex h-screen w-full overflow-hidden bg-[#FAFAF8] font-sans text-gray-900 antialiased">
      <Sidebar
        activeTab={activeTab}
        onNavigate={handleNavigate}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          activeTab={activeTab}
          user={{
            name: admin?.fullName || admin?.email || "Owner",
            role: ROLE_LABELS[admin?.role] || "Administrator",
            initials: admin?.initials || "?",
          }}
          onOpenMobileMenu={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-y-auto px-4 pb-8 sm:px-8">{renderContent()}</main>
      </div>
    </div>
  );
}