import React, { useEffect, useState } from "react";
import { Search, Plus, Pencil, Trash2, Package, ChevronLeft, ChevronRight, AlertTriangle, Loader2 } from "lucide-react";
import AddProduct from "../toolkit/AddProducts";
import axios from 'axios';


// Status values now match what the form actually saves (active / draft / archived)
// instead of the old In Stock / Low Stock placeholders \u2014 needed so the badge
// column below renders something real instead of blank styling.
const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700",
  draft: "bg-amber-50 text-amber-700",
  archived: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS = {
  active: "Active",
  draft: "Draft",
  archived: "Archived",
};

function formatPrice(value) {
  const n = Number(value);
  if (!value || Number.isNaN(n)) return null;
  return `\u20B9${n.toLocaleString("en-IN")}`;
}

const PAGE_SIZE = 10;

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, 2, current - 1, current, current + 1, total - 1, total]);
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

// Shown when the trash icon is clicked \u2014 nothing is deleted until the
// user explicitly confirms here.
function ConfirmDeleteModal({ product, deleting, error, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600" strokeWidth={1.8} />
        </div>
        <h2 className="mt-4 text-base font-semibold text-gray-900">Delete product?</h2>
        <p className="mt-1.5 text-sm text-gray-500">
          Are you sure you want to delete{" "}
          <span className="font-medium text-gray-700">{product.title || "this product"}</span>? This
          can't be undone.
        </p>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  
const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list"); // "list" | "add" | "edit"
  const [editingProduct, setEditingProduct] = useState(null);

  // Pulled out of the effect so Edit-save and Delete can both call it again
  // to refresh the list, instead of duplicating the fetch in three places.
  async function loadProducts() {
    try {
      const response = await axios.get("http://127.0.0.1:5000/api/product/get/data");
      setProducts(response.data.body);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = products.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()));

  // --- Pagination (purely presentational \u2014 doesn't touch the fetch above) ---
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const allOnPageSelected = paginated.length > 0 && paginated.every((p) => selected.includes(p.title));

  function toggleSelectAllOnPage() {
    if (allOnPageSelected) {
      setSelected((prev) => prev.filter((title) => !paginated.some((p) => p.title === title)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...paginated.map((p) => p.title)])]);
    }
  }

  function toggleSelectRow(title) {
    setSelected((prev) => (prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]));
  }

  // --- Delete confirmation ---
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await axios.delete(`http://127.0.0.1:5000/api/product/delete/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadProducts();
    } catch (err) {
      console.error(err);
      setDeleteError(
        err.response
          ? `Server responded with ${err.response.status}.`
          : "Couldn't reach the server. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  }

  if (view === "add") {
    return (
      <AddProduct
        onCancel={() => setView("list")}
        onSave={() => {
          setView("list");
          loadProducts();
        }}
      />
    );
  }

  if (view === "edit") {
    return (
      <AddProduct
        product={editingProduct}
        onCancel={() => {
          setView("list");
          setEditingProduct(null);
        }}
        onSave={() => {
          setView("list");
          setEditingProduct(null);
          loadProducts();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <button
          onClick={() => setView("add")}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-400">
                <th className="w-10 px-5 py-3">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    className="h-4 w-4 rounded border-gray-300 accent-emerald-800"
                  />
                </th>
                <th className="px-3 py-3 font-medium">Product</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Inventory</th>
                <th className="px-3 py-3 font-medium">Price</th>
                <th className="px-3 py-3 font-medium">Tags</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map((product) => {
                const status = product.status || "active";
                const price = formatPrice(product.selling_price);
                const comparePrice = formatPrice(product.compare_price);
                return (
                  <tr key={product.title} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5">
                      <input
                        type="checkbox"
                        checked={selected.includes(product.title)}
                        onChange={() => toggleSelectRow(product.title)}
                        className="h-4 w-4 rounded border-gray-300 accent-emerald-800"
                      />
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50 overflow-hidden">
                          <img src={product.images[0]} alt="product-image" className="w-full rounder-lg"/>
                        </div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(product);
                              setView("edit");
                            }}
                            className="truncate text-left font-medium text-gray-800 hover:text-emerald-800 hover:underline"
                          >
                            {product.title}
                          </button>
                          {product.tagline && (
                            <p className="truncate text-xs text-gray-400">{product.tagline}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          STATUS_STYLES[status] || STATUS_STYLES.active
                        }`}
                      >
                        {STATUS_LABELS[status] || status}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-gray-600">{product.quantity ?? 0} in stock</td>
                    <td className="px-3 py-3.5">
                      <span className="font-medium text-gray-800">{price || "\u2014"}</span>
                      {comparePrice && (
                        <span className="ml-2 text-xs text-gray-400 line-through">{comparePrice}</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(product.tags || []).slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-500"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(product);
                            setView("edit");
                          }}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(product);
                            setDeleteError(null);
                          }}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">
                    No products match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-5 py-3.5 sm:flex-row">
          <p className="text-xs text-gray-400">
            {filtered.length === 0
              ? "Showing 0 products"
              : `Showing ${startIndex + 1}\u2013${Math.min(startIndex + PAGE_SIZE, filtered.length)} of ${filtered.length} products`}
          </p>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {getPageNumbers(safePage, totalPages).map((page, idx, arr) => (
              <React.Fragment key={page}>
                {idx > 0 && page - arr[idx - 1] > 1 && <span className="px-1 text-gray-300">\u2026</span>}
                <button
                  onClick={() => setCurrentPage(page)}
                  className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium ${
                    page === safePage
                      ? "bg-emerald-800 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {page}
                </button>
              </React.Fragment>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDeleteModal
          product={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError(null);
          }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}