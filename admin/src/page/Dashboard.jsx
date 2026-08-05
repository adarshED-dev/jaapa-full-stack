import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

import Home from "../tabs/Home";
import Orders from "../tabs/Orders";
import Products from "../tabs/Products";
import Customers from "../tabs/Customers";
import Carts from "../tabs/Carts";
import Payments from "../tabs/Payments";
import Analytics from "../tabs/Analytics";
import Reports from "../tabs/Reports";
import Settings from "../tabs/Settings";

const CURRENT_USER = {
  name: "Adarsh Nigam",
  role: "Administrator",
  initials: "A",
};

/**
 * Top-level admin dashboard shell.
 *
 * `activeTab` drives which child component renders in the content area.
 * It's either a top-level id ("home", "orders", ...) or, for the
 * expandable Settings entry, a compound id like "settings:store-details".
 */
export default function Dashboard() {
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
      return <Settings section={section} />;
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
      case "analytics":
        return <Analytics />;
      case "reports":
        return <Reports />;
      default:
        return <Home />;
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-[#FAFAF8] font-sans text-gray-900 antialiased">
      <Sidebar
        activeTab={activeTab}
        onNavigate={handleNavigate}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          activeTab={activeTab}
          user={CURRENT_USER}
          onOpenMobileMenu={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 px-4 pb-8 sm:px-8">{renderContent()}</main>
      </div>
    </div>
  );
}