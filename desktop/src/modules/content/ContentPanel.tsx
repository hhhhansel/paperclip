import { useEffect, useState } from "react";
import { load } from "@tauri-apps/plugin-store";
import styles from "../shared.module.css";
import cal from "./ContentPanel.module.css";

// ── Types ──────────────────────────────────────────────────────────────
type Platform = "instagram" | "tiktok" | "linkedin" | "twitter" | "youtube";
type Status   = "idea" | "draft" | "scheduled" | "published";
type Brand    = "cael" | "mm" | "personal";

interface Post {
  id: string;
  date: string;       // YYYY-MM-DD
  platform: Platform;
  brand: Brand;
  caption: string;
  status: Status;
  createdAt: number;
}

// ── Platform config ─────────────────────────────────────────────────────
const PLATFORMS: { id: Platform; label: string; emoji: string; color: string }[] = [
  { id: "instagram", label: "Instagram", emoji: "📸", color: "#E1306C" },
  { id: "tiktok",   label: "TikTok",    emoji: "🎵", color: "#69C9D0" },
  { id: "linkedin", label: "LinkedIn",  emoji: "💼", color: "#0A66C2" },
  { id: "twitter",  label: "Twitter/X", emoji: "𝕏",  color: "#888" },
  { id: "youtube",  label: "YouTube",   emoji: "▶️", color: "#FF0000" },
];

const BRANDS: { id: Brand; label: string; color: string }[] = [
  { id: "cael",     label: "CAEL",          color: "#3FCF8E" },
  { id: "mm",       label: "Maison MM",     color: "#2B7FD4" },
  { id: "personal", label: "Personal",      color: "#E8A44A" },
];

const STATUS_OPTS: { id: Status; label: string }[] = [
  { id: "idea",      label: "Idea" },
  { id: "draft",     label: "Draft" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
];

// ── Store helpers ────────────────────────────────────────────────────────
async function getStore() {
  return load("content.bin", { defaults: {}, autoSave: true });
}
async function loadPosts(): Promise<Post[]> {
  const s = await getStore();
  const v = await s.get<Post[]>("posts");
  return v ?? [];
}
async function savePosts(posts: Post[]) {
  (await getStore()).set("posts", posts);
}

// ── Calendar helpers ─────────────────────────────────────────────────────
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstDayOf(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}
function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── Empty form ────────────────────────────────────────────────────────────
function emptyForm(date?: string) {
  return {
    date: date ?? "",
    platform: "instagram" as Platform,
    brand: "cael" as Brand,
    caption: "",
    status: "idea" as Status,
  };
}

// ── Component ─────────────────────────────────────────────────────────────
export function ContentPanel() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<Brand | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => { loadPosts().then(setPosts); }, []);

  function save(next: Post[]) { setPosts(next); savePosts(next); }

  function submitPost() {
    if (!form.date || !form.caption.trim()) return;
    if (editing) {
      save(posts.map(p => p.id === editing ? { ...p, ...form } : p));
      setEditing(null);
    } else {
      save([...posts, { id: Date.now().toString(), ...form, createdAt: Date.now() }]);
    }
    setShowForm(false);
    setForm(emptyForm());
  }

  function openEdit(post: Post) {
    setForm({ date: post.date, platform: post.platform, brand: post.brand, caption: post.caption, status: post.status });
    setEditing(post.id);
    setShowForm(true);
  }

  function deletePost(id: string) { save(posts.filter(p => p.id !== id)); }

  function openNewOnDate(date: string) {
    setForm(emptyForm(date));
    setEditing(null);
    setShowForm(true);
  }

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const visible = filter === "all" ? posts : posts.filter(p => p.brand === filter);
  const postsByDate = (date: string) => visible.filter(p => p.date === date);

  const days = daysInMonth(year, month);
  const startDay = firstDayOf(year, month);
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  // List view: upcoming + this month
  const upcoming = visible
    .filter(p => p.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  return (
    <div className={styles.module}>
      {/* ── Header ── */}
      <div className={cal.topBar}>
        <div>
          <h1 className={styles.moduleTitle}>Content Calendar</h1>
          <p className={styles.moduleSubtitle}>Plan, schedule, and track posts across all brands</p>
        </div>
        <button className={cal.newBtn} onClick={() => { setForm(emptyForm(todayStr)); setEditing(null); setShowForm(true); }}>
          + New Post
        </button>
      </div>

      {/* ── Brand filter ── */}
      <div className={cal.filters}>
        <button className={`${cal.filterChip} ${filter === "all" ? cal.filterActive : ""}`} onClick={() => setFilter("all")}>
          All
        </button>
        {BRANDS.map(b => (
          <button key={b.id}
            className={`${cal.filterChip} ${filter === b.id ? cal.filterActive : ""}`}
            style={filter === b.id ? { borderColor: b.color, color: b.color, background: `${b.color}15` } : {}}
            onClick={() => setFilter(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className={cal.layout}>
        {/* ── Calendar grid ── */}
        <div className={cal.calendarWrap}>
          <div className={cal.calNav}>
            <button className={cal.navBtn} onClick={prevMonth}>‹</button>
            <span className={cal.calTitle}>{MONTHS[month]} {year}</span>
            <button className={cal.navBtn} onClick={nextMonth}>›</button>
          </div>

          <div className={cal.grid}>
            {DOW.map(d => <div key={d} className={cal.dow}>{d}</div>)}

            {/* empty cells before first day */}
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`e${i}`} className={cal.cell} />
            ))}

            {/* day cells */}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1;
              const dateStr = toDateStr(year, month, day);
              const dayPosts = postsByDate(dateStr);
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={day}
                  className={`${cal.cell} ${cal.dayCell} ${isToday ? cal.today : ""}`}
                  onClick={() => openNewOnDate(dateStr)}
                >
                  <span className={cal.dayNum}>{day}</span>
                  <div className={cal.postDots}>
                    {dayPosts.slice(0, 3).map(p => {
                      const plat = PLATFORMS.find(pl => pl.id === p.platform);
                      const brand = BRANDS.find(b => b.id === p.brand);
                      return (
                        <span
                          key={p.id}
                          className={cal.postDot}
                          style={{ background: brand?.color ?? "#888" }}
                          title={`${p.caption.slice(0, 40)} — ${plat?.label}`}
                          onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                        />
                      );
                    })}
                    {dayPosts.length > 3 && (
                      <span className={cal.moreDots}>+{dayPosts.length - 3}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Upcoming list ── */}
        <div className={cal.sidebar}>
          <div className={cal.sideHeader}>
            <span className={cal.sideTitle}>Upcoming</span>
            <span className={cal.sideCount}>{upcoming.length}</span>
          </div>

          {upcoming.length === 0 ? (
            <div className={cal.sideEmpty}>No posts scheduled yet</div>
          ) : (
            <div className={cal.sideList}>
              {upcoming.map(p => {
                const plat  = PLATFORMS.find(pl => pl.id === p.platform);
                const brand = BRANDS.find(b => b.id === p.brand);
                const status = STATUS_OPTS.find(s => s.id === p.status);
                return (
                  <div key={p.id} className={cal.sidePost} onClick={() => openEdit(p)}>
                    <div className={cal.sidePostMeta}>
                      <span className={cal.sideEmoji}>{plat?.emoji}</span>
                      <span className={cal.sideDate}>{p.date.slice(5)}</span>
                      <span className={cal.sideBrand} style={{ color: brand?.color }}>{brand?.label}</span>
                      <span className={`${cal.sideStatus} ${cal[`status_${p.status}`]}`}>{status?.label}</span>
                    </div>
                    <div className={cal.sideCaption}>{p.caption.slice(0, 80)}{p.caption.length > 80 ? "…" : ""}</div>
                    <button className={cal.sideDelete} onClick={(e) => { e.stopPropagation(); deletePost(p.id); }}>×</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stats */}
          <div className={cal.stats}>
            {(["idea","draft","scheduled","published"] as Status[]).map(s => {
              const count = visible.filter(p => p.status === s).length;
              return (
                <div key={s} className={cal.stat}>
                  <span className={`${cal.statDot} ${cal[`status_${s}`]}`} />
                  <span className={cal.statLabel}>{s}</span>
                  <span className={cal.statCount}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── New/Edit post form ── */}
      {showForm && (
        <div className={cal.overlay} onClick={() => setShowForm(false)}>
          <div className={cal.modal} onClick={e => e.stopPropagation()}>
            <div className={cal.modalHeader}>
              <span className={cal.modalTitle}>{editing ? "Edit Post" : "New Post"}</span>
              <button className={cal.modalClose} onClick={() => setShowForm(false)}>×</button>
            </div>

            <div className={cal.field}>
              <label className={cal.label}>Date</label>
              <input type="date" className={cal.input} value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>

            <div className={cal.fieldRow}>
              <div className={cal.field}>
                <label className={cal.label}>Platform</label>
                <select className={cal.select} value={form.platform}
                  onChange={e => setForm(f => ({ ...f, platform: e.target.value as Platform }))}>
                  {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.label}</option>)}
                </select>
              </div>
              <div className={cal.field}>
                <label className={cal.label}>Brand</label>
                <select className={cal.select} value={form.brand}
                  onChange={e => setForm(f => ({ ...f, brand: e.target.value as Brand }))}>
                  {BRANDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              </div>
              <div className={cal.field}>
                <label className={cal.label}>Status</label>
                <select className={cal.select} value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}>
                  {STATUS_OPTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className={cal.field}>
              <label className={cal.label}>Caption / notes</label>
              <textarea className={cal.textarea} rows={4} placeholder="What's the post about…"
                value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} />
            </div>

            <div className={cal.modalActions}>
              {editing && (
                <button className={cal.deleteBtn}
                  onClick={() => { deletePost(editing); setShowForm(false); setEditing(null); }}>
                  Delete
                </button>
              )}
              <button className={cal.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button className={cal.saveBtn} onClick={submitPost}>
                {editing ? "Save changes" : "Add post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
