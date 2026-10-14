"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  LayoutDashboard,
  CalendarDays,
  ListTodo,
  Search,
  Copy,
  Check,
  Pencil,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Duplicate,
  Film,
  Trash2,
  MoreHorizontal,
  Cloud,
  LogOut,
  StickyNote,
} from "@/components/icons";
import PostModal, { PostFormInitial } from "@/components/PostModal";
import PlatformIcon from "@/components/PlatformIcon";
import LoginModal from "@/components/LoginModal";
import type { User } from "@supabase/supabase-js";
import {
  isCloudConfigured,
  fetchCloudPosts,
  pushPost,
  pushAll,
  deleteCloudPost,
  deleteCloudMissing,
  getSessionUser,
  signOut,
  onAuthChange,
  mergePosts,
  loadTombs,
  addTomb,
  clearTomb,
  clearTombs,
  testCloud,
  describeError,
  deleteMediaPaths,
  listUserFiles,
  moveMedia,
  mediaFolder,
  safeFileName,
} from "@/lib/cloud";
import {
  EditorialPost,
  EditorialPillar,
  EditorialStatus,
  PlatformKey,
  MediaType,
  PILLARS,
  STATUSES,
  PLATFORMS,
  MEDIA_TYPES,
  mediaLabel,
  normalizeMediaType,
  uid,
  emptyVariants,
  lastNWeeks,
  weekLabelShort,
  pillarLabel,
  statusLabel,
  platformLabel,
  todayISO,
  toISODate,
  parseISODate,
  formatDayLong,
  formatShort,
  loadPosts,
  savePosts,
  copyText,
  nowISO,
} from "@/lib/editorial";
import { purgeBlobs } from "@/lib/media-db";

type Tab = "dashboard" | "calendar" | "posts" | "drafts";

// Amorces d'idées affichées en rotation dans la Boîte à idées
const IDEA_PLACEHOLDERS = [
  "Ex : post sur les erreurs de débutant en vibe coding…",
  "Ex : ce que l'IA ne fera jamais à ta place…",
  "Ex : l'outil que tu ouvres chaque jour sans y penser…",
  "Ex : le projet que tu n'oses pas encore montrer…",
];

const statusStyle: Record<EditorialStatus, string> = {
  draft: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  to_prepare: "bg-amber-50 text-amber-700 ring-amber-200",
  ready: "bg-blue-50 text-blue-700 ring-blue-200",
  scheduled: "bg-amber-50 text-amber-700 ring-amber-300",
  to_finish: "bg-violet-50 text-violet-700 ring-violet-300",
  published: "bg-emerald-50 text-emerald-700 ring-emerald-500",
};

// Libellé affiché d'un statut (vocabulaire unique : celui de STATUSES).
function displayStatusLabel(p: EditorialPost): string {
  // Un seul vocabulaire partout : "Planifiée" (l'action comme l'état).
  return statusLabel(p.status);
}

const pillarDot: Record<EditorialPillar, string> = {
  educational: "bg-sky-500",
  demonstration: "bg-violet-500",
  problem_solution: "bg-orange-500",
  build_in_public: "bg-emerald-500",
  opinion: "bg-pink-500",
  project_case_study: "bg-zinc-700",
};

// Pastille de statut pour le calendrier : rouge = à finir, vert = planifié, gris = publié
const statusDot: Record<EditorialStatus, string> = {
  draft: "bg-red-500",
  to_prepare: "bg-red-500",
  ready: "bg-amber-500",
  scheduled: "bg-green-500",
  to_finish: "bg-red-500",
  published: "bg-zinc-400",
};

function Badge({ post }: { post: EditorialPost }) {
  const published = post.status === "published";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        published ? "font-bold ring-2" : "ring-1"
      } ${statusStyle[post.status]}`}
    >
      {published ? <Check size={11} /> : null}
      {displayStatusLabel(post)}
    </span>
  );
}

function Pillar({ pillar }: { pillar: EditorialPillar }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-200">
      <span className={`h-1.5 w-1.5 rounded-full ${pillarDot[pillar]}`} />
      {pillarLabel(pillar)}
    </span>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [posts, setPosts] = useState<EditorialPost[]>([]);
  const [ready, setReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EditorialPost | null>(null);
  const [prefill, setPrefill] = useState<PostFormInitial | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // cloud
  const [user, setUser] = useState<User | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [cloudLive, setCloudLive] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ ok: boolean; message: string } | null>(null);
  const syncedFor = useRef<string | null>(null);

  async function runDiagnostic() {
    if (!user) return;
    setSyncInfo({ ok: false, message: "Test en cours…" });
    try {
      setSyncInfo(await testCloud(user.id));
    } catch (e) {
      setSyncInfo({ ok: false, message: `Test impossible : ${describeError(e)}` });
    }
  }

  // Range les fichiers existants vers des dossiers lisibles date_titre.
  async function reorganizeMedia() {
    if (!user) return;
    setSyncInfo({ ok: false, message: "Rangement en cours…" });
    try {
      const paths = await listUserFiles(user.id);
      const byId = new Map(posts.map((p) => [p.id, p]));
      const changed = new Map<string, EditorialPost>();
      let moved = 0;
      for (const oldPath of paths) {
        const parts = oldPath.split("/");
        if (parts.length !== 3) continue;
        const [, postId, file] = parts;
        // Ancien style = 2e segment sans date (uuid) ; nouveau = AAAA-MM-JJ_...
        if (/^\d{4}-\d{2}-\d{2}_/.test(postId)) continue;
        const post = byId.get(postId) ?? changed.get(postId);
        if (!post) continue;
        const mediaId = file.split("-")[0];
        const item = post.mediaItems?.find((m) => m.id === mediaId);
        const newPath = `${mediaFolder(user.id, post.title, post.scheduledDate)}/${mediaId}-${safeFileName(item?.name ?? file)}`;
        if (newPath === oldPath) continue;
        await moveMedia(oldPath, newPath);
        moved++;
        const base = changed.get(postId) ?? post;
        const items = (base.mediaItems ?? []).map((m) =>
          m.id === mediaId ? { ...m, path: newPath } : m
        );
        const upd = { ...base, mediaItems: items, updatedAt: nowISO() };
        changed.set(postId, upd);
        byId.set(postId, upd);
      }
      if (changed.size > 0) {
        const updates = changed;
        setPosts((prev) => prev.map((p) => updates.get(p.id) ?? p));
        if (cloudLive) {
          await pushAll([...updates.values()], user.id).catch(() => {});
        }
      }
      setSyncInfo({ ok: true, message: moved > 0 ? `${moved} fichier(s) rangé(s)` : "Déjà bien rangé, rien à faire" });
    } catch (e) {
      setSyncInfo({ ok: false, message: `Rangement impossible : ${describeError(e)}` });
    }
  }

  // filtres liste
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fPillar, setFPillar] = useState<string>("all");
  const [fPlatform, setFPlatform] = useState<string>("all");
  const [fMedia, setFMedia] = useState<string>("all");

  // idée express + rappel + toast (avec action Annuler éventuelle)
  const [ideaTitle, setIdeaTitle] = useState("");
  const [toast, setToast] = useState<{ msg: string; action?: string } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const toastAction = useRef<(() => void) | null>(null);

  function showToast(msg: string, action?: { label: string; onClick: () => void }, ms = 2600) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ msg, action: action?.label });
    toastAction.current = action?.onClick ?? null;
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastAction.current = null;
    }, ms);
  }

  // Guide 3 pas (masqué une fois terminé ou passé)
  const [guideOff, setGuideOff] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem("content-planner-guide-off") === "1";
    } catch {
      return false;
    }
  });
  function dismissGuide() {
    setGuideOff(true);
    try {
      window.localStorage.setItem("content-planner-guide-off", "1");
    } catch {
      /* stockage indisponible */
    }
  }

  // Invites rotatives pour la page blanche (pause dès qu'on tape)
  const [ideaPh, setIdeaPh] = useState(0);
  useEffect(() => {
    if (ideaTitle.trim() !== "" || modalOpen) return;
    const id = window.setInterval(
      () => setIdeaPh((p) => (p + 1) % IDEA_PLACEHOLDERS.length),
      5000
    );
    return () => window.clearInterval(id);
  }, [ideaTitle, modalOpen]);
  const [reminderOn, setReminderOn] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem("content-planner-reminder") === "1";
    } catch {
      return false;
    }
  });
  const [notifPerm, setNotifPerm] = useState<string>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );

  // calendrier
  const [view, setView] = useState<"month" | "week">("month");
  const lastTrigger = useRef<HTMLElement | null>(null);

  function noteTrigger() {
    const el = document.activeElement;
    if (el instanceof HTMLElement) lastTrigger.current = el;
  }
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  useEffect(() => {
    setPosts(loadPosts());
    setReady(true);
    // Session existante ? on synchronise avec le cloud.
    getSessionUser()
      .then((u) => {
        if (u) {
          setUser(u);
          void syncAfterLogin(u);
        }
      })
      .catch(() => {});
    const off = onAuthChange((u) => {
      setUser(u);
      if (u) {
        setLoginOpen(false);
        void syncAfterLogin(u);
      } else {
        syncedFor.current = null;
        setCloudLive(false);
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tirage cloud <-> local : le plus récent gagne, sans résurrection.
  async function syncAfterLogin(u: User) {
    if (syncedFor.current === u.id) return;
    syncedFor.current = u.id;
    try {
      const cloud = await fetchCloudPosts();
      const merged = mergePosts(loadPosts(), cloud, loadTombs());
      setPosts(merged);
      setCloudLive(true);
      try {
        await pushAll(merged, u.id);
        const msg = `${merged.length} publication(s) synchronisée(s)`;
        setSyncInfo({ ok: true, message: msg });
        showToast(msg);
      } catch (e) {
        const msg = `Sync cloud impossible : ${describeError(e)}`;
        setSyncInfo({ ok: false, message: msg });
        showToast(msg);
      }
    } catch {
      showToast("Cloud injoignable — mode local");
    }
  }

  async function handleSignOut() {
    await signOut().catch(() => {});
    setUser(null);
    syncedFor.current = null;
    setCloudLive(false);
  }

  // Nettoie les photos orphelines (retirées avant enregistrement)
  useEffect(() => {
    if (!ready) return;
    const ids = new Set(posts.flatMap((p) => (p.mediaItems ?? []).map((m) => m.id)));
    purgeBlobs(ids).catch(() => {});
  }, [ready]);

  useEffect(() => {
    if (ready) savePosts(posts);
  }, [posts, ready]);

  useEffect(() => {
    try {
      window.localStorage.setItem("content-planner-reminder", reminderOn ? "1" : "0");
    } catch {
      /* stockage indisponible */
    }
  }, [reminderOn]);

  const today = todayISO();

  const todayPosts = useMemo(
    () => posts.filter((p) => p.scheduledDate === today).sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? "")),
    [posts, today]
  );

  const upcoming = useMemo(
    () =>
      posts
        // Seules les vraies planifiées : les brouillons (même datés) et les
        // "À terminer" n'annoncent rien, ils restent à finir.
        .filter((p) => p.scheduledDate && p.scheduledDate > today && p.status === "scheduled")
        .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "") || (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""))
        .slice(0, 5),
    [posts, today]
  );

  // Rappel à l'ouverture : si posts prévus aujourd'hui
  useEffect(() => {
    if (!ready || !reminderOn || todayPosts.length === 0) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      const names = todayPosts.slice(0, 2).map((p) => p.title).join(" • ");
      new Notification("Cadence — aujourd'hui", {
        body: `${todayPosts.length} publication(s) prévue(s)${names ? ` : ${names}` : ""}`,
      });
    } catch {
      /* notifications indisponibles */
    }
  }, [ready, reminderOn]);

  const counts = useMemo(
    () => ({
      // "À terminer" = pas fini = compté avec les brouillons, jamais comme planifié
      scheduled: posts.filter((p) => p.status === "scheduled").length,
      drafts: posts.filter((p) => p.status === "draft" || p.status === "to_finish").length,
      published: posts.filter((p) => p.status === "published").length,
      toPrepare: posts.filter((p) => p.status === "to_prepare" || p.status === "ready").length,
    }),
    [posts]
  );

  const next14 = useMemo(() => {
    const days: { iso: string; count: number; isToday: boolean }[] = [];
    const base = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const iso = toISODate(d);
      days.push({ iso, count: posts.filter((p) => p.scheduledDate === iso).length, isToday: iso === today });
    }
    return days;
  }, [posts, today]);

  // Boîte à idées : brouillons sans date
  const ideas = useMemo(    () =>
      posts
        .filter((p) => !p.scheduledDate && p.status !== "published")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 5),
    [posts]
  );

  // Rythme : publiés par semaine sur les 8 dernières semaines
  // (jour local de publication : publishedAt, sinon date planifiée, sinon création)
  const weekly = useMemo(() => {
    const weeks = lastNWeeks(8);
    const dayOf = (p: EditorialPost): string | null => {
      if (p.publishedAt) {
        const t = new Date(p.publishedAt).getTime();
        if (!Number.isNaN(t)) return toISODate(new Date(t));
      }
      if (p.scheduledDate) return p.scheduledDate;
      const t = new Date(p.createdAt).getTime();
      return Number.isNaN(t) ? null : toISODate(new Date(t));
    };
    const counts = weeks.map((w) => {
      const start = parseISODate(w).getTime();
      const end = start + 7 * 864e5;
      return posts.filter((p) => {
        if (p.status !== "published") return false;
        const d = dayOf(p);
        if (!d) return false;
        const t = parseISODate(d).getTime();
        return t >= start && t < end;
      }).length;
    });
    return { weeks, counts };
  }, [posts]);

  const thisWeekCount = weekly.counts[7] ?? 0;
  // Série en cours : semaines consécutives avec ≥1 publié, en ignorant
  // la semaine en cours si elle est encore vide.
  const streak = (() => {
    const start = (weekly.counts[7] ?? 0) > 0 ? 7 : 6;
    let s = 0;
    for (let i = start; i >= 0; i--) {
      if ((weekly.counts[i] ?? 0) > 0) s++;
      else break;
    }
    return s;
  })();

  // Onglet Brouillons : tout ce qui n'est ni planifié ni publié
  const drafts = useMemo(
    () =>
      posts
        .filter((p) => p.status === "draft" || p.status === "to_finish")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [posts]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return posts
      .filter((p) => (fStatus === "all" ? true : p.status === fStatus))
      .filter((p) => (fPillar === "all" ? true : p.pillar === fPillar))
      .filter((p) => (fPlatform === "all" ? true : p.platforms.includes(fPlatform as PlatformKey)))
      .filter((p) => (fMedia === "all" ? true : (p.mediaType ?? "text") === (fMedia as MediaType)))
      .filter((p) =>
        needle ? `${p.title} ${p.content} ${p.notes ?? ""}`.toLowerCase().includes(needle) : true
      )
      .sort((a, b) => {
        if (!a.scheduledDate && !b.scheduledDate) return b.createdAt.localeCompare(a.createdAt);
        if (!a.scheduledDate) return 1;
        if (!b.scheduledDate) return -1;
        return a.scheduledDate.localeCompare(b.scheduledDate);
      });
  }, [posts, q, fStatus, fPillar, fPlatform, fMedia]);

  // --- calendrier : grille mois (lundi -> dimanche) ---
  const monthCells = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7; // lundi = 0
    const start = new Date(y, m, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { date: d, iso: toISODate(d), inMonth: d.getMonth() === m };
    });
  }, [cursor]);

  const weekDays = useMemo(() => {
    const ref = cursor;
    const mondayOffset = (ref.getDay() + 6) % 7;
    const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      return { date: d, iso: toISODate(d) };
    });
  }, [cursor]);

  function postsOn(iso: string) {
    return posts
      .filter((p) => p.scheduledDate === iso)
      .sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""));
  }

  function openCreate(dateISO?: string) {
    noteTrigger();
    setEditing(null);
    setPrefill(dateISO ? { scheduledDate: dateISO, status: "scheduled" as EditorialStatus } : null);
    setModalOpen(true);
  }

  function openEdit(p: EditorialPost) {
    noteTrigger();
    setEditing(p);
    setPrefill(null);
    setModalOpen(true);
  }

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
    setPrefill(null);
    try {
      lastTrigger.current?.focus();
    } catch {
      /* ignore */
    }
  }, []);

  function handleSave(post: EditorialPost, cloudNote?: string) {
    clearTomb(post.id);
    setPosts((prev) => {
      const exists = prev.some((x) => x.id === post.id);
      return exists ? prev.map((x) => (x.id === post.id ? post : x)) : [post, ...prev];
    });
    if (cloudLive && user) {
      pushPost(post, user.id).catch((e) =>
        showToast(`Sync cloud impossible : ${describeError(e)} — gardé en local`)
      );
    }
    if (cloudNote) showToast(cloudNote);
  }

  function handleDelete(id: string) {
    const index = posts.findIndex((x) => x.id === id);
    if (index < 0) return;
    const target = posts[index];
    const cloudPaths = (target.mediaItems ?? [])
      .map((m) => m.path)
      .filter((p): p is string => typeof p === "string" && p.length > 0);
    addTomb(id);
    setPosts((prev) => prev.filter((x) => x.id !== id));
    if (cloudLive) {
      deleteCloudPost(id).catch((e) =>
        showToast(`Suppression cloud impossible : ${describeError(e)} — gardé en local`)
      );
      if (cloudPaths.length > 0) deleteMediaPaths(cloudPaths).catch(() => {});
    }
    showToast(
      "Publication supprimée",
      {
        label: "Annuler",
        onClick: () => {
          clearTomb(id);
          setPosts((prev) => {
            const next = [...prev];
            next.splice(Math.min(index, next.length), 0, target);
            return next;
          });
          if (cloudLive && user) {
            pushPost(target, user.id).catch(() => {});
          }
        },
      },
      8000
    );
  }

  async function handleCopy(p: EditorialPost) {
    const text = p.platforms.length
      ? p.platforms.map((k) => p.variants[k]?.trim() || "").find((t) => t) || p.content
      : p.content;
    const ok = await copyText(text || p.content);
    if (ok) {
      setCopiedId(p.id);
      window.setTimeout(() => setCopiedId((c) => (c === p.id ? null : c)), 1500);
    }
  }

  function markPublished(p: EditorialPost) {
    const now = nowISO();
    handleSave({ ...p, status: "published", publishedAt: p.publishedAt ?? now, updatedAt: now });
    showToast("Publication marquée comme publiée");
  }

  function duplicatePost(p: EditorialPost) {
    const now = nowISO();
    const copy: EditorialPost = {
      ...p,
      id: uid(),
      title: `${p.title.replace(/ \(copie\)$/, "")} (copie)`,
      status: "draft",
      scheduledDate: undefined,
      scheduledTime: undefined,
      publishedAt: undefined,
      variants: { ...p.variants },
      createdAt: now,
      updatedAt: now,
    };
    handleSave(copy);
    openEdit(copy);
  }

  function addIdea() {
    const t = ideaTitle.trim();
    if (!t) return;
    const now = nowISO();
    handleSave({
      id: uid(),
      title: t,
      content: "",
      mediaType: "text",
      pillar: "build_in_public",
      status: "draft",
      platforms: [],
      variants: emptyVariants(),
      createdAt: now,
      updatedAt: now,
    });
    setIdeaTitle("");
  }

  function movePost(id: string, iso: string | undefined, silent = false) {
    const prev = posts.find((x) => x.id === id);
    if (!prev || prev.scheduledDate === (iso || undefined)) return;
    const updated = { ...prev, scheduledDate: iso || undefined, updatedAt: nowISO() };
    setPosts((pps) => pps.map((x) => (x.id === id ? updated : x)));
    if (cloudLive && user) {
      pushPost(updated, user.id).catch(() => {});
    }
    if (!silent) {
      const from = prev.scheduledDate;
      showToast(
        `Déplacée au ${iso ? formatShort(iso) : "sans date"}`,
        { label: "Annuler", onClick: () => movePost(id, from, true) },
        6000
      );
    }
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(posts, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cadence-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const arr = JSON.parse(String(r.result));
        if (!Array.isArray(arr)) throw new Error("bad format");
        const now = nowISO();
        const str = (v: unknown) => (typeof v === "string" ? v : undefined);
        const clean: EditorialPost[] = [];
        for (const raw of arr) {
          if (!raw || typeof raw !== "object") continue;
          const o = raw as Record<string, unknown>;
          if (typeof o.id !== "string" || typeof o.title !== "string") continue;
          const variants = { ...emptyVariants() };
          const vv = (o.variants && typeof o.variants === "object" ? o.variants : {}) as Record<string, unknown>;
          for (const k of Object.keys(variants) as PlatformKey[]) {
            if (typeof vv[k] === "string") variants[k] = vv[k] as string;
          }
          clean.push({
            id: o.id,
            title: o.title,
            content: str(o.content) ?? "",
            pillar: PILLARS.some((x) => x.value === o.pillar) ? (o.pillar as EditorialPillar) : "educational",
            status: STATUSES.some((x) => x.value === o.status) ? (o.status as EditorialStatus) : "draft",
            mediaType: normalizeMediaType(o.mediaType),
            scheduledDate: str(o.scheduledDate),
            scheduledTime: str(o.scheduledTime),
            platforms: Array.isArray(o.platforms)
              ? (o.platforms as unknown[]).filter((k): k is PlatformKey => PLATFORMS.some((x) => x.value === k))
              : [],
            variants,
            mediaUrl: str(o.mediaUrl),
            duration: str(o.duration),
            script: str(o.script),
            notes: str(o.notes),
            pinnedComment: str(o.pinnedComment) ?? str(o.publishedUrl),
            mediaItems: Array.isArray(o.mediaItems)
              ? (o.mediaItems as unknown[])
                  .filter(
                    (m): m is { id: string; kind: "image" | "video"; name: string } =>
                      !!m &&
                      typeof m === "object" &&
                      typeof (m as Record<string, unknown>).id === "string" &&
                      typeof (m as Record<string, unknown>).name === "string" &&
                      ((m as Record<string, unknown>).kind === "image" ||
                        (m as Record<string, unknown>).kind === "video")
                  )
                  .map((m) => ({ id: m.id, kind: m.kind, name: m.name }))
              : undefined,
            createdAt: str(o.createdAt) ?? now,
            updatedAt: str(o.updatedAt) ?? now,
            publishedAt: str(o.publishedAt),
          });
        }
        if (posts.length > 0 && !window.confirm(`Remplacer tes ${posts.length} publications par les ${clean.length} du fichier ?`)) return;
        const previous = posts;
        clearTombs();
        setPosts(clean);
        if (cloudLive && user) {
          pushAll(clean, user.id)
            .then(() => deleteCloudMissing(clean.map((p) => p.id)))
            .catch((e) => showToast(`Sync cloud impossible : ${describeError(e)} — gardé en local`));
        }
        showToast(
          `${clean.length} publication(s) importée(s)`,
          {
            label: "Annuler",
            onClick: () => {
              setPosts(previous);
              if (cloudLive && user) {
                pushAll(previous, user.id)
                  .then(() => deleteCloudMissing(previous.map((p) => p.id)))
                  .catch(() => {});
              }
            },
          },
          8000
        );
      } catch {
        alert("Fichier illisible.");
      }
    };
    r.readAsText(f);
    e.target.value = "";
  }

  const monthLabel = cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const todayLong = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-sm font-black text-white">C</div>
            <div>
              <p className="text-sm font-bold leading-tight">Cadence</p>
              <p className="hidden text-[11px] capitalize text-zinc-500 sm:block">{todayLong}</p>
            </div>
          </div>
          <nav className="flex items-center gap-1 rounded-full bg-zinc-100 p-1">
            <button onClick={() => setTab("dashboard")} aria-current={tab === "dashboard" ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${tab === "dashboard" ? "bg-white text-zinc-900 shadow" : "text-zinc-500"}`}>
              <LayoutDashboard size={14} /> <span className="hidden sm:inline">Tableau de bord</span>
            </button>
            <button onClick={() => setTab("calendar")} aria-current={tab === "calendar" ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${tab === "calendar" ? "bg-white text-zinc-900 shadow" : "text-zinc-500"}`}>
              <CalendarDays size={14} /> <span className="hidden sm:inline">Calendrier</span>
            </button>
            <button onClick={() => setTab("posts")} aria-current={tab === "posts" ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${tab === "posts" ? "bg-white text-zinc-900 shadow" : "text-zinc-500"}`}>
              <ListTodo size={14} /> <span className="hidden sm:inline">Publications</span>
            </button>
            <button onClick={() => setTab("drafts")} aria-current={tab === "drafts" ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${tab === "drafts" ? "bg-white text-zinc-900 shadow" : "text-zinc-500"}`}>
              <StickyNote size={14} /> <span className="hidden sm:inline">Brouillons</span>
              {drafts.length > 0 && (
                <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
                  {drafts.length}
                </span>
              )}
            </button>
          </nav>
          {isCloudConfigured() &&
            (user ? (
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setSyncOpen((v) => !v)}
                  title="État de la synchronisation"
                  className="inline-flex max-w-[170px] items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-2 text-[11px] text-zinc-600 transition-all duration-200 hover:border-zinc-400 active:scale-95"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${cloudLive ? "bg-emerald-500" : "bg-zinc-300"}`}
                  />
                  <Cloud size={13} className="shrink-0" />
                  <span className="truncate">{user.email}</span>
                </button>
                {syncOpen && (
                  <>
                    <button
                      aria-hidden
                      tabIndex={-1}
                      onClick={() => setSyncOpen(false)}
                      className="fixed inset-0 z-30 cursor-default"
                    />
                    <div className="absolute right-0 z-40 mt-1 w-72 animate-fade-in rounded-xl border border-zinc-200 bg-white p-3 shadow-lg">
                      <p className="truncate text-xs font-bold text-zinc-900">{user.email}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {cloudLive ? "Synchronisé avec le cloud" : "Hors ligne — données locales"}
                      </p>
                      {syncInfo && (
                        <p
                          className={`mt-2 break-words rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                            syncInfo.ok
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-red-50 text-red-700 ring-1 ring-red-200"
                          }`}
                        >
                          {syncInfo.message}
                        </p>
                      )}
                      <div className="mt-2 flex gap-1.5">
                        <button
                          onClick={runDiagnostic}
                          className="flex-1 rounded-lg bg-zinc-900 px-2 py-1.5 text-xs font-bold text-white transition-all duration-200 hover:bg-zinc-700 active:scale-95"
                        >
                          Tester maintenant
                        </button>
                        <button
                          onClick={reorganizeMedia}
                          title="Renomme les dossiers UUID en date_titre lisible"
                          className="flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs font-bold text-zinc-700 transition-all duration-200 hover:bg-zinc-50 active:scale-95"
                        >
                          Ranger mes fichiers
                        </button>
                      </div>
                      <div className="mt-1.5">
                        <button
                          onClick={() => {
                            setSyncOpen(false);
                            handleSignOut();
                          }}
                          title="Déconnexion du cloud (tes données locales sont gardées)"
                          className="inline-flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50"
                        >
                          <LogOut size={13} /> Sortir
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                title="Synchroniser avec le cloud"
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-600 transition-all duration-200 hover:border-zinc-400 active:scale-95"
              >
                <Cloud size={14} /> <span className="hidden sm:inline">Cloud</span>
              </button>
            ))}
          <button onClick={() => openCreate()} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition-all duration-200 hover:scale-[1.03] hover:bg-zinc-700 hover:shadow-lg active:scale-95">
            <Plus size={15} /> <span className="hidden sm:inline">Nouvelle publication</span><span className="sm:hidden">Nouveau</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6">
        <div key={tab} className="animate-fade-up">
        {!ready ? (
          <p className="py-20 text-center text-sm text-zinc-500">Chargement…</p>
        ) : tab === "dashboard" ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Mon espace éditorial</h1>
              <p className="text-sm text-zinc-500">Voici ce qui est prévu pour ton contenu.</p>
            </div>

            {!guideOff &&
              !(
                posts.length > 0 &&
                posts.some((p) => !!p.scheduledDate) &&
                posts.some((p) => p.status === "published")
              ) && (
                <GuideCard
                  step1={posts.length > 0}
                  step2={posts.some((p) => !!p.scheduledDate)}
                  step3={posts.some((p) => p.status === "published")}
                  onCreate={() => openCreate()}
                  onDismiss={dismissGuide}
                />
              )}

            {/* Aujourd'hui */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500">Aujourd&apos;hui — {formatDayLong(today)}</h2>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold">{todayPosts.length}</span>
              </div>
              {todayPosts.length === 0 ? (
                <div className="rounded-xl bg-zinc-50 px-4 py-8 text-center">
                  <p className="text-sm font-semibold">Rien de prévu aujourd&apos;hui.</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">Tu peux planifier une idée pour les prochains jours, sans pression.</p>
                  <div className="mt-4 flex justify-center gap-2">
                    <button onClick={() => openCreate(today)} className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-bold text-white">
                      <CalendarPlus size={14} /> Planifier une publication
                    </button>
                    <button onClick={() => setTab("calendar")} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold hover:bg-zinc-50">
                      Voir le calendrier
                    </button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {todayPosts.map((p, i) => (
                    <PostRow key={p.id} post={p} index={i} copied={copiedId === p.id} onCopy={() => handleCopy(p)} onEdit={() => openEdit(p)} onPublished={() => markPublished(p)} onDelete={() => handleDelete(p.id)} />
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2">
                <span className="text-xs text-zinc-500">Rappel à l&apos;ouverture quand un post est prévu :</span>
                {notifPerm === "unsupported" ? (
                  <span className="text-xs font-semibold text-zinc-500">Non pris en charge par ce navigateur.</span>
                ) : notifPerm === "denied" ? (
                  <span className="text-xs font-semibold text-zinc-500">Notifications bloquées dans le navigateur.</span>
                ) : notifPerm === "granted" ? (
                  <>
                    <button
                      onClick={() => setReminderOn((v) => !v)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold ${reminderOn ? "bg-emerald-600 text-white" : "bg-zinc-900 text-white"}`}
                    >
                      {reminderOn ? "Rappel activé — couper" : "Activer le rappel"}
                    </button>
                    <button
                      onClick={() => {
                        try {
                          new Notification("Cadence — test", { body: "Les rappels fonctionnent." });
                        } catch {
                          /* indisponible */
                        }
                      }}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-zinc-100"
                    >
                      Tester
                    </button>
                  </>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        const r = await Notification.requestPermission();
                        setNotifPerm(r);
                        if (r === "granted") setReminderOn(true);
                      } catch {
                        /* indisponible */
                      }
                    }}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Activer le rappel
                  </button>
                )}
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* À venir */}
              <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500">À venir</h2>
                  <button onClick={() => setTab("calendar")} className="text-xs font-semibold text-zinc-700 underline underline-offset-4">Voir tout</button>
                </div>
                {upcoming.length === 0 ? (
                  <p className="rounded-xl bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">Aucune publication à venir. Planifie la suite quand tu veux.</p>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {upcoming.map((p, i) => (
                      <PostRow key={p.id} post={p} showDate index={i} copied={copiedId === p.id} onCopy={() => handleCopy(p)} onEdit={() => openEdit(p)} onPublished={() => markPublished(p)} onDelete={() => handleDelete(p.id)} />
                    ))}
                  </div>
                )}
              </section>

              {/* Indicateurs */}
              <section className="space-y-3">
                <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
                  <StatCard label="Planifiées" value={counts.scheduled} tint="bg-amber-50 text-amber-700" />
                  <StatCard label="Brouillons" value={counts.drafts} tint="bg-zinc-100 text-zinc-700" />
                  <StatCard label="Publiées" value={counts.published} tint="bg-emerald-600 text-white" />
                </div>
                {counts.toPrepare > 0 && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {counts.toPrepare} publication{counts.toPrepare > 1 ? "s" : ""} à préparer avant mise en ligne.
                  </p>
                )}
              </section>
            </div>

            {/* Boîte à idées */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">Boîte à idées</h2>
              <p className="mb-3 text-xs text-zinc-500">Une idée en 5 secondes, sans ouvrir le formulaire. Tu la transformeras en post plus tard.</p>
              <div className="flex gap-2">
                <input
                  value={ideaTitle}
                  onChange={(e) => setIdeaTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addIdea();
                  }}
                  placeholder={IDEA_PLACEHOLDERS[ideaPh]}
                  aria-label="Ajouter une idée express"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-900 [@media(pointer:coarse)]:text-base"
                />
                <button onClick={addIdea} disabled={!ideaTitle.trim()} className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition-all duration-200 hover:bg-zinc-700 active:scale-95 disabled:opacity-40">
                  <Plus size={14} /> Ajouter
                </button>
              </div>
              {ideas.length > 0 && (
                <div className="mt-3 space-y-2">
                  {ideas.map((p, i) => (
                    <div key={p.id} style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }} className="flex animate-fade-up items-center gap-2 rounded-xl px-2 py-2.5 transition-all duration-200 hover:bg-zinc-50">
                      <div className="min-w-0 flex-1">
                        <button onClick={() => openEdit(p)} className="block w-full truncate text-left text-sm font-bold hover:underline">
                          {p.title}
                        </button>
                        <div className="mt-0.5 flex gap-1.5">
                          <Pillar pillar={p.pillar} />
                          <Badge post={p} />
                        </div>
                      </div>
                      <button onClick={() => openEdit(p)} className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold ring-1 ring-zinc-200 hover:bg-zinc-900 hover:text-white">
                        Transformer en post
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Mon rythme */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">Mon rythme — publiés / semaine</h2>
              <p className="mb-3 text-xs text-zinc-500">
                Cette semaine : <b className="text-zinc-800">{thisWeekCount}</b> · Série :{" "}
                <b className="text-zinc-800">{streak} sem.</b> consécutive(s) avec au moins 1 publié.
              </p>
              {streak >= 3 && (
                <p className="-mt-1 mb-3 text-xs font-semibold text-emerald-700">
                  Belle régularité — continue comme ça.
                </p>
              )}
              {weekly.counts.every((c) => c === 0) ? (
                <p className="rounded-xl bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
                  Marque ton premier post comme « Publiée » et le graphique se remplira ici.
                </p>
              ) : (
                <WeekChart weeks={weekly.weeks} counts={weekly.counts} />
              )}
            </section>

            {/* Aperçu 14 jours */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-zinc-500">Prochains jours</h2>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                {next14.map((d) => (
                  <button key={d.iso} onClick={() => { setCursor(parseISODate(d.iso)); setTab("calendar"); }} aria-label={`Voir le ${formatShort(d.iso)} dans le calendrier`} className={`flex flex-col items-center rounded-lg border px-1 py-2 text-center transition-all duration-200 hover:border-zinc-900 active:scale-95 ${d.isToday ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-100 bg-zinc-50"}`}>
                    <span className={`text-[10px] font-bold uppercase ${d.isToday ? "text-zinc-300" : "text-zinc-500"}`}>
                      {parseISODate(d.iso).toLocaleDateString("fr-FR", { weekday: "short" })}
                    </span>
                    <span className="text-sm font-black">{parseISODate(d.iso).getDate()}</span>
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full ${d.count > 0 ? "bg-emerald-500" : "bg-transparent"}`} />
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : tab === "calendar" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black capitalize tracking-tight">{view === "month" ? monthLabel : "Cette semaine"}</h1>
                <p className="text-sm text-zinc-500">Clique un jour pour créer, clique un post pour modifier.<span className="hidden [@media(hover:hover)]:inline"> Glisser-déposer pour déplacer.</span></p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-full bg-white p-1 ring-1 ring-zinc-200">
                  <button onClick={() => setView("month")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${view === "month" ? "bg-zinc-900 text-white" : "text-zinc-500"}`}>Mois</button>
                  <button onClick={() => setView("week")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${view === "week" ? "bg-zinc-900 text-white" : "text-zinc-500"}`}>Semaine</button>
                </div>
                <button onClick={() => setCursor(new Date())} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold hover:bg-zinc-50">Aujourd&apos;hui</button>
                <button onClick={() => setCursor((c) => view === "month" ? new Date(c.getFullYear(), c.getMonth() - 1, 1) : new Date(c.getFullYear(), c.getMonth(), c.getDate() - 7))} className="rounded-full border border-zinc-200 bg-white p-2 hover:bg-zinc-50" aria-label="Précédent">
                  <ChevronLeft size={15} />
                </button>
                <button onClick={() => setCursor((c) => view === "month" ? new Date(c.getFullYear(), c.getMonth() + 1, 1) : new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7))} className="rounded-full border border-zinc-200 bg-white p-2 hover:bg-zinc-50" aria-label="Suivant">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {view === "month" ? (
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50 text-center">
                  {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                    <div key={d} className="px-1 py-2 text-[11px] font-bold uppercase text-zinc-500">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthCells.map((c) => {
                    const list = postsOn(c.iso);
                    const isToday = c.iso === today;
                    return (
                      <div
                        key={c.iso}
                        onClick={() => openCreate(c.iso)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Créer une publication le ${formatShort(c.iso)}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openCreate(c.iso);
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = e.dataTransfer.getData("text/plain");
                          if (id) movePost(id, c.iso);
                        }}
                        className={`min-h-[86px] cursor-pointer border-b border-r border-zinc-100 p-1.5 align-top transition hover:bg-zinc-50 sm:min-h-[110px] ${c.inMonth ? "" : "bg-zinc-50/60"}`}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isToday ? "bg-zinc-900 text-white" : c.inMonth ? "text-zinc-700" : "text-zinc-300"}`}>
                            {c.date.getDate()}
                          </span>
                          {list.length > 0 && <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">{list.length}</span>}
                        </div>
                        <div className="space-y-1">
                          {list.slice(0, 2).map((p) => (
                            <button
                              key={p.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", p.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                              title="Glisser pour déplacer • Cliquer pour modifier"
                              className="block w-full cursor-grab truncate rounded-md bg-zinc-900/[0.04] px-1.5 py-1 text-left text-[11px] font-semibold text-zinc-800 ring-1 ring-zinc-200 transition-all duration-200 hover:bg-zinc-900 hover:text-white active:cursor-grabbing"
                            >
                              <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${statusDot[p.status]}`} />
                              {p.title}
                            </button>
                          ))}
                          {list.length > 2 && <p className="px-1 text-[10px] font-bold text-zinc-500">+{list.length - 2} autres</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-7">
                {weekDays.map((d) => {
                  const list = postsOn(d.iso);
                  const isToday = d.iso === today;
                  return (
                    <div key={d.iso} className={`rounded-2xl border bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isToday ? "border-zinc-900 ring-2 ring-zinc-900/10" : "border-zinc-200"}`}>
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold uppercase text-zinc-500">{d.date.toLocaleDateString("fr-FR", { weekday: "short" })}</p>
                          <p className="text-lg font-black">{d.date.getDate()}</p>
                        </div>
                        <button onClick={() => openCreate(d.iso)} className="rounded-full bg-zinc-100 p-2 transition-all duration-200 hover:bg-zinc-900 hover:text-white active:scale-90" aria-label="Ajouter ce jour">
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {list.length === 0 && <p className="text-[11px] text-zinc-300">— Libre —</p>}
                        {list.map((p) => (
                          <button key={p.id} onClick={() => openEdit(p)} className="block w-full rounded-lg bg-zinc-50 p-2 text-left ring-1 ring-zinc-200 hover:bg-zinc-900 hover:text-white">
                            <p className="truncate text-xs font-bold"><span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${statusDot[p.status]}`} />{p.title}</p>
                            <p className="mt-0.5 text-[10px] opacity-70">{pillarLabel(p.pillar)}{(p.mediaType ?? "text") !== "text" ? ` • ${mediaLabel(p.mediaType ?? "text")}` : ""}{p.scheduledTime ? ` • ${p.scheduledTime}` : ""}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
              {[
                { c: "bg-red-500", t: "Brouillon / à finir" },
                { c: "bg-green-500", t: "Planifié" },
                { c: "bg-zinc-400", t: "Publié" },
              ].map((l) => (
                <span key={l.t} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
                  <span className={`h-2 w-2 rounded-full ${l.c}`} />
                  {l.t}
                </span>
              ))}
            </div>
          </div>
        ) : tab === "drafts" ? (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Brouillons</h1>
              <p className="text-sm text-zinc-500">
                {drafts.length} publication{drafts.length > 1 ? "s" : ""} à finir — ni planifiée{drafts.length > 1 ? "s" : ""}, ni publiée{drafts.length > 1 ? "s" : ""}.
              </p>
            </div>
            {drafts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-14 text-center">
                <p className="text-sm font-bold">Aucun brouillon.</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">
                  Tout est planifié ou publié. Crée une idée ou une publication pour recommencer.
                </p>
                <button onClick={() => openCreate()} className="mx-auto mt-4 inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white">
                  <Plus size={14} /> Nouvelle publication
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm sm:p-3">
                <div className="divide-y divide-zinc-100">
                  {drafts.map((p, i) => (
                    <PostRow key={p.id} post={p} showDate detailed index={i} copied={copiedId === p.id} onCopy={() => handleCopy(p)} onEdit={() => openEdit(p)} onPublished={() => markPublished(p)} onDuplicate={() => duplicatePost(p)} onDelete={() => handleDelete(p.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black tracking-tight">Publications</h1>
                <p className="text-sm text-zinc-500">{posts.length} au total — recherche, filtres et tri par date.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={exportJSON} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-zinc-50">
                  <Download size={13} /> Export
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-zinc-50">
                  <Upload size={13} /> Import
                  <input type="file" accept="application/json" className="hidden" onChange={importJSON} />
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:flex-row">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher titre ou texte…" aria-label="Rechercher dans les publications" className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-zinc-900 [@media(pointer:coarse)]:text-base" />
              </div>
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filtrer par statut" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                <option value="all">Tous statuts</option>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select value={fPillar} onChange={(e) => setFPillar(e.target.value)} aria-label="Filtrer par pilier" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                <option value="all">Tous piliers</option>
                {PILLARS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <select value={fPlatform} onChange={(e) => setFPlatform(e.target.value)} aria-label="Filtrer par réseau" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                <option value="all">Tous réseaux</option>
                {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <select value={fMedia} onChange={(e) => setFMedia(e.target.value)} aria-label="Filtrer par format" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                <option value="all">Tous formats</option>
                {MEDIA_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-14 text-center">
                <p className="text-sm font-bold">{posts.length === 0 ? "Aucune publication pour l'instant." : "Aucun résultat."}</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">
                  {posts.length === 0 ? "Crée ta première publication en collant un texte depuis ChatGPT." : "Essaie un autre mot-clé ou réinitialise les filtres."}
                </p>
                {posts.length > 0 && filtered.length === 0 && (
                  <button
                    onClick={() => { setQ(""); setFStatus("all"); setFPillar("all"); setFPlatform("all"); setFMedia("all"); }}
                    className="mx-auto mt-3 block rounded-lg border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-700 transition-all duration-200 hover:bg-zinc-50 active:scale-95"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
                <button onClick={() => openCreate()} className="mx-auto mt-4 inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white">
                  <Plus size={14} /> Nouvelle publication
                </button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {filtered.map((p, i) => (
                  <PostRow key={p.id} post={p} showDate detailed index={i} copied={copiedId === p.id} onCopy={() => handleCopy(p)} onEdit={() => openEdit(p)} onPublished={() => markPublished(p)} onDuplicate={() => duplicatePost(p)} onDelete={() => handleDelete(p.id)} />
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </main>

      <PostModal
        open={modalOpen}
        editing={editing}
        initial={prefill}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={handleDelete}
      />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      {toast && (
        <div className="fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
          <div
            role="status"
            className="flex animate-fade-up items-center gap-2 rounded-full bg-zinc-900 py-2.5 pl-3.5 pr-2.5 text-sm font-semibold text-white shadow-xl"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
              <Check size={12} />
            </span>
            {toast.msg}
            {toast.action && (
              <button
                onClick={() => {
                  toastAction.current?.();
                  if (toastTimer.current) window.clearTimeout(toastTimer.current);
                  setToast(null);
                  toastAction.current = null;
                }}
                className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold transition-colors hover:bg-white/25"
              >
                {toast.action}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Compte animé (ease-out), désactivé si reduced-motion
function useCountUp(target: number): number {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    if (from === target) {
      setVal(target);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(target);
      prev.current = target;
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 600;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setVal(Math.round(from + (target - from) * e));
      if (k < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prev.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val;
}

function GuideCard({
  step1,
  step2,
  step3,
  onCreate,
  onDismiss,
}: {
  step1: boolean;
  step2: boolean;
  step3: boolean;
  onCreate: () => void;
  onDismiss: () => void;
}) {
  const done = [step1, step2, step3].filter(Boolean).length;
  const steps = [
    { ok: step1, label: "Colle ton premier texte (depuis ChatGPT)" },
    { ok: step2, label: "Donne-lui une date pour le voir dans le calendrier" },
    { ok: step3, label: "Le jour J : copie, publie, puis ⋯ → Oui, c'est publié" },
  ];
  return (
    <section className="rounded-2xl border border-zinc-900/15 bg-zinc-900 p-5 text-white shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-300">
          Tes 3 premiers pas — {done}/3
        </h2>
        <button
          onClick={onDismiss}
          className="rounded-md px-2 py-1 text-xs font-semibold text-zinc-400 transition-colors hover:text-white"
        >
          Passer
        </button>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                s.ok ? "bg-emerald-500 text-white" : "bg-white/15 text-zinc-300"
              }`}
            >
              {s.ok ? <Check size={12} /> : i + 1}
            </span>
            <span className={`text-sm ${s.ok ? "text-zinc-400 line-through" : "text-zinc-100"}`}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>
      {!step1 && (
        <button
          onClick={onCreate}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-zinc-900 transition-all duration-200 hover:scale-[1.03] active:scale-95"
        >
          <Plus size={14} /> Créer ma première publication
        </button>
      )}
    </section>
  );
}

function StatCard({ label, value, tint }: { label: string; value: number; tint: string }) {
  const animated = useCountUp(value);
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={`rounded-lg px-2.5 py-1 text-xl font-black tabular-nums ${tint}`}>{animated}</span>
      </div>
    </div>
  );
}

function WeekChart({ weeks, counts }: { weeks: string[]; counts: number[] }) {
  const W = 340;
  const H = 150;
  const padB = 26;
  const padT = 18;
  const n = weeks.length;
  const max = Math.max(1, ...counts);
  const slot = W / n;
  const barW = Math.min(30, slot - 12);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Publications par semaine : ${counts.join(", ")}`}>
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = padT + (1 - f) * (H - padT - padB);
        return <line key={f} x1={0} x2={W} y1={y} y2={y} stroke="#e4e4e7" strokeDasharray="3 3" />;
      })}
      {weeks.map((w, i) => {
        const h = ((counts[i] ?? 0) / max) * (H - padT - padB);
        const x = i * slot + (slot - barW) / 2;
        const y = H - padB - h;
        const current = i === n - 1;
        return (
          <g key={w}>
            <rect x={x} y={y} width={barW} height={Math.max(h, 2)} rx={5} fill={current ? "#059669" : "#18181b"} opacity={(counts[i] ?? 0) === 0 ? 0.15 : 1} className="animate-bar" style={{ animationDelay: `${i * 60}ms` }} />
            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={11} fontWeight={800} fill="#52525b">
              {counts[i]}
            </text>
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#71717a">
              {weekLabelShort(w)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Menu ⋯ : toutes les actions d'une publication, dont la confirmation
// de publication ("Oui, c'est publié" -> badge vert).
function RowMenu({
  post,
  onCopy,
  onEdit,
  onDuplicate,
  onPublished,
  onDelete,
}: {
  post: EditorialPost;
  onCopy: () => void;
  onEdit: () => void;
  onDuplicate?: () => void;
  onPublished: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmPub, setConfirmPub] = useState(false);

  function close() {
    setOpen(false);
    setConfirmPub(false);
  }

  const itemCls =
    "flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50";
  const published = post.status === "published";

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          setConfirmPub(false);
        }}
        aria-label="Actions de la publication"
        title="Clique ici"
        className="rounded-lg border border-zinc-200 bg-white p-2.5 text-zinc-600 transition-all duration-200 hover:bg-zinc-100 active:scale-90"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} onClick={close} className="fixed inset-0 z-30 cursor-default" />
          <div className="absolute right-0 z-40 mt-1 w-56 animate-fade-in overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
            <button
              onClick={() => {
                onCopy();
                close();
              }}
              className={itemCls}
            >
              <Copy size={13} /> Copier le texte
            </button>
            <button
              onClick={() => {
                onEdit();
                close();
              }}
              className={itemCls}
            >
              <Pencil size={13} /> Modifier
            </button>
            {onDuplicate && (
              <button
                onClick={() => {
                  onDuplicate();
                  close();
                }}
                className={itemCls}
              >
                <Duplicate size={13} /> Dupliquer
              </button>
            )}
            {!published &&
              (confirmPub ? (
                <div className="px-2 py-1">
                  <p className="px-1 py-1 text-[11px] font-semibold text-zinc-500">
                    Déjà publié sur le réseau ?
                  </p>
                  <div className="flex gap-1.5 px-1 pb-1">
                    <button
                      onClick={() => {
                        onPublished();
                        close();
                      }}
                      className="flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-xs font-bold text-white transition-all duration-200 hover:bg-emerald-500 active:scale-95"
                    >
                      Oui, c&apos;est publié
                    </button>
                    <button
                      onClick={() => setConfirmPub(false)}
                      className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold hover:bg-zinc-50"
                    >
                      Non
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmPub(true)} className={`${itemCls} text-emerald-700`}>
                  <Check size={13} /> Marquer comme publiée
                </button>
              ))}
            <div className="my-1 border-t border-zinc-100" />
            <button
              onClick={() => {
                onDelete();
                close();
              }}
              className={`${itemCls} text-red-600`}
            >
              <Trash2 size={13} /> Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PostRow({ post, showDate, detailed, copied, onCopy, onEdit, onPublished, onDuplicate, onDelete, index = 0 }: {
  post: EditorialPost;
  showDate?: boolean;
  detailed?: boolean;
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onPublished: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  index?: number;
}) {
  const overdue = post.scheduledDate && post.scheduledDate < todayISO() && post.status !== "published";
  const mediaCount =
    (post.mediaItems?.length ?? 0) + (!post.mediaItems?.length && (post.mediaUrl || post.mediaPreview) ? 1 : 0);
  const showMediaChip = (post.mediaType ?? "text") !== "text" || mediaCount > 0;
  const canCopy = [post.content, post.script ?? "", ...Object.values(post.variants)].some(
    (t) => t.trim() !== ""
  );
  return (
    <div
      style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
      className="flex animate-fade-up flex-col gap-2 rounded-xl px-3 py-3 transition-all duration-200 hover:bg-zinc-50 sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {showMediaChip && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200">
              <Film size={11} />
              {mediaLabel(post.mediaType ?? "text")}
              {post.duration ? ` • ${post.duration}` : ""}
              {mediaCount > 1 ? ` • ${mediaCount}` : ""}
            </span>
          )}
          {showDate && (
            <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-bold text-zinc-700 ring-1 ring-zinc-200">
              {formatShort(post.scheduledDate)}{post.scheduledTime ? ` • ${post.scheduledTime}` : ""}
            </span>
          )}
          <Pillar pillar={post.pillar} />
          <Badge post={post} />
          {overdue && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600 ring-1 ring-red-200">En retard</span>}
        </div>
        <button onClick={onEdit} className="mt-1 block w-full truncate text-left text-sm font-bold hover:underline">
          {post.title}
        </button>
        {detailed && post.content.trim() !== "" && (
          <p className="mt-0.5 max-w-[75ch] whitespace-pre-line break-words text-xs leading-relaxed text-zinc-500 line-clamp-2">{post.content}</p>
        )}
        {post.platforms.length > 0 && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
            {post.platforms.map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <PlatformIcon platform={k} size={12} mono />
                {k !== "x" && platformLabel(k)}
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {!copied ? (
          <button onClick={onCopy} disabled={!canCopy} title="Copier le texte" className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 hover:bg-zinc-900 hover:text-white active:scale-95 disabled:opacity-40">
            <Copy size={13} /> Copier
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
            <Check size={13} /> Copié
          </span>
        )}
        <RowMenu
          post={post}
          onCopy={onCopy}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onPublished={onPublished}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
