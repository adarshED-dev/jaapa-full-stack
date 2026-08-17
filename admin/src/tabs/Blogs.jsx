import React, { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Star,
  FileText,
} from "lucide-react";

import AddBlog from "../toolkit/AddBlog";
import { listBlogs, deleteBlog, BLOG_STATUSES } from "../toolkit/blogApi";

const STATUS_STYLES = {
  published: "bg-emerald-50 text-emerald-700",
  draft: "bg-amber-50 text-amber-700",
  scheduled: "bg-blue-50 text-blue-700",
  archived: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS = {
  published: "Published",
  draft: "Draft",
  scheduled: "Scheduled",
  archived: "Archived",
};

const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, 2, current - 1, current, current + 1, total - 1, total]);
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

// Shown when the trash icon is clicked — nothing is deleted until the
// user explicitly confirms here.
function ConfirmDeleteModal({ post, deleting, error, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600" strokeWidth={1.8} />
        </div>
        <h2 className="mt-4 text-base font-semibold text-gray-900">Delete post?</h2>
        <p className="mt-1.5 text-sm text-gray-500">
          Are you sure you want to delete{" "}
          <span className="font-medium text-gray-700">{post.title || "this post"}</span>? This
          can't be undone.
        </p>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

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

export default function Blogs() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState("list"); // "list" | "add" | "edit"
  const [editingPost, setEditingPost] = useState(null);

  // Pulled out of the effect so save and delete can both refresh the list
  // instead of duplicating the fetch in three places.
  async function loadPosts() {
    setLoading(true);
    setLoadError(null);
    try {
      setPosts(await listBlogs());
    } catch (error) {
      console.error(error);
      setLoadError("Couldn't load posts. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  const filtered = posts.filter((post) => {
    const haystack = `${post.title} ${post.author} ${post.category} ${(post.tags || []).join(" ")}`.toLowerCase();
    const matchesQuery = haystack.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || post.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  // --- Pagination ---
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  // --- Delete confirmation ---
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBlog(deleteTarget.id);
      setDeleteTarget(null);
      loadPosts();
    } catch (error) {
      console.error(error);
      setDeleteError(error.message || "Couldn't delete this post. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  function openEditor(post) {
    setEditingPost(post);
    setView("edit");
  }

  if (view === "add" || view === "edit") {
    return (
      <AddBlog
        post={view === "edit" ? editingPost : undefined}
        onCancel={() => {
          setView("list");
          setEditingPost(null);
        }}
        onSave={() => {
          setView("list");
          setEditingPost(null);
          loadPosts();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts, authors, tags"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {["all", ...BLOG_STATUSES].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  statusFilter === status
                    ? "bg-emerald-50 text-emerald-800"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {status === "all" ? "All" : STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setView("add")}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
        >
          <Plus className="h-4 w-4" />
          Add Post
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Post</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Author</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium">Published</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-emerald-50">
                        {post.coverImage ? (
                          <img src={post.coverImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <FileText className="h-5 w-5 text-emerald-700" strokeWidth={1.8} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => openEditor(post)}
                          className="flex items-center gap-1.5 text-left font-medium text-gray-800 hover:text-emerald-800 hover:underline"
                        >
                          <span className="truncate">{post.title}</span>
                          {post.featured && (
                            <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" fill="currentColor" />
                          )}
                        </button>
                        <p className="truncate text-xs text-gray-400">
                          /{post.slug}
                          {post.readingMinutes ? ` · ${post.readingMinutes} min read` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        STATUS_STYLES[post.status] || STATUS_STYLES.draft
                      }`}
                    >
                      {STATUS_LABELS[post.status] || post.status}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-gray-600">{post.author || "—"}</td>
                  <td className="px-3 py-3.5 text-gray-600">{post.category || "—"}</td>
                  <td className="px-3 py-3.5 text-gray-600">{formatDate(post.publishedAt)}</td>
                  <td className="px-3 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEditor(post)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(post);
                          setDeleteError(null);
                        }}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading posts...
                    </span>
                  </td>
                </tr>
              )}

              {!loading && paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                    {posts.length === 0
                      ? "No posts yet — write your first one."
                      : "No posts match your search."}
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
              ? "Showing 0 posts"
              : `Showing ${startIndex + 1}–${Math.min(startIndex + PAGE_SIZE, filtered.length)} of ${filtered.length} posts`}
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
                {idx > 0 && page - arr[idx - 1] > 1 && <span className="px-1 text-gray-300">…</span>}
                <button
                  onClick={() => setCurrentPage(page)}
                  className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium ${
                    page === safePage ? "bg-emerald-800 text-white" : "text-gray-600 hover:bg-gray-50"
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
          post={deleteTarget}
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
