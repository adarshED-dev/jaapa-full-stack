import React, { useState, useRef, useEffect } from "react";
import { Bell, ChevronDown, Menu, LogOut, User } from "lucide-react";

const PAGE_COPY = {
  home: {
    title: "Dashboard",
    subtitle: "Here's what's happening with your store today.",
  },
  orders: { title: "Orders", subtitle: "Track and manage every order in one place." },
  customers: { title: "Customers", subtitle: "See who's shopping with you." },
  products: { title: "Products", subtitle: "Manage your catalog and stock levels." },
  carts: { title: "Carts", subtitle: "Recover abandoned and active carts." },
  payments: { title: "Payments", subtitle: "Review transactions and payouts." },
  analytics: { title: "Analytics", subtitle: "Understand how your store is performing." },
  reports: { title: "Reports", subtitle: "Generate and download store reports." },
  settings: { title: "Settings", subtitle: "Configure your store preferences." },
};

function getCopy(activeTab) {
  if (activeTab.startsWith("settings")) return PAGE_COPY.settings;
  return PAGE_COPY[activeTab] || PAGE_COPY.home;
}

export default function Header({ activeTab, onOpenMobileMenu, user }) {
  const { title, subtitle } = getCopy(activeTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8 sm:py-7">
      <div className="flex items-center gap-3">
        <button
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
          onClick={onOpenMobileMenu}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 sm:text-[26px]">{title}</h1>
          <p className="mt-0.5 hidden text-sm text-gray-500 sm:block">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        <button
          className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" strokeWidth={1.8} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-1 hover:bg-gray-50 sm:pr-2"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
              {user.initials}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-400">{user.role}</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-gray-400 sm:block" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-30 mt-2 w-48 rounded-lg border border-gray-100 bg-white py-1.5 shadow-lg">
              <button className="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-gray-600 hover:bg-gray-50">
                <User className="h-4 w-4 text-gray-400" />
                My profile
              </button>
              <button className="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-gray-600 hover:bg-gray-50">
                <LogOut className="h-4 w-4 text-gray-400" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}