import React from "react";
import { Tags } from "lucide-react";
import {
  Card,
  Field,
  FieldBlock,
  TextInput,
  TextArea,
  TagsInput,
  CharCount,
  SettingsPanel,
} from "./FormControls";
import { useSettingsSection } from "./settingsApi";

const DEFAULTS = {
  metaTitle: "",
  metaDescription: "",
  metaKeywords: [],
  canonicalUrl: "",
  ogImage: "",
  twitterHandle: "",
};

// Google truncates around these lengths — we warn but never block the save,
// since a longer title is a judgement call, not an error.
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

function validate(form) {
  return {
    metaTitle: form.metaTitle.trim() ? "" : "Meta title is required.",
    metaDescription: form.metaDescription.trim() ? "" : "Meta description is required.",
    canonicalUrl:
      !form.canonicalUrl.trim() || /^https?:\/\/\S+\.\S+/.test(form.canonicalUrl.trim())
        ? ""
        : "Enter a full URL starting with https://",
    ogImage:
      !form.ogImage.trim() || /^https?:\/\/\S+/.test(form.ogImage.trim())
        ? ""
        : "Enter a full image URL starting with https://",
  };
}

// Rough approximation of a Google result so the copy can be judged in place.
function SearchPreview({ title, description, url }) {
  const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <p className="mb-2 text-xs font-medium text-gray-400">Search result preview</p>
      <div className="rounded-lg bg-white p-4">
        <p className="truncate text-xs text-gray-500">
          {url || "https://jaapa.in"}
        </p>
        <p className="mt-0.5 text-[17px] leading-snug text-[#1a0dab]">
          {truncate(title || "Your store title appears here", TITLE_LIMIT + 10)}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-gray-600">
          {truncate(
            description ||
              "Your meta description appears here — write one or two sentences that make someone want to click.",
            DESCRIPTION_LIMIT + 20
          )}
        </p>
      </div>
    </div>
  );
}

export default function MetaData() {
  const state = useSettingsSection("meta-data", DEFAULTS, validate);
  const { form, update, errors } = state;

  return (
    <SettingsPanel
      icon={Tags}
      title="Meta Data (SEO)"
      description="Titles, descriptions and keywords used by search engines and link previews."
      state={state}
    >
      <Card title="Search engine listing" description="Defaults for the storefront — individual products can override these.">
        <div className="flex flex-col gap-5">
          <Field label="Meta title" required error={errors.metaTitle}>
            <TextInput
              placeholder="JAAPA — Rooted in Ayurveda"
              value={form.metaTitle}
              error={errors.metaTitle}
              onChange={(e) => update("metaTitle", e.target.value)}
            />
            <CharCount value={form.metaTitle} max={TITLE_LIMIT} />
          </Field>

          <Field label="Meta description" required error={errors.metaDescription}>
            <TextArea
              rows={3}
              placeholder="Authentic Ayurvedic wellness products, made in small batches with ingredients you can pronounce."
              value={form.metaDescription}
              error={errors.metaDescription}
              onChange={(e) => update("metaDescription", e.target.value)}
            />
            <CharCount value={form.metaDescription} max={DESCRIPTION_LIMIT} />
          </Field>

          <FieldBlock
            label="Meta keywords"
            hint="Type a keyword and press Enter. Most search engines ignore these, but some marketplaces still read them."
          >
            <TagsInput
              tags={form.metaKeywords}
              onChange={(tags) => update("metaKeywords", tags)}
              placeholder="ayurveda, herbal skincare, wellness"
            />
          </FieldBlock>

          <SearchPreview
            title={form.metaTitle}
            description={form.metaDescription}
            url={form.canonicalUrl}
          />
        </div>
      </Card>

      <Card title="Advanced" description="Optional — leave blank unless you know you need them.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Canonical URL"
            error={errors.canonicalUrl}
            hint="The primary address of your storefront."
          >
            <TextInput
              placeholder="https://jaapa.in"
              value={form.canonicalUrl}
              error={errors.canonicalUrl}
              onChange={(e) => update("canonicalUrl", e.target.value)}
            />
          </Field>
          <Field
            label="Social share image URL"
            error={errors.ogImage}
            hint="1200 × 630 px works best for WhatsApp and X previews."
          >
            <TextInput
              placeholder="https://jaapa.in/og-image.jpg"
              value={form.ogImage}
              error={errors.ogImage}
              onChange={(e) => update("ogImage", e.target.value)}
            />
          </Field>
          <Field label="X (Twitter) handle">
            <TextInput
              placeholder="@jaapa"
              value={form.twitterHandle}
              onChange={(e) => update("twitterHandle", e.target.value)}
            />
          </Field>
        </div>
      </Card>
    </SettingsPanel>
  );
}
