import React, { useState } from "react";
import { ShieldCheck, FileText, Check } from "lucide-react";
import { Card, FieldBlock, RichTextEditor, SettingsPanel } from "./FormControls";
import { useSettingsSection } from "./settingsApi";

// Each key holds the policy's HTML, exactly what the storefront renders.
const POLICIES = [
  {
    id: "privacy",
    label: "Privacy Policy",
    description: "What customer data you collect, why, and how long you keep it.",
    placeholder: "Explain what data you collect, how it's used, and how customers can request deletion...",
  },
  {
    id: "terms",
    label: "Terms of Service",
    description: "The agreement between your store and its customers.",
    placeholder: "Describe the terms customers agree to when they buy from you...",
  },
  {
    id: "refund",
    label: "Refund & Cancellation",
    description: "When an order can be cancelled and how refunds are processed.",
    placeholder: "Explain your cancellation window, refund method and timelines...",
  },
  {
    id: "returns",
    label: "Return & Exchange",
    description: "Return window, condition requirements and who pays for shipping.",
    placeholder: "Explain how many days customers have to return an item and in what condition...",
  },
  {
    id: "shipping",
    label: "Shipping Policy",
    description: "Dispatch times, delivery estimates and shipping charges.",
    placeholder: "Explain your dispatch time, courier partners, delivery estimates and charges...",
  },
];

const DEFAULTS = Object.fromEntries(POLICIES.map((policy) => [policy.id, ""]));

// TipTap leaves an empty paragraph behind when everything is deleted, so an
// "is this filled in?" check has to look at the text, not the HTML.
function hasContent(html) {
  return (html || "").replace(/<[^>]*>/g, "").trim().length > 0;
}

function wordCount(html) {
  const text = (html || "").replace(/<[^>]*>/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
}

export default function Policies() {
  const state = useSettingsSection("policies", DEFAULTS);
  const { form, update } = state;
  const [activeId, setActiveId] = useState(POLICIES[0].id);

  const active = POLICIES.find((policy) => policy.id === activeId);

  return (
    <SettingsPanel
      icon={ShieldCheck}
      title="Policies"
      description="Store policies published on the storefront and linked from checkout."
      state={state}
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        {/* Document list */}
        <div className="xl:col-span-1">
          <Card title="Documents">
            <div className="flex flex-col gap-1">
              {POLICIES.map((policy) => {
                const isActive = policy.id === activeId;
                const filled = hasContent(form[policy.id]);
                return (
                  <button
                    key={policy.id}
                    type="button"
                    onClick={() => setActiveId(policy.id)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-emerald-50 text-emerald-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <FileText
                      className={`h-4 w-4 shrink-0 ${isActive ? "text-emerald-700" : "text-gray-400"}`}
                      strokeWidth={1.9}
                    />
                    <span className="flex-1 truncate">{policy.label}</span>
                    {filled ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                        Empty
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Editor for the selected document */}
        <div className="xl:col-span-3">
          <Card title={active.label} description={active.description}>
            <FieldBlock
              hint={`${wordCount(form[active.id])} words · formatting, links and lists are published as-is.`}
            >
              {/* Remounting per document keeps each policy's history and
                  placeholder separate instead of bleeding across tabs. */}
              <RichTextEditor
                key={active.id}
                value={form[active.id]}
                onChange={(html) => update(active.id, html)}
                placeholder={active.placeholder}
              />
            </FieldBlock>
          </Card>
        </div>
      </div>
    </SettingsPanel>
  );
}
