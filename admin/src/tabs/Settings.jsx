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

const SECTIONS = [
  { id: "store-details", label: "Store Details", description: "Name, address and contact information.", icon: Store },
  { id: "meta-data", label: "Meta Data (SEO)", description: "Titles, descriptions and social previews.", icon: Tags },
  { id: "logo-favicon", label: "Logo & Favicon", description: "Brand assets shown across the storefront.", icon: ImageIcon },
  { id: "gst-settings", label: "GST Settings", description: "Tax rates and GST identification number.", icon: Percent },
  { id: "email-notifications", label: "Email Notifications", description: "Order, shipping and marketing emails.", icon: Mail },
  { id: "domains", label: "Domains", description: "Connect and manage custom domains.", icon: Globe },
  { id: "policies", label: "Policies", description: "Refund, shipping and privacy policies.", icon: ShieldCheck },
  { id: "billing", label: "Billing", description: "Plan, invoices and payment method.", icon: Receipt },
];

/**
 * `section` corresponds to the settings sub-link id (e.g. "store-details").
 * When empty, the section overview grid is shown.
 */
export default function Settings({ section }) {
  const active = SECTIONS.find((s) => s.id === section);

  if (active) {
    const Icon = active.icon;
    return (
      <div className="flex flex-col gap-5">
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
              Build the {active.label.toLowerCase()} form here \u2014 this panel is wired up and
              ready for your fields and save handler.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
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