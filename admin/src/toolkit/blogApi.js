// Blog data layer — the ONLY file that needs to change when the real API
// lands. Everything else (Blogs.jsx, AddBlog.jsx) already calls these four
// functions and handles their loading/error states.
//
// Right now posts live in localStorage so the feature is fully usable and
// survives a refresh while you're demoing it. To go live, replace each
// function body with the axios call shown above it and delete the storage
// helpers at the bottom — no component changes needed.

const STORAGE_KEY = "jaapa_admin_blogs";

// Mimics network latency so the spinners and disabled states in the UI are
// real rather than decorative. Drop this once the calls are actually remote.
const LATENCY_MS = 250;
const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

export const BLOG_STATUSES = ["draft", "published", "scheduled", "archived"];

export const BLOG_CATEGORIES = [
    "Ayurveda 101",
    "Postpartum Care",
    "Recipes",
    "Ingredients",
    "Wellness",
    "Stories",
];

export function emptyBlog() {
    return {
        id: null,
        title: "",
        slug: "",
        excerpt: "",
        content: "",
        coverImage: "",
        coverAlt: "",
        author: "",
        category: "",
        tags: [],
        status: "draft",
        publishedAt: "",
        featured: false,
        readingMinutes: "",
        metaTitle: "",
        metaDescription: "",
    };
}

export function slugify(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
}

/** Words per minute is a rough industry average — good enough for a badge. */
export function estimateReadingMinutes(html) {
    const words = String(html || "").replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean);
    return Math.max(1, Math.round(words.length / 200));
}

/* ------------------------------------------------------------------ */
/* The four calls the UI makes                                         */
/* ------------------------------------------------------------------ */

// LIVE: const { data } = await axios.get("http://127.0.0.1:5000/api/blog/get/data");
//       return data.body;
export async function listBlogs() {
    await delay();
    return readAll().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

// LIVE: const { data } = await axios.get(`http://127.0.0.1:5000/api/blog/${id}`);
//       return data.blog;
export async function getBlog(id) {
    await delay();
    return readAll().find((post) => post.id === id) || null;
}

// LIVE: create -> axios.post("http://127.0.0.1:5000/api/blog/add/new-blog", blog)
//       update -> axios.put(`http://127.0.0.1:5000/api/blog/update/${blog.id}`, blog)
export async function saveBlog(blog) {
    await delay();

    const posts = readAll();
    const now = new Date().toISOString();

    // A slug is what the post is served under, so two posts can't share one.
    const slug = blog.slug || slugify(blog.title);
    const clash = posts.find((post) => post.slug === slug && post.id !== blog.id);
    if (clash) {
        throw new Error(`The slug "${slug}" is already used by "${clash.title}".`);
    }

    if (blog.id) {
        const index = posts.findIndex((post) => post.id === blog.id);
        if (index === -1) throw new Error("This post no longer exists.");
        posts[index] = { ...posts[index], ...blog, slug, updatedAt: now };
        writeAll(posts);
        return posts[index];
    }

    const created = {
        ...blog,
        slug,
        id: `blog_${Date.now()}`,
        createdAt: now,
        updatedAt: now,
    };
    writeAll([created, ...posts]);
    return created;
}

// LIVE: await axios.delete(`http://127.0.0.1:5000/api/blog/delete/${id}`);
export async function deleteBlog(id) {
    await delay();
    const posts = readAll();
    if (!posts.some((post) => post.id === id)) {
        throw new Error("This post no longer exists.");
    }
    writeAll(posts.filter((post) => post.id !== id));
}

/* ------------------------------------------------------------------ */
/* localStorage plumbing — delete this section when the API is wired   */
/* ------------------------------------------------------------------ */

const SEED = [
    {
        id: "blog_seed_1",
        title: "Why Ayurveda Starts With Digestion",
        slug: "why-ayurveda-starts-with-digestion",
        excerpt: "Agni, the digestive fire, sits at the centre of every Ayurvedic protocol. Here's why.",
        content:
            "<p>In Ayurveda, almost every conversation about health circles back to <strong>agni</strong> — the digestive fire.</p><p>When agni is steady, food becomes nourishment. When it falters, the same meal leaves behind ama, the residue that classical texts blame for most everyday complaints.</p>",
        coverImage: "",
        coverAlt: "",
        author: "Dr. Meera Iyer",
        category: "Ayurveda 101",
        tags: ["digestion", "agni", "basics"],
        status: "published",
        publishedAt: "2026-07-28",
        featured: true,
        readingMinutes: "4",
        metaTitle: "Why Ayurveda Starts With Digestion",
        metaDescription: "Agni, the digestive fire, sits at the centre of every Ayurvedic protocol.",
        createdAt: "2026-07-28T09:00:00.000Z",
        updatedAt: "2026-07-28T09:00:00.000Z",
    },
    {
        id: "blog_seed_2",
        title: "The First Forty Days: A Postpartum Routine",
        slug: "the-first-forty-days-a-postpartum-routine",
        excerpt: "A gentle day-by-day rhythm for the weeks that matter most after birth.",
        content:
            "<p>The traditional <em>sutika</em> period lasts roughly forty days, and almost everything about it is designed around one idea: warmth.</p>",
        coverImage: "",
        coverAlt: "",
        author: "Anjali Rao",
        category: "Postpartum Care",
        tags: ["postpartum", "routine"],
        status: "draft",
        publishedAt: "",
        featured: false,
        readingMinutes: "7",
        metaTitle: "",
        metaDescription: "",
        createdAt: "2026-08-02T11:30:00.000Z",
        updatedAt: "2026-08-02T11:30:00.000Z",
    },
];

function readAll() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            writeAll(SEED);
            return [...SEED];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("Couldn't read stored blogs:", error);
        return [];
    }
}

function writeAll(posts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}
