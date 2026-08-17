// Shared form primitives for the Settings panels. Same visual language as
// the Add Product form (rounded-2xl cards, emerald focus ring), kept in one
// place so every settings section looks and behaves identically.

import React, { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  ChevronDown,
  X,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";

export const inputClasses =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100";

const errorInputClasses =
  "w-full rounded-lg border border-red-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100";

export function Card({ title, description, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 ${className}`}>
      {title && (
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-gray-400">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Field({ label, hint, error, required, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : (
        hint && <span className="text-xs text-gray-400">{hint}</span>
      )}
    </label>
  );
}

// For composite fields (rich text editor, tag input, uploaders) where a real
// <label> wrapper would cause weird implicit-focus behavior.
export function FieldBlock({ label, hint, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
      {children}
      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : (
        hint && <span className="text-xs text-gray-400">{hint}</span>
      )}
    </div>
  );
}

export function TextInput({ error, ...props }) {
  return <input {...props} className={error ? errorInputClasses : inputClasses} />;
}

export function TextArea({ error, rows = 4, ...props }) {
  return (
    <textarea
      rows={rows}
      {...props}
      className={`${error ? errorInputClasses : inputClasses} resize-y leading-relaxed`}
    />
  );
}

export function SelectField({ placeholder, value, onChange, options = [], error, disabled }) {
  // `options` accepts plain strings or { value, label } objects.
  const normalized = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`${error ? errorInputClasses : inputClasses} appearance-none pr-9 disabled:bg-gray-50 disabled:text-gray-400 ${
          value === "" ? "text-gray-400" : "text-gray-700"
        }`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {normalized.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

export function Switch({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer select-none items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-emerald-800" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-medium text-gray-800">{label}</span>}
          {description && <span className="block text-xs text-gray-400">{description}</span>}
        </span>
      )}
    </label>
  );
}

// Type + Enter/comma to add a chip, click x (or Backspace on an empty input)
// to remove. Feeds a plain string array.
export function TagsInput({ tags, onChange, placeholder = "Type and press Enter" }) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const value = draft.trim().replace(/,$/, "");
    if (value && !tags.includes(value)) onChange([...tags, value]);
    setDraft("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-100">
      {tags.map((tag, i) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((_, index) => index !== i))}
            className="rounded-full p-0.5 hover:bg-emerald-100"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="min-w-[140px] flex-1 border-none bg-transparent py-0.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0"
      />
    </div>
  );
}

// Live "n / max characters" counter used by the SEO fields, which turns
// amber past the recommended length instead of hard-blocking the save.
export function CharCount({ value, max }) {
  const length = (value || "").length;
  const over = length > max;
  return (
    <span className={`text-xs ${over ? "text-amber-600" : "text-gray-400"}`}>
      {length} / {max} characters{over ? " — may be truncated in search results" : ""}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Rich text editor (TipTap) — used by the Policies panel              */
/* ------------------------------------------------------------------ */

const editorContentClasses =
  "min-h-[260px] px-3.5 py-3 text-sm text-gray-700 focus:outline-none " +
  "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[240px] " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_a]:text-emerald-700 [&_a]:underline " +
  "[&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold " +
  "[&_p]:my-1.5 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-200 [&_blockquote]:pl-3 [&_blockquote]:text-gray-500 " +
  "[&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] " +
  "[&_p.is-editor-empty:first-child]:before:float-left " +
  "[&_p.is-editor-empty:first-child]:before:h-0 " +
  "[&_p.is-editor-empty:first-child]:before:text-gray-400 " +
  "[&_p.is-editor-empty:first-child]:before:pointer-events-none";

export function RichTextEditor({ value, onChange, placeholder = "Start writing..." }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-emerald-700 underline" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: editorContentClasses } },
  });

  // Keep the editor in sync when `value` is replaced from outside (switching
  // between policy documents, or settings finishing their initial load)
  // without fighting the cursor while the user is actively typing.
  useEffect(() => {
    if (!editor) return;
    if (!editor.isFocused && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  if (!editor) return null;

  function setLink() {
    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt("Link URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function currentBlockType() {
    if (editor.isActive("heading", { level: 1 })) return "h1";
    if (editor.isActive("heading", { level: 2 })) return "h2";
    if (editor.isActive("heading", { level: 3 })) return "h3";
    return "p";
  }

  function setBlockType(v) {
    if (v === "p") editor.chain().focus().setParagraph().run();
    else editor.chain().focus().toggleHeading({ level: Number(v.slice(1)) }).run();
  }

  const btn = (active) =>
    `rounded-md p-1.5 hover:bg-gray-100 ${active ? "bg-emerald-50 text-emerald-700" : "text-gray-500"}`;
  const noBlur = (e) => e.preventDefault();

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50/60 px-2 py-1.5">
        <select
          value={currentBlockType()}
          onChange={(e) => setBlockType(e.target.value)}
          className="rounded-md bg-transparent px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))} title="Bold">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))} title="Italic">
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive("underline"))} title="Underline">
          <Underline className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))} title="Bullet list">
          <List className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))} title="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().setTextAlign("left").run()} className={btn(editor.isActive({ textAlign: "left" }))} title="Align left">
          <AlignLeft className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().setTextAlign("center").run()} className={btn(editor.isActive({ textAlign: "center" }))} title="Align center">
          <AlignCenter className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().setTextAlign("right").run()} className={btn(editor.isActive({ textAlign: "right" }))} title="Align right">
          <AlignRight className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <button type="button" onMouseDown={noBlur} onClick={setLink} className={btn(editor.isActive("link"))} title="Insert link">
          <LinkIcon className="h-4 w-4" />
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel chrome — header, load/save states, sticky action bar          */
/* ------------------------------------------------------------------ */

export function Banner({ tone = "error", children }) {
  const tones = {
    error: "border-red-100 bg-red-50 text-red-700",
    success: "border-emerald-100 bg-emerald-50 text-emerald-800",
    info: "border-amber-100 bg-amber-50 text-amber-800",
  };
  const Icon = tone === "success" ? Check : AlertCircle;
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/**
 * Wraps every settings section: icon + title header, the load/save state
 * from `useSettingsSection`, and a sticky Save / Discard bar that only
 * lights up when there are unsaved changes.
 */
export function SettingsPanel({ icon: Icon, title, description, state, children }) {
  const { loading, loadError, saving, saveError, justSaved, dirty, save, discard } = state;

  return (
    <div className="flex flex-col gap-5 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
            <Icon className="h-5 w-5 text-emerald-700" strokeWidth={1.9} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-400">{description}</p>
          </div>
        </div>
        {justSaved && !dirty && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <Check className="h-3.5 w-3.5" />
            All changes saved
          </span>
        )}
      </div>

      {loadError && <Banner tone="error">{loadError}</Banner>}
      {saveError && <Banner tone="error">{saveError}</Banner>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white py-16 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading settings...
        </div>
      ) : (
        children
      )}

      {!loading && (
        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2.5 border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
          <span className="mr-auto text-xs text-gray-400">
            {dirty ? "You have unsaved changes" : "Everything is up to date"}
          </span>
          <button
            type="button"
            onClick={discard}
            disabled={!dirty || saving}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-900 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
