import React, { useState } from "react";
import axios from 'axios'
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

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

const inputClasses =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100";

function TextInput(props) {
  return <input {...props} className={inputClasses} />;
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

/* ------------------------------------------------------------------ */
/* Rich text toolbar (static \u2014 wire up to your editor of choice)       */
/* ------------------------------------------------------------------ */

function DescriptionToolbar() {
  const iconButton = "rounded-md p-1.5 text-gray-500 hover:bg-gray-100";
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-2 py-1.5">
      <button type="button" className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">
        Paragraph
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>
      <span className="mx-1 h-4 w-px bg-gray-200" />
      <button type="button" className={iconButton}><Bold className="h-4 w-4" /></button>
      <button type="button" className={iconButton}><Italic className="h-4 w-4" /></button>
      <button type="button" className={iconButton}><Underline className="h-4 w-4" /></button>
      <span className="mx-1 h-4 w-px bg-gray-200" />
      <button type="button" className={iconButton}><List className="h-4 w-4" /></button>
      <button type="button" className={iconButton}><ListOrdered className="h-4 w-4" /></button>
      <span className="mx-1 h-4 w-px bg-gray-200" />
      <button type="button" className={iconButton}><AlignLeft className="h-4 w-4" /></button>
      <button type="button" className={iconButton}><AlignRight className="h-4 w-4" /></button>
      <span className="mx-1 h-4 w-px bg-gray-200" />
      <button type="button" className={iconButton}><LinkIcon className="h-4 w-4" /></button>
      <button type="button" className={iconButton}><ImageIcon className="h-4 w-4" /></button>
      <button type="button" className="flex items-center gap-1 rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
        <TableIcon className="h-4 w-4" />
        <ChevronDown className="h-3 w-3 text-gray-400" />
      </button>
      <span className="mx-1 h-4 w-px bg-gray-200" />
      <button type="button" className={iconButton}><MoreHorizontal className="h-4 w-4" /></button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add Product form                                                     */
/* ------------------------------------------------------------------ */

const CATEGORY_OPTIONS = ["Wellness Tea", "Essential Oils", "Nutrition", "Supplements", "Skin Care"];
const TYPE_OPTIONS = ["Physical Product", "Digital Product", "Service"];
const VENDOR_OPTIONS = ["JAAPA", "Third-party Vendor"];
const COLLECTION_OPTIONS = ["Best Sellers", "New Arrivals", "Ayurvedic Essentials", "Gift Sets"];

async function fetch_product_initial_data(){
  try{
    const response = await axios.get("http://127.0.0.1:5000/api/product/get/data")
    console.log("an",response.data.body);
  } catch (error) {
    console.error(error)
  }
}
fetch_product_initial_data();

const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  compareAtPrice: "",
  costPrice: "",
  chargeTax: true,
  sku: "",
  trackQuantity: true,
  quantity: "",
  lowStockAlert: "",
  status: "active",
  category: "",
  productType: "",
  vendor: "",
  collections: "",
};

function get_unique_product_id(){
  const product_id = String(Math.floor(Math.random() * (99999999999 - 10000000000 + 1)) + 10000000000);
  return product_id;
} 
function buildPayload(form) {
  return {
    id: get_unique_product_id(),
    title: form.title,
    tagline: form.tagline,
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
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    setImages((prev) => [...prev, ...files].slice(0, 10));
    e.target.value = "";
  }

  function removeImage(index) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      // TODO: once you have an upload endpoint, upload `images` first
      // and merge the returned URLs into the payload below, e.g.:
      //   const imageUrls = await uploadImages(images);
      //   const payload = { ...buildPayload(form), images: imageUrls };
      const payload = buildPayload(form);
      const created = await createProduct(payload);
      onSave?.(created);
    } catch (err) {
         const payload = buildPayload(form);
         console.log(payload)
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
                  onChange={(e) => update("title", e.target.value)}
                />
              </Field>

              <Field label="Description">
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <DescriptionToolbar />
                  <textarea
                    placeholder="Write product description..."
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    rows={4}
                    className="w-full resize-none px-3.5 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
                  />
                </div>
              </Field>
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
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Price (\u20B9)">
                  <TextInput
                    placeholder="Enter price"
                    inputMode="decimal"
                    value={form.price}
                    onChange={(e) => update("price", e.target.value)}
                  />
                </Field>
                <Field label="Compare at Price (\u20B9)">
                  <TextInput
                    placeholder="Enter compare at price"
                    inputMode="decimal"
                    value={form.compareAtPrice}
                    onChange={(e) => update("compareAtPrice", e.target.value)}
                  />
                </Field>
                <Field label="Cost Price (\u20B9)">
                  <TextInput
                    placeholder="Enter cost price"
                    inputMode="decimal"
                    value={form.costPrice}
                    onChange={(e) => update("costPrice", e.target.value)}
                  />
                </Field>
              </div>

              <Switch
                checked={form.chargeTax}
                onChange={(v) => update("chargeTax", v)}
                label="Charge tax on this product"
              />
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

          <Card title="Product Category">
            <div className="flex flex-col gap-3">
              <SelectField
                placeholder="Select category"
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                options={CATEGORY_OPTIONS}
              />
              <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline">
                <Plus className="h-4 w-4" />
                Add New Category
              </button>
            </div>
          </Card>

          <Card title="Product Type">
            <SelectField
              placeholder="Select product type"
              value={form.productType}
              onChange={(e) => update("productType", e.target.value)}
              options={TYPE_OPTIONS}
            />
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

          <Card title="Collections (Optional)">
            <SelectField
              placeholder="Select collections"
              value={form.collections}
              onChange={(e) => update("collections", e.target.value)}
              options={COLLECTION_OPTIONS}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}