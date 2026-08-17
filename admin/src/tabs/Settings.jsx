import React from "react";
import {
  Store,
  Tags,
  Image as ImageIcon,
  Percent,
  Mail,
  Globe,
  ShieldCheck,
  Receipt,
  ChevronRight,
} from "lucide-react";

import StoreDetails from "../toolkit/settings/StoreDetails";
import MetaData from "../toolkit/settings/MetaData";
import LogoFavicon from "../toolkit/settings/LogoFavicon";
import GstSettings from "../toolkit/settings/GstSettings";
import EmailNotifications from "../toolkit/settings/EmailNotifications";
import Policies from "../toolkit/settings/Policies";

// `component` is the panel rendered for that sidebar sub-link. Sections
// without one still show on the overview grid, marked as coming soon.
const SECTIONS = [
  { id: "store-details", label: "Store Details", description: "Name, address and contact information.", icon: Store, component: StoreDetails },
  { id: "meta-data", label: "Meta Data (SEO)", description: "Titles, descriptions and keywords.", icon: Tags, component: MetaData },
  { id: "logo-favicon", label: "Logo & Favicon", description: "Brand assets shown across the storefront.", icon: ImageIcon, component: LogoFavicon },
  { id: "gst-settings", label: "GST Settings", description: "Tax rates, GSTIN and state-wise overrides.", icon: Percent, component: GstSettings },
  { id: "email-notifications", label: "Email Notifications", description: "Sender address and order emails.", icon: Mail, component: EmailNotifications },
  { id: "domains", label: "Domains", description: "Connect and manage custom domains.", icon: Globe },
  { id: "policies", label: "Policies", description: "Refund, shipping and privacy policies.", icon: ShieldCheck, component: Policies },
  { id: "billing", label: "Billing", description: "Plan, invoices and payment method.", icon: Receipt },
];

/**
 * `section` corresponds to the settings sub-link id (e.g. "store-details").
 * When empty, the section overview grid is shown; `onNavigate` lets its
 * cards jump straight into a panel.
 */
export default function Settings({ section, onNavigate }) {
  const active = SECTIONS.find((s) => s.id === section);

  if (active?.component) {
    const Panel = active.component;
    return <Panel />;
  }

  if (active) {
    const Icon = active.icon;
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
            <Icon className="h-5 w-5 text-emerald-700" strokeWidth={1.9} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{active.label}</h2>
            <p className="text-sm text-gray-400">{active.description}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center">
          <p className="text-sm text-gray-500">
            {active.label} isn't set up yet — this panel is wired to the sidebar and ready for
            its fields and save handler.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          onClick={() => onNavigate?.(`settings:${s.id}`)}
          className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-5 text-left hover:border-emerald-200 hover:bg-emerald-50/30"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
              <s.icon className="h-5 w-5 text-emerald-700" strokeWidth={1.9} />
            </span>
            <span>
              <p className="text-sm font-semibold text-gray-900">{s.label}</p>
              <p className="text-xs text-gray-400">{s.description}</p>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
        </button>
      ))}
    </div>
  );
}
