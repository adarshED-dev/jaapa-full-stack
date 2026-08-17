import React, { useEffect, useState } from "react";
import api from "../lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  ImagePlus,
  Trash2,
  Eye,
} from "lucide-react";

// Reused from the Settings panels rather than duplicated — same inputs, same
// focus rings, same rich text toolbar as the rest of the admin.
import {
  Card,
  Field,
  FieldBlock,
  TextInput,
  TextArea,
  SelectField,
  Switch,
  TagsInput,
  CharCount,
  RichTextEditor,
  Banner,
} from "./settings/FormControls";
import {
  BLOG_CATEGORIES,
  BLOG_STATUSES,
  emptyBlog,
  estimateReadingMinutes,
  saveBlog,
  slugify,
} from "./blogApi";

const STATUS_OPTIONS = BLOG_STATUSES.map((status) => ({
  value: status,
  label: status.charAt(0).toUpperCase() + status.slice(1),
}));

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

/**
 * Cover images post to the existing product media endpoint, which is a real,
 * working upload today. Point this at a blog-specific route when you add one.
 */
async function uploadCoverImage(file) {
  const formData = new FormData();
  formData.append("images", file);

  const response = await api.post(
    "/product/upload-images",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );

  return (response.data.urls || [])[0] || "";
}

function validate(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = "A title is required.";
  if (!form.slug.trim()) errors.slug = "A slug is required — it's the post's URL.";
  if (!form.excerpt.trim()) errors.excerpt = "Write a short excerpt for listing pages.";
  if (!String(form.content).replace(/<[^>]*>/g, "").trim()) {
    errors.content = "The post has no content yet.";
  }
  if (!form.author.trim()) errors.author = "Who wrote this?";
  if (form.status === "scheduled" && !form.publishedAt) {
    errors.publishedAt = "A scheduled post needs a date.";
  }
  return errors;
}

/**
 * `post` is optional. Pass nothing to write a new post; pass an existing one
 * to edit it — the form pre-fills and Save updates instead of creating.
 */
export default function AddBlog({ post, onCancel, onSave }) {
  const isEditMode = Boolean(post?.id);

  const [form, setForm] = useState(() => ({ ...emptyBlog(), ...(post || {}) }));
  const [slugEdited, setSlugEdited] = useState(isEditMode);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function updateTitle(value) {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: slugEdited ? prev.slug : slugify(value),
    }));
    setErrors((prev) => ({ ...prev, title: undefined, slug: undefined }));
  }

  // Keep the reading estimate honest as the post grows, unless it's been
  // overridden by hand.
  const [readingEdited, setReadingEdited] = useState(Boolean(post?.readingMinutes));
  useEffect(() => {
    if (readingEdited) return;
    setForm((prev) => ({ ...prev, readingMinutes: String(estimateReadingMinutes(prev.content)) }));
  }, [form.content, readingEdited]);

  async function handleCoverSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setSubmitError(null);
    try {
      const url = await uploadCoverImage(file);
      update("coverImage", url);
    } catch (error) {
      console.error(error);
      setSubmitError(
        error.response
          ? `Cover upload failed — server responded with ${error.response.status}.`
          : "Cover upload failed — couldn't reach the server."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(statusOverride) {
    const candidate = statusOverride ? { ...form, status: statusOverride } : form;
    const found = validate(candidate);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSubmitError("Please fix the highlighted fields before saving.");
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      // A post going live without a date gets today's.
      const payload = {
        ...candidate,
        publishedAt:
          candidate.status === "published" && !candidate.publishedAt
            ? new Date().toISOString().slice(0, 10)
            : candidate.publishedAt,
      };
      const saved = await saveBlog(payload);
      onSave?.(saved);
    } catch (error) {
      console.error(error);
      setSubmitError(error.message || "Couldn't save this post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-gray-600 sm:text-xl"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
          {isEditMode ? "Edit Post" : "New Post"}
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Eye className="h-4 w-4 text-gray-400" />
            {showPreview ? "Hide preview" : "Preview"}
          </button>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          {form.status !== "published" && (
            <button
              onClick={() => handleSave("draft")}
              disabled={submitting}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Save draft
            </button>
          )}
          <button
            onClick={() => handleSave()}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Saving..." : isEditMode ? "Update Post" : "Save Post"}
          </button>
        </div>
      </div>

      {submitError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Left column */}
        <div className="flex flex-col gap-5 xl:col-span-2">
          <Card title="Post">
            <div className="flex flex-col gap-5">
              <Field label="Title" required error={errors.title}>
                <TextInput
                  placeholder="Why Ayurveda Starts With Digestion"
                  value={form.title}
                  error={errors.title}
                  onChange={(e) => updateTitle(e.target.value)}
                />
              </Field>

              <Field
                label="Slug"
                required
                error={errors.slug}
                hint="The post's URL — auto-filled from the title, editable."
              >
                <TextInput
                  placeholder="why-ayurveda-starts-with-digestion"
                  value={form.slug}
                  error={errors.slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    update("slug", slugify(e.target.value));
                  }}
                />
              </Field>

              <Field
                label="Excerpt"
                required
                error={errors.excerpt}
                hint="Shown on the blog index and in link previews."
              >
                <TextArea
                  rows={2}
                  placeholder="One or two sentences that make someone want to read on."
                  value={form.excerpt}
                  error={errors.excerpt}
                  onChange={(e) => update("excerpt", e.target.value)}
                />
              </Field>

              <FieldBlock label="Content" error={errors.content}>
                <RichTextEditor
                  value={form.content}
                  onChange={(html) => update("content", html)}
                  placeholder="Write the post..."
                />
              </FieldBlock>
            </div>
          </Card>

          <Card title="Cover image" description="Shown at the top of the post and on the blog index.">
            {form.coverImage ? (
              <div className="flex flex-col gap-3">
                <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                  <img src={form.coverImage} alt={form.coverAlt || form.title} className="h-56 w-full object-cover" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverSelected} />
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : <ImagePlus className="h-4 w-4 text-gray-400" />}
                    Replace
                  </label>
                  <button
                    type="button"
                    onClick={() => update("coverImage", "")}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-gray-50/40 px-6 py-10 text-center hover:bg-gray-50">
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverSelected} />
                {uploading ? (
                  <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
                ) : (
                  <ImagePlus className="h-7 w-7 text-gray-400" strokeWidth={1.6} />
                )}
                <p className="mt-1.5 text-sm font-semibold text-gray-800">
                  {uploading ? "Uploading..." : "Upload a cover image"}
                </p>
                <p className="text-xs text-gray-400">
                  Landscape works best — around 1600 × 900 px.
                </p>
              </label>
            )}

            <div className="mt-4">
              <Field label="Cover alt text" hint="Describes the image for screen readers and search engines.">
                <TextInput
                  placeholder="A brass bowl of whole spices on a linen cloth"
                  value={form.coverAlt}
                  onChange={(e) => update("coverAlt", e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card title="Search engine listing" description="Leave blank to fall back to the title and excerpt.">
            <div className="flex flex-col gap-5">
              <Field label="Meta title">
                <TextInput
                  placeholder={form.title || "Post title"}
                  value={form.metaTitle}
                  onChange={(e) => update("metaTitle", e.target.value)}
                />
                <CharCount value={form.metaTitle || form.title} max={TITLE_LIMIT} />
              </Field>
              <Field label="Meta description">
                <TextArea
                  rows={2}
                  placeholder={form.excerpt || "Post excerpt"}
                  value={form.metaDescription}
                  onChange={(e) => update("metaDescription", e.target.value)}
                />
                <CharCount value={form.metaDescription || form.excerpt} max={DESCRIPTION_LIMIT} />
              </Field>
            </div>
          </Card>

          {showPreview && (
            <Card title="Preview" description="Roughly how the post will read once published.">
              <article className="prose-sm max-w-none">
                <h1 className="text-2xl font-semibold text-gray-900">{form.title || "Untitled post"}</h1>
                <p className="mt-1 text-xs text-gray-400">
                  {form.author || "Unattributed"}
                  {form.category ? ` · ${form.category}` : ""}
                  {form.readingMinutes ? ` · ${form.readingMinutes} min read` : ""}
                </p>
                {form.excerpt && <p className="mt-3 text-sm italic text-gray-500">{form.excerpt}</p>}
                <div
                  className="mt-4 text-sm leading-relaxed text-gray-700 [&_a]:text-emerald-700 [&_a]:underline [&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: form.content || "<p>Nothing written yet.</p>" }}
                />
              </article>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          <Card title="Visibility">
            <div className="flex flex-col gap-4">
              <Field label="Status">
                <SelectField
                  value={form.status}
                  onChange={(e) => update("status", e.target.value)}
                  options={STATUS_OPTIONS}
                />
              </Field>

              <Field
                label={form.status === "scheduled" ? "Publish on" : "Publish date"}
                error={errors.publishedAt}
                hint={form.status === "draft" ? "Set automatically when you publish." : undefined}
              >
                <TextInput
                  type="date"
                  value={form.publishedAt || ""}
                  error={errors.publishedAt}
                  onChange={(e) => update("publishedAt", e.target.value)}
                />
              </Field>

              <div className="border-t border-gray-50 pt-4">
                <Switch
                  checked={form.featured}
                  onChange={(v) => update("featured", v)}
                  label="Feature this post"
                  description="Pinned to the top of the blog index."
                />
              </div>
            </div>
          </Card>

          <Card title="Attribution">
            <div className="flex flex-col gap-4">
              <Field label="Author" required error={errors.author}>
                <TextInput
                  placeholder="Dr. Meera Iyer"
                  value={form.author}
                  error={errors.author}
                  onChange={(e) => update("author", e.target.value)}
                />
              </Field>
              <Field label="Category">
                <SelectField
                  placeholder="Select a category"
                  value={form.category}
                  onChange={(e) => update("category", e.target.value)}
                  options={BLOG_CATEGORIES}
                />
              </Field>
              <Field label="Reading time (minutes)" hint="Estimated from the content until you change it.">
                <TextInput
                  inputMode="numeric"
                  value={form.readingMinutes}
                  onChange={(e) => {
                    setReadingEdited(true);
                    update("readingMinutes", e.target.value.replace(/\D/g, ""));
                  }}
                />
              </Field>
            </div>
          </Card>

          <Card title="Tags">
            <TagsInput
              tags={form.tags}
              onChange={(tags) => update("tags", tags)}
              placeholder="digestion, agni, basics"
            />
          </Card>

          {form.status === "published" && (
            <Banner tone="success">
              This post is live once saved, at <span className="font-mono">/blogs/{form.slug || "…"}</span>.
            </Banner>
          )}
        </div>
      </div>
    </div>
  );
}
