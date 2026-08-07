// SEND Product TO THIS LINK - "http://127.0.0.1:5000/api//product/add/new-product"


import React, { useEffect, useState } from "react";
import axios from 'axios'
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  ArrowLeft,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  MoreHorizontal,
  ImagePlus,
  Plus,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
// import { createProduct } from "../lib/products-api";
// import { ApiError } from "../lib/api";

/* ------------------------------------------------------------------ */
/* Small reusable form pieces                                          */
/* ------------------------------------------------------------------ */

function Card({ title, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 ${className}`}>
      <h2 className="mb-4 text-[15px] font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

// For composite fields (rich text editor, tag input) where a real
// <label> wrapper would cause weird implicit-focus behavior.
function FieldBlock({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
  );
}

const inputClasses =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100";

function TextInput(props) {
  return <input {...props} className={inputClasses} />;
}

// Strips everything except digits and a single decimal point, and caps
// input at 2 decimal places \u2014 used for Price / Compare at Price so the
// field can never hold letters, multiple dots, or a minus sign.
function sanitizeDecimalInput(raw) {
  let value = raw.replace(/[^0-9.]/g, "");
  const firstDot = value.indexOf(".");
  if (firstDot !== -1) {
    value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, "");
  }
  const parts = value.split(".");
  if (parts.length > 1) {
    value = `${parts[0]}.${parts[1].slice(0, 2)}`;
  }
  return value;
}

function PriceInput({ value, onChange, ...props }) {
  return (
    <TextInput
      {...props}
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(sanitizeDecimalInput(e.target.value))}
    />
  );
}

function SelectField({ placeholder, value, onChange, options = [] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className={`${inputClasses} appearance-none pr-9 ${value === "" ? "text-gray-400" : "text-gray-700"}`}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-emerald-800" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}

function RadioOption({ name, value, checked, onChange, title, description }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2 first:pt-0">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 accent-emerald-800"
      />
      <span>
        <span className="block text-sm font-medium text-gray-800">{title}</span>
        <span className="block text-xs text-gray-400">{description}</span>
      </span>
    </label>
  );
}

// Tags input: type + Enter/comma to add a chip, click x to remove.
// Feeds `form.tags` (a plain string array), which buildPayload already
// reads as `tags: form.tags || null` \u2014 unchanged.
function TagsInput({ tags, onChange }) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const value = draft.trim();
    if (value && !tags.includes(value)) {
      onChange([...tags, value]);
    }
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

  function removeTag(index) {
    onChange(tags.filter((_, i) => i !== index));
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
            onClick={() => removeTag(i)}
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
        placeholder={tags.length === 0 ? "Add tags and press Enter" : ""}
        className="min-w-[110px] flex-1 border-none bg-transparent py-0.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rich text description editor (TipTap)                               */
/* ------------------------------------------------------------------ */

const RICH_TEXT_EXTENSIONS = [
  StarterKit,
  UnderlineExtension,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  LinkExtension.configure({
    openOnClick: false,
    HTMLAttributes: { class: "text-emerald-700 underline" },
  }),
  ImageExtension.configure({ HTMLAttributes: { class: "my-2 max-w-full rounded-lg" } }),
  Placeholder.configure({ placeholder: "Write product description..." }),
];

const editorContentClasses =
  "min-h-[110px] px-3.5 py-3 text-sm text-gray-700 focus:outline-none " +
  "[&_.ProseMirror]:outline-none " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_a]:text-emerald-700 [&_a]:underline " +
  "[&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold " +
  "[&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] " +
  "[&_p.is-editor-empty:first-child]:before:float-left " +
  "[&_p.is-editor-empty:first-child]:before:h-0 " +
  "[&_p.is-editor-empty:first-child]:before:text-gray-400 " +
  "[&_p.is-editor-empty:first-child]:before:pointer-events-none";

function RichTextEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: RICH_TEXT_EXTENSIONS,
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: editorContentClasses },
    },
  });

  // Keep the editor in sync if `value` is reset from outside (e.g. form
  // reset) without fighting the cursor while the user is actively typing.
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

  function addImage() {
    const url = window.prompt("Image URL");
    if (url) editor.chain().focus().setImage({ src: url }).run();
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
  const inertBtn = "rounded-md p-1.5 text-gray-300 cursor-not-allowed";
  // Toolbar buttons live inside a form and must not submit / must not
  // steal focus from the editor selection before their click fires.
  const noBlur = (e) => e.preventDefault();

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-2 py-1.5">
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
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}>
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}>
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive("underline"))}>
          <Underline className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>
          <List className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>
          <ListOrdered className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().setTextAlign("left").run()} className={btn(editor.isActive({ textAlign: "left" }))}>
          <AlignLeft className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={noBlur} onClick={() => editor.chain().focus().setTextAlign("right").run()} className={btn(editor.isActive({ textAlign: "right" }))}>
          <AlignRight className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <button type="button" onMouseDown={noBlur} onClick={setLink} className={btn(editor.isActive("link"))}>
          <LinkIcon className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={noBlur} onClick={addImage} className={btn(false)}>
          <ImageIcon className="h-4 w-4" />
        </button>
        <button type="button" disabled title="Not wired up yet" className={inertBtn}>
          <TableIcon className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <button type="button" disabled title="Not wired up yet" className={inertBtn}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add Product form                                                     */
/* ------------------------------------------------------------------ */

const VENDOR_OPTIONS = ["JAAPA", "Third-party Vendor"];

async function fetch_product_initial_data(){
  try{
    const response = await axios.get("http://127.0.0.1:5000/api/product/get/data")
  } catch (error) {
    console.error(error)
  }
}
fetch_product_initial_data();

/**
 * Uploads image Files to your Express + Multer endpoint and returns the
 * URLs it responds with. Not wired into handleSave yet \u2014 see the TODO
 * there for the one-line change once your route exists.
 *
 * Matching Express side (adjust paths/field name to your project):
 *
 *   const multer = require("multer");
 *   const upload = multer({ dest: "uploads/products" });
 *
 *   router.post("/upload-images", upload.array("images", 10), (req, res) => {
 *     const urls = req.files.map((f) => `/uploads/products/${f.filename}`);
 *     res.json({ urls });
 *   });
 *
 * The field name passed to formData.append() below ("images") MUST match
 * the field name given to upload.array() on the backend, or Multer will
 * silently drop the files.
 */
async function uploadProductImages(files) {
  if (!files || files.length === 0) return [];

  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));

  const response = await axios.post(
    "http://127.0.0.1:5000/api/product/upload-images",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );

  return response.data.urls || [];
}

// title/description/price/compareAtPrice/sku/trackQuantity/quantity/
// lowStockAlert/status/vendor/tagline/handle/tags \u2014 every one of these
// is read by buildPayload below. category/productType/collections/
// costPrice/chargeTax were removed because buildPayload never reads them.
const INITIAL_FORM = {
  title: "",
  tagline: "",
  description: "",
  handle: "",
  price: "",
  compareAtPrice: "",
  sku: "",
  trackQuantity: true,
  quantity: "",
  lowStockAlert: "",
  status: "active",
  vendor: "",
  tags: [],
};

function slugify(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function get_unique_product_id(){
  const product_id = String(Math.floor(Math.random() * (99999999999 - 10000000000 + 1)) + 10000000000);
  return product_id;
} 

function buildPayload(form, imagePaths) {
  return {
    id: get_unique_product_id(),
    title: form.title,
    tagline: form.tagline,
    images: imagePaths,
    description: form.description,
    handle: form.handle,
    vendor: form.vendor,
    selling_price: Number(form.price) || 0,
    compare_price: form.compareAtPrice ? Number(form.compareAtPrice) : null,
    sku: form.sku || null,
    quantity: form.trackQuantity ? Number(form.quantity) || 0 : null,
    low_stock_alert: form.trackQuantity ? Number(form.lowStockAlert) || null : null,
    status: form.status,
    available: true,
    tags: form.tags || null,
  };
}

export default function AddProduct({ onCancel, onSave }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [handleEdited, setHandleEdited] = useState(false);
  const [images, setImages] = useState([]);
  const [imagePaths, setImagePaths] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  async function uploadImages() {
    const formData = new FormData();
    images.forEach(file => {
        formData.append("images", file);
    });
    try {
      console.log("Uploading Images...");
      console.log(images);
        const response = await axios.post(
            "http://localhost:5000/api/product/upload-images",
            formData
        );
        console.log(response);
        console.log(response.data);
    } catch (err) {
        console.error(err);
    }
}


  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateTitle(value) {
    setForm((prev) => ({
      ...prev,
      title: value,
      handle: handleEdited ? prev.handle : slugify(value),
    }));
  }

  function updateHandle(value) {
    setHandleEdited(true);
    update("handle", slugify(value));
  }



function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    console.log(files);
    setImages(files);
    const paths = files.map(file => `/uploads/products/${file.name}`);
    setImagePaths(paths);
    e.target.value = "";
}

  function removeImage(index) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    console.log("handleSave called");
    await uploadImages();
    console.log("handleSave Finished");
    setSubmitError(null);
    setSubmitting(true);
    try {
      // TODO: once your Multer route is live, swap the line below for:
      //   const imageUrls = await uploadProductImages(images);
      //   const payload = { ...buildPayload(form), images: imageUrls };
      const payload = buildPayload(form, imagePaths);
      const created = await createProduct(payload);
      onSave?.(created);
    } catch (err) {
         const payload = buildPayload(form, imagePaths);
         const response = await axios.post("http://127.0.0.1:5000/api/product/add/new-product",payload)
         console.log(payload)
         console.log(response)
      setSubmitError(
        "Something went wrong. Please try again."
      );
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
          Add Product
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save Product
                <ChevronDown className="h-4 w-4" />
              </>
            )}
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
          <Card title="Basic Information">
            <div className="flex flex-col gap-5">
              <Field label="Product Title">
                <TextInput
                  placeholder="Enter product title"
                  value={form.title}
                  onChange={(e) => updateTitle(e.target.value)}
                />
              </Field>

              <Field label="Tagline">
                <TextInput
                  placeholder="A short one-line hook for this product"
                  value={form.tagline}
                  onChange={(e) => update("tagline", e.target.value)}
                />
              </Field>

              <Field label="Handle" hint="Used in the product URL \u2014 auto-filled from the title, editable.">
                <TextInput
                  placeholder="product-handle"
                  value={form.handle}
                  onChange={(e) => updateHandle(e.target.value)}
                />
              </Field>

              <FieldBlock label="Description">
                <RichTextEditor
                  value={form.description}
                  onChange={(html) => update("description", html)}
                />
              </FieldBlock>
            </div>
          </Card>

          <Card title="Media">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-gray-50/40 px-6 py-10 text-center hover:bg-gray-50">
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />
              <ImagePlus className="h-7 w-7 text-gray-400" strokeWidth={1.6} />
              <p className="mt-1.5 text-sm font-semibold text-gray-800">Upload product images</p>
              <p className="text-xs text-gray-400">
                Drag and drop images here, or{" "}
                <span className="font-medium text-emerald-700">browse</span>
              </p>
              <p className="text-xs text-gray-400">You can upload up to 10 images</p>
            </label>

            {images.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {images.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-xs text-gray-600"
                  >
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Pricing">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Price (\u20B9)">
                <PriceInput
                  placeholder="Enter price"
                  value={form.price}
                  onChange={(v) => update("price", v)}
                />
              </Field>
              <Field label="Compare at Price (\u20B9)">
                <PriceInput
                  placeholder="Enter compare at price"
                  value={form.compareAtPrice}
                  onChange={(v) => update("compareAtPrice", v)}
                />
              </Field>
            </div>
          </Card>

          <Card title="Inventory">
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="SKU (Stock Keeping Unit)">
                  <TextInput
                    placeholder="Enter SKU"
                    value={form.sku}
                    onChange={(e) => update("sku", e.target.value)}
                  />
                </Field>
                <div className="flex items-end pb-2.5 sm:justify-start">
                  <Switch
                    checked={form.trackQuantity}
                    onChange={(v) => update("trackQuantity", v)}
                    label="Track Quantity"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Quantity">
                  <TextInput
                    placeholder="Enter quantity"
                    inputMode="numeric"
                    value={form.quantity}
                    onChange={(e) => update("quantity", e.target.value)}
                  />
                </Field>
                <Field label="Low Stock Alert">
                  <TextInput
                    placeholder="Enter low stock alert quantity"
                    inputMode="numeric"
                    value={form.lowStockAlert}
                    onChange={(e) => update("lowStockAlert", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          <Card title="Product Status">
            <div className="flex flex-col divide-y divide-gray-50">
              <RadioOption
                name="status"
                value="active"
                checked={form.status === "active"}
                onChange={() => update("status", "active")}
                title="Active"
                description="Product will be available for sale"
              />
              <RadioOption
                name="status"
                value="draft"
                checked={form.status === "draft"}
                onChange={() => update("status", "draft")}
                title="Draft"
                description="Product will be saved as draft"
              />
              <RadioOption
                name="status"
                value="archived"
                checked={form.status === "archived"}
                onChange={() => update("status", "archived")}
                title="Archived"
                description="Product will be hidden from store"
              />
            </div>
          </Card>

          <Card title="Vendor / Brand">
            <div className="flex flex-col gap-3">
              <SelectField
                placeholder="Select vendor"
                value={form.vendor}
                onChange={(e) => update("vendor", e.target.value)}
                options={VENDOR_OPTIONS}
              />
              <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline">
                <Plus className="h-4 w-4" />
                Add New Vendor
              </button>
            </div>
          </Card>

          <Card title="Tags">
            <TagsInput tags={form.tags} onChange={(tags) => update("tags", tags)} />
          </Card>
        </div>
      </div>
    </div>
  );
}