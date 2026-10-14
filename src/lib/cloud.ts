// Couche cloud Supabase (phase 1 : données des publications).
// Sans session : l'app reste 100 % locale comme avant.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { EditorialPost } from "@/lib/editorial";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isCloudConfigured(): boolean {
  return URL !== "" && ANON !== "";
}

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!isCloudConfigured()) return null;
  if (!client) {
    client = createClient(URL, ANON);
  }
  return client;
}

type PostRow = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  pillar: string;
  status: string;
  media_type: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  platforms: unknown;
  variants: unknown;
  media_url: string | null;
  media_items: unknown;
  duration: string | null;
  script: string | null;
  notes: string | null;
  pinned_comment: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

// Conversion camelCase (app) -> snake_case (Postgres), explicite champ par champ
function toRow(p: EditorialPost, userId: string): PostRow {
  return {
    id: p.id,
    user_id: userId,
    title: p.title,
    content: p.content,
    pillar: p.pillar,
    status: p.status,
    media_type: p.mediaType,
    scheduled_date: p.scheduledDate ?? null,
    scheduled_time: p.scheduledTime ?? null,
    platforms: p.platforms ?? [],
    variants: p.variants ?? {},
    media_url: p.mediaUrl ?? null,
    media_items: p.mediaItems ?? [],
    duration: p.duration ?? null,
    script: p.script ?? null,
    notes: p.notes ?? null,
    pinned_comment: p.pinnedComment ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    published_at: p.publishedAt ?? null,
  };
}

function fromRow(r: Record<string, unknown>): EditorialPost | null {
  if (!r || typeof r !== "object" || typeof r.id !== "string") return null;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const arr = Array.isArray(r.platforms) ? r.platforms : [];
  const variants =
    r.variants && typeof r.variants === "object" ? (r.variants as Record<string, string>) : {};
  type SavedItem = NonNullable<EditorialPost["mediaItems"]>[number];
  const mediaItems = Array.isArray(r.media_items)
    ? (r.media_items as unknown[])
        .filter(
          (m): m is SavedItem =>
            !!m &&
            typeof m === "object" &&
            typeof (m as Record<string, unknown>).id === "string" &&
            typeof (m as Record<string, unknown>).name === "string" &&
            ((m as Record<string, unknown>).kind === "image" ||
              (m as Record<string, unknown>).kind === "video")
        )
        .map((m) => ({
          ...m,
          path: typeof (m as Record<string, unknown>).path === "string" ? (m.path as string) : undefined,
        }))
    : undefined;
  return {
    id: r.id,
    title: typeof r.title === "string" ? r.title : "",
    content: str(r.content) ?? "",
    pillar: (r.pillar as EditorialPost["pillar"]) ?? "educational",
    status: (r.status as EditorialPost["status"]) ?? "draft",
    mediaType: (r.media_type as EditorialPost["mediaType"]) ?? "text",
    scheduledDate: str(r.scheduled_date),
    scheduledTime: str(r.scheduled_time),
    platforms: arr as EditorialPost["platforms"],
    variants: { linkedin: "", facebook: "", instagram: "", x: "", ...variants },
    mediaUrl: str(r.media_url),
    duration: str(r.duration),
    script: str(r.script),
    notes: str(r.notes),
    pinnedComment: str(r.pinned_comment),
    mediaItems: mediaItems as EditorialPost["mediaItems"],
    createdAt: str(r.created_at) ?? new Date().toISOString(),
    updatedAt: str(r.updated_at) ?? new Date().toISOString(),
    publishedAt: str(r.published_at),
  };
}

export async function fetchCloudPosts(): Promise<EditorialPost[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("posts")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const out: EditorialPost[] = [];
  for (const r of data ?? []) {
    const p = fromRow(r as Record<string, unknown>);
    if (p) out.push(p);
  }
  return out;
}

export async function pushPost(p: EditorialPost, userId: string): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb.from("posts").upsert(toRow(p, userId), { onConflict: "id" });
  if (error) throw error;
}

export async function pushAll(posts: EditorialPost[], userId: string): Promise<void> {
  const sb = supabase();
  if (!sb || posts.length === 0) return;
  const { error } = await sb
    .from("posts")
    .upsert(
      posts.map((p) => toRow(p, userId)),
      { onConflict: "id" }
    );
  if (error) throw error;
}

export async function deleteCloudPost(id: string): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb.from("posts").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteCloudMissing(idsKept: string[]): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  if (idsKept.length === 0) {
    const { error } = await sb.from("posts").delete().neq("id", "__none__");
    if (error) throw error;
    return;
  }
  const { data, error } = await sb.from("posts").select("id");
  if (error) throw error;
  const keep = new Set(idsKept);
  const gone = ((data ?? []) as { id: string }[]).map((r) => r.id).filter((id) => !keep.has(id));
  if (gone.length > 0) {
    const { error: delErr } = await sb.from("posts").delete().in("id", gone);
    if (delErr) throw delErr;
  }
}

// --- Tombstones : suppressions locales à ne pas ressusciter au merge ---
const TOMB_KEY = "content-planner-tombstones-v1";

export function loadTombs(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TOMB_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeTombs(t: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOMB_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}

export function addTomb(id: string) {
  const t = loadTombs();
  t[id] = new Date().toISOString();
  writeTombs(t);
}

export function clearTomb(id: string) {
  const t = loadTombs();
  if (id in t) {
    delete t[id];
    writeTombs(t);
  }
}

export function clearTombs() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOMB_KEY);
  } catch {
    /* ignore */
  }
}

// Fusion local + cloud : le plus récent (updatedAt) gagne par id,
// sans ressusciter ce qui a été supprimé en local après.
export function mergePosts(
  local: EditorialPost[],
  cloud: EditorialPost[],
  tombs: Record<string, string>
): EditorialPost[] {
  const map = new Map(local.map((p) => [p.id, p]));
  for (const c of cloud) {
    const tombAt = tombs[c.id];
    if (tombAt && tombAt >= (c.updatedAt ?? "")) continue;
    const l = map.get(c.id);
    if (!l || (c.updatedAt ?? "") >= (l.updatedAt ?? "")) map.set(c.id, c);
  }
  return [...map.values()];
}
export async function getSessionUser(): Promise<User | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export async function signInWithEmail(email: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Cloud non configuré");
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  const sb = supabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

// Les erreurs Supabase/PostgREST sont souvent de simples objets
// ({ message, code, hint }) et pas des instances d'Error : on extrait
// un texte lisible dans tous les cas.
export function describeError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const parts = [o.message, o.code, o.hint, o.details].filter(
      (v): v is string => typeof v === "string" && v.length > 0
    );
    if (parts.length > 0) return parts.join(" | ");
    try {
      const raw = JSON.stringify(e);
      if (raw && raw !== "{}") return raw;
    } catch {
      /* ignore */
    }
  }
  if (typeof e === "string" && e.length > 0) return e;
  return "erreur inconnue (aucun détail renvoyé)";
}
export async function testCloud(userId: string): Promise<{ ok: boolean; message: string }> {
  const sb = supabase();
  if (!sb) return { ok: false, message: "Non configuré (fichier .env manquant)" };
  let me: { id: string; email?: string } | null = null;
  try {
    const { data, error } = await sb.auth.getUser();
    if (error) return { ok: false, message: `Session invalide : ${error.message}` };
    me = data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null;
  } catch {
    return { ok: false, message: "Session illisible (reconnecte-toi)" };
  }
  if (!me) return { ok: false, message: "Pas de session valide (reconnecte-toi)" };
  if (me.id !== userId) {
    return { ok: false, message: "Session d'un autre compte — déconnecte puis reconnecte-toi" };
  }
  const base = `Connecté : ${me.email ?? me.id}`;
  const sel = await sb.from("posts").select("id").limit(1);
  if (sel.error) {
    return { ok: false, message: `${base} | LECTURE REFUSÉE : ${sel.error.message} (${sel.error.code})` };
  }
  const ins = await sb.from("posts").upsert(
    {
      id: "__cadence_ping__",
      user_id: me.id,
      title: "ping",
      content: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (ins.error) {
    return { ok: false, message: `${base} | Lecture OK | ÉCRITURE REFUSÉE : ${ins.error.message} (${ins.error.code})` };
  }
  await sb.from("posts").delete().eq("id", "__cadence_ping__");
  return { ok: true, message: `${base} | Lecture OK | Écriture OK` };
}

// --- Bucket media (phase 2) : fichiers en qualité d'origine ---
// Dossiers lisibles : `${userId}/${AAAA-MM-JJ}_${titre-slug}` (le 1er
// segment reste l'user_id, exigé par les policies RLS).
export function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return s || "sans-titre";
}

export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "fichier";
}

export function mediaFolder(userId: string, title: string, scheduledDate?: string): string {
  const date = scheduledDate || new Date().toISOString().slice(0, 10);
  return `${userId}/${date}_${slugify(title)}`;
}

export async function uploadMediaBlob(
  userId: string,
  folder: string,
  mediaId: string,
  name: string,
  blob: Blob
): Promise<string> {
  const sb = supabase();
  if (!sb) throw new Error("Cloud non configuré");
  const path = `${folder}/${mediaId}-${safeFileName(name)}`;
  const { error } = await sb.storage
    .from("media")
    .upload(path, blob, { upsert: true, contentType: blob.type || undefined });
  if (error) throw error;
  return path;
}

export async function signedMediaUrl(path: string, expiresIn = 604800): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.storage.from("media").createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export async function deleteMediaPaths(paths: string[]): Promise<void> {
  const sb = supabase();
  if (!sb || paths.length === 0) return;
  try {
    await sb.storage.from("media").remove(paths);
  } catch {
    /* ignore */
  }
}

// Liste tous les fichiers du bucket de l'utilisateur (2 niveaux).
export async function listUserFiles(userId: string): Promise<string[]> {
  const sb = supabase();
  if (!sb) return [];
  const out: string[] = [];
  const { data: folders } = await sb.storage.from("media").list(userId, { limit: 1000 });
  for (const f of folders ?? []) {
    if (!f.name || f.name.startsWith(".")) continue;
    const { data: files } = await sb.storage
      .from("media")
      .list(`${userId}/${f.name}`, { limit: 1000 });
    for (const fl of files ?? []) {
      if (!fl.name || fl.name.startsWith(".") || !fl.id) continue;
      out.push(`${userId}/${f.name}/${fl.name}`);
    }
  }
  return out;
}

export async function moveMedia(oldPath: string, newPath: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Cloud non configuré");
  const { error } = await sb.storage.from("media").move(oldPath, newPath);
  if (error) throw error;
}
