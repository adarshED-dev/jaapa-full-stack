import React from "react";
import {
  Home,
  ShoppingBag,
  Users,
  Package,
  ShoppingCart,
  CreditCard,
  Newspaper,
  BarChart2,
  FileText,
  Settings as SettingsIcon,
  ChevronDown,
  ExternalLink,
  Store,
  Tags,
  Image as ImageIcon,
  Percent,
  Mail,
  Globe,
  ShieldCheck,
  Receipt,
  X,
} from "lucide-react";

// The storefront's own dev server (see frontend/vite.config.js). Set
// VITE_STOREFRONT_URL when the storefront is deployed somewhere other than
// localhost, so this keeps pointing at the real site instead of :5173.
const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL || "http://localhost:5173";
const STOREFRONT_HOST = STOREFRONT_URL.replace(/^https?:\/\//, "");

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: Home },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "customers", label: "Customers", icon: Users },
  { id: "products", label: "Products", icon: Package },
  { id: "carts", label: "Carts", icon: ShoppingCart },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "blogs", label: "Blogs", icon: Newspaper },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "reports", label: "Reports", icon: FileText },
];

const SETTINGS_SUBLINKS = [
  { id: "store-details", label: "Store Details", icon: Store },
  { id: "meta-data", label: "Meta Data (SEO)", icon: Tags },
  { id: "logo-favicon", label: "Logo & Favicon", icon: ImageIcon },
  { id: "gst-settings", label: "GST Settings", icon: Percent },
  { id: "email-notifications", label: "Email Notifications", icon: Mail },
  { id: "domains", label: "Domains", icon: Globe },
  { id: "policies", label: "Policies", icon: ShieldCheck },
  { id: "billing", label: "Billing", icon: Receipt },
];

/**
 * Lotus mark used in the JAAPA logo lockup.
 */
function LotusMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8 shrink-0" aria-hidden="true">
      <g fill="#D98E3E">
        <path d="M20 6c2.6 3.4 3.8 7 3.8 10.4C23.8 21 22.2 24 20 26c-2.2-2-3.8-5-3.8-9.6C16.2 13 17.4 9.4 20 6z" />
        <path d="M8.5 14c3.9 1.1 7 3.2 9.1 6C19 22.6 19.4 26 18.4 29c-2.9-.6-5.9-2.3-8-5.1-2.1-2.8-3-6.2-1.9-9.9z" />
        <path d="M31.5 14c1.1 3.7.2 7.1-1.9 9.9-2.1 2.8-5.1 4.5-8 5.1-1-3 -.6-6.4 .8-8.6 2.1-3.1 5.2-5.3 9.1-6.4z" />
      </g>
      <path
        d="M9 26c3.7 4.4 6.9 6.5 11 6.5S27.3 30.4 31 26c-1 6.6-6 11.3-11 11.3S10 32.6 9 26z"
        fill="#3C7A57"
      />
    </svg>
  );
}

function NavButton({ item, isActive, onClick }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-emerald-50 text-emerald-900"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 ${
          isActive ? "text-emerald-800" : "text-gray-400"
        }`}
        strokeWidth={1.9}
      />
      {item.label}
    </button>
  );
}

export default function Sidebar({
  activeTab,
  onNavigate,
  settingsOpen,
  onToggleSettings,
  mobileOpen,
  onCloseMobile,
}) {
  const isSettingsActive = activeTab === "settings" || activeTab.startsWith("settings:");

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[272px] shrink-0 transform flex-col border-r border-gray-100 bg-white transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <LotusMark />
            <div className="leading-tight">
              <p className="font-serif text-[19px] font-semibold tracking-tight text-emerald-950">
                JAAPA
              </p>
              <p className="-mt-0.5 text-[10.5px] font-medium tracking-wide text-gray-400">
                Rooted in Ayurveda
              </p>
            </div>
          </div>
          <button
            className="rounded-md p-1 text-gray-400 hover:bg-gray-50 lg:hidden"
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable nav area */}
        <div className="flex-1 overflow-y-auto px-4">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                isActive={activeTab === item.id}
                onClick={() => onNavigate(item.id)}
              />
            ))}

            {/* Settings (expandable) */}
            <button
              onClick={onToggleSettings}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isSettingsActive
                  ? "bg-emerald-50 text-emerald-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="flex items-center gap-3">
                <SettingsIcon
                  className={`h-[18px] w-[18px] ${
                    isSettingsActive ? "text-emerald-800" : "text-gray-400"
                  }`}
                  strokeWidth={1.9}
                />
                Settings
              </span>
              <ChevronDown
                className={`h-4 w-4 text-gray-400 transition-transform ${
                  settingsOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </nav>

          {/* Store switcher + settings sublinks */}
          {settingsOpen && (
            <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
              <a
                href={STOREFRONT_URL}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${STOREFRONT_URL}`}
                className="mb-2 flex items-center gap-2.5 rounded-lg bg-white px-2.5 py-2 shadow-sm ring-1 ring-gray-100 transition-colors hover:bg-gray-50"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-xs font-semibold text-emerald-800">
                  J
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-800">
                    JAAPA Store
                  </span>
                  <span className="block truncate text-xs text-gray-400">{STOREFRONT_HOST}</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              </a>

              <div className="flex flex-col gap-0.5">
                {SETTINGS_SUBLINKS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === `settings:${item.id}`;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(`settings:${item.id}`)}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                        isActive
                          ? "bg-emerald-50 text-emerald-900"
                          : "text-gray-500 hover:bg-white hover:text-gray-800"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.9} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pb-5 pt-2 text-center text-[11px] text-gray-300">
          JAAPA Admin · v1.0
        </div>
      </aside>
    </>
  );
}