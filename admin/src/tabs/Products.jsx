import React, { useState } from "react";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";

const PRODUCTS = [
  { name: "Lactomama Tea", variant: "200g", category: "Wellness Tea", price: "\u20B9499", stock: 128, status: "In Stock", color: "#8AA986" },
  { name: "Stress Balance Oil", variant: "30ml", category: "Essential Oils", price: "\u20B9799", stock: 64, status: "In Stock", color: "#D9C08A" },
  { name: "Nourishing Drink Mix", variant: "250g", category: "Nutrition", price: "\u20B9599", stock: 12, status: "Low Stock", color: "#C7CFC4" },
  { name: "Ashwagandha Capsules", variant: "60 Capsules", category: "Supplements", price: "\u20B9699", stock: 0, status: "Out of Stock", color: "#DDB876" },
  { name: "Turmeric Glow Serum", variant: "15ml", category: "Skin Care", price: "\u20B91,099", stock: 45, status: "In Stock", color: "#C99A6B" },
  { name: "Digestive Churna", variant: "100g", category: "Wellness", price: "\u20B9349", stock: 8, status: "Low Stock", color: "#9FB08A" },
];

const STATUS_STYLES = {
  "In Stock": "bg-emerald-50 text-emerald-700",
  "Low Stock": "bg-amber-50 text-amber-700",
  "Out of Stock": "bg-red-50 text-red-600",
};

export default function Products() {
  const [query, setQuery] = useState("");

  const filtered = PRODUCTS.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

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
        <button className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900">
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product) => (
          <div key={product.name} className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-start justify-between">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${product.color}33` }}
              >
                <div className="h-6 w-6 rounded-full" style={{ backgroundColor: product.color }} />
              </div>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[product.status]}`}>
                {product.status}
              </span>
            </div>

            <p className="mt-3 text-sm font-semibold text-gray-900">{product.name}</p>
            <p className="text-xs text-gray-400">{product.variant} \u00B7 {product.category}</p>

            <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">{product.price}</p>
                <p className="text-xs text-gray-400">{product.stock} in stock</p>
              </div>
              <div className="flex items-center gap-1">
                <button className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700">
                  <Pencil className="h-4 w-4" />
                </button>
                <button className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-gray-400">No products match your search.</p>
        )}
      </div>
    </div>
  );
}