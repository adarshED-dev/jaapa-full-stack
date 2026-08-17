// Generic "are you sure?" for a destructive action — nothing is ever
// deleted until this is explicitly confirmed. Same shape as Products.jsx's
// original delete confirmation; pulled out here so Customers (and anything
// after it) doesn't grow its own copy.

import { AlertTriangle, Loader2 } from "lucide-react";

export default function ConfirmDeleteModal({
  title,
  description,
  confirmLabel = "Delete",
  deleting,
  error,
  onCancel,
  onConfirm,
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600" strokeWidth={1.8} />
        </div>
        <h2 className="mt-4 text-base font-semibold text-gray-900">{title}</h2>
        <p className="mt-1.5 text-sm text-gray-500">{description}</p>

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
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
