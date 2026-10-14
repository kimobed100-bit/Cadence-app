"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Copy,
  Check,
  Trash2,
  X,
  Megaphone,
  Link2,
  StickyNote,
  Film,
  MessageCircle,
} from "@/components/icons";
import NetworkPreview from "@/components/NetworkPreview";
import PlatformIcon from "@/components/PlatformIcon";
import {
  EditorialPost,
  EditorialPillar,
  EditorialStatus,
  MediaType,
  PlatformKey,
  PILLARS,
  STATUSES,
  PLATFORMS,
  PLATFORM_LIMITS,
  PILLAR_TEMPLATES,
  smartTruncate,
  buildVariant,
  suggestHashtags,
  appendHashtags,
  loadHashtags,
  saveHashtags,
  type HashtagSets,
  copyText,
  emptyVariants,
  formatShort,
  platformLabel,
  nowISO,
  uid,
} from "@/lib/editorial";
import { getBlob, saveBlob } from "@/lib/media-db";
import { getSessionUser, uploadMediaBlob, signedMediaUrl, describeError, mediaFolder } from "@/lib/cloud";

export type PostFormInitial = Partial<EditorialPost> & { scheduledDate?: string };

type Props = {
  open: boolean;
  initial?: PostFormInitial | null; // null = création
  editing?: EditorialPost | null;
  onClose: () => void;
  onSave: (post: EditorialPost, cloudNote?: string) => void;
  onDelete?: (id: string) => void;
};

const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 [@media(pointer:coarse)]:text-base";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500";

export type MediaState = {
  id: string;
  kind: "image" | "video";
  name: string;
  url: string | null; // URL objet (session), dataURL (migration) ou URL signée (cloud)
  path?: string; // chemin dans le bucket cloud, si déjà envoyé
};

const MAX_MEDIA = 10;

export default function PostModal({ open, initial, editing, onClose, onSave, onDelete }: Props) {
  const titleRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [media, setMedia] = useState<MediaState[]>([]);
  const [duration, setDuration] = useState("");
  const [script, setScript] = useState("");
  const [pillar, setPillar] = useState<EditorialPillar>("educational");
  const [status, setStatus] = useState<EditorialStatus>("scheduled");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [platforms, setPlatforms] = useState<PlatformKey[]>(() => PLATFORMS.map((p) => p.value));
  const [variants, setVariants] = useState<Record<PlatformKey, string>>(emptyVariants());
  const [activeVariant, setActiveVariant] = useState<PlatformKey>("linkedin");
  const [tags, setTags] = useState<HashtagSets>(() => loadHashtags());
  const [notes, setNotes] = useState("");
  const [pinnedComment, setPinnedComment] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  // Fermeture avec sortie animée (immédiate si reduced-motion)
  function requestClose() {
    if (closing) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      onClose();
      return;
    }
    setClosing(true);
    window.setTimeout(() => onClose(), 160);
  }

  useEffect(() => {
    if (!open) return;
    const src = editing ?? initial ?? null;
    setTitle(src?.title ?? "");
    setContent(src?.content ?? "");
    setMediaUrl(src?.mediaUrl ?? "");
    setDuration(src?.duration ?? "");
    setScript(src?.script ?? "");
    setPillar(src?.pillar ?? "educational");
    setStatus(src?.status ?? "scheduled");
    setScheduledDate(src?.scheduledDate ?? "");
    setScheduledTime(src?.scheduledTime ?? "");
    setPlatforms(src?.platforms?.length ? src.platforms : PLATFORMS.map((p) => p.value));
    setVariants({ ...emptyVariants(), ...(src?.variants ?? {}) });
    setActiveVariant("linkedin");
    setTags(loadHashtags());
    setNotes(src?.notes ?? "");
    setPinnedComment(src?.pinnedComment ?? "");
    setError("");
    setCopied(null);
    setSaving(false);
    setClosing(false);
    // Focus initial uniquement à l'ouverture (jamais repris ensuite)
    titleRef.current?.focus();
  }, [open, editing, initial]);

  // URLs objet créées pendant la session (à révoquer à la fermeture)
  const trackedUrls = useRef<string[]>([]);
  function trackUrl(url: string): string {
    if (url.startsWith("blob:")) trackedUrls.current.push(url);
    return url;
  }
  function revokeUrl(url: string | null) {
    if (url && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
      trackedUrls.current = trackedUrls.current.filter((u) => u !== url);
    }
  }

  // Charge les médias : blobs IndexedDB, sinon migration de l'ancien format
  useEffect(() => {
    if (!open) {
      // fermeture : libère les URLs de session restantes
      trackedUrls.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
      trackedUrls.current = [];
      return;
    }
    const src = editing ?? initial ?? null;
    let cancelled = false;
    const localUrls: string[] = [];
    (async () => {
      const items: MediaState[] = [];
      if (src?.mediaItems?.length) {
        for (const m of src.mediaItems) {
          // 1) copie locale (rapide, hors ligne OK)
          const blob = await getBlob(m.id).catch(() => null);
          if (cancelled) return;
          if (blob) {
            const url = URL.createObjectURL(blob);
            localUrls.push(url);
            items.push({ id: m.id, kind: m.kind, name: m.name, path: m.path, url });
            continue;
          }
          // 2) sinon URL signée depuis le cloud (si connecté)
          if (m.path) {
            const su = await getSessionUser().catch(() => null);
            if (cancelled) return;
            const url = su ? await signedMediaUrl(m.path).catch(() => null) : null;
            if (!cancelled) items.push({ id: m.id, kind: m.kind, name: m.name, path: m.path, url });
            continue;
          }
          if (!cancelled) items.push({ id: m.id, kind: m.kind, name: m.name, path: m.path, url: null });
        }
      } else if (src?.mediaPreview) {
        // ancien format : image intégrée conservée telle quelle
        items.push({
          id: uid(),
          kind: src.mediaKind ?? "image",
          name: src.mediaUrl ?? "image",
          url: src.mediaPreview,
        });
      } else if (src?.mediaUrl && src.mediaKind) {
        items.push({ id: uid(), kind: src.mediaKind, name: src.mediaUrl, url: null });
      }
      if (!cancelled) {
        trackedUrls.current.push(...localUrls.filter((u) => u.startsWith("blob:")));
        setMedia(items);
      }
    })();
    return () => {
      cancelled = true;
      localUrls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
      trackedUrls.current = trackedUrls.current.filter((u) => !localUrls.includes(u));
    };
  }, [open, editing, initial]);

  const isEditing = useMemo(() => !!editing, [editing]);
  // Détails média visibles dès qu'un média existe (fichiers, référence ou textes déjà saisis)
  const derivedMediaType: MediaType = media.some((m) => m.kind === "video")
    ? "video"
    : media.length > 0
      ? "image"
      : "text";
  const showMediaFields =
    media.length > 0 || mediaUrl.trim() !== "" || duration.trim() !== "" || script.trim() !== "";

  // Échap pour fermer + verrouille le scroll de la page derrière la modale
  // + boucle Tab (focus trap) à l'intérieur du dialogue
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
      if (e.key !== "Tab" || !panel) return;
      const els = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const list = Array.from(els).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
      );
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, requestClose]);

  if (!open) return null;

  function togglePlatform(p: PlatformKey) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function fillVariantFromBase() {
    setVariants((v) => ({ ...v, [activeVariant]: content }));
  }

  // Adaptation auto X + LinkedIn depuis le texte de base
  function autoAdaptTexts() {
    if (!content.trim()) {
      setError("Ajoute d'abord le texte de base.");
      return;
    }
    if (
      (variants.x.trim() || variants.linkedin.trim()) &&
      !window.confirm("Écraser les versions X et LinkedIn avec l'adaptation auto ?")
    )
      return;
    setError("");
    setVariants((v) => ({
      ...v,
      x: smartTruncate(content, 280),
      linkedin: smartTruncate(content, 3000),
    }));
  }

  // Hashtags détectés dans le message : 2 max pour X (budget 280), 5 pour LinkedIn
  function autoAdaptTags() {
    if (!content.trim()) {
      setError("Ajoute d'abord le texte de base.");
      return;
    }
    const tags = suggestHashtags(content, 5);
    if (tags.length === 0) {
      setError("Aucun mot-clé détecté pour des hashtags.");
      return;
    }
    setError("");
    setVariants((v) => ({
      ...v,
      x: buildVariant(v.x.trim() || content, 280, tags.slice(0, 2)),
      linkedin: buildVariant(v.linkedin.trim() || content, 3000, tags),
    }));
  }

  // Insère le socle + les hashtags du réseau actif (sans doublons)
  function insertHashtags() {
    const combined = `${tags.core} ${tags[activeVariant]}`.trim();
    if (!combined) return;
    setVariants((v) => ({ ...v, [activeVariant]: appendHashtags(v[activeVariant], combined) }));
  }

  function updateTags(key: keyof HashtagSets, value: string) {
    setTags((prev) => {
      const next = { ...prev, [key]: value };
      saveHashtags(next);
      return next;
    });
  }

  // Fichiers choisis : qualité d'origine, sans compression.
  // Photos persistées en IndexedDB (NoSQL navigateur) ; vidéos en session.
  async function onPickMedia(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_MEDIA - media.length;
    const picked = Array.from(files).slice(0, Math.max(room, 0));
    if (picked.length < files.length) {
      setError(`Maximum ${MAX_MEDIA} médias par publication — surplus ignoré.`);
    }
    for (const file of picked) {
      const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
      const id = uid();
      if (kind === "video") {
        const url = trackUrl(URL.createObjectURL(file));
        setMedia((prev) => [...prev, { id, kind, name: file.name, url }]);
        continue;
      }
      try {
        await saveBlob(id, file);
        const url = trackUrl(URL.createObjectURL(file));
        setMedia((prev) => [...prev, { id, kind, name: file.name, url }]);
      } catch {
        setError(`Impossible d'enregistrer ${file.name} (stockage plein ?).`);
      }
    }
  }

  function removeMedia(id: string) {
    setMedia((prev) => {
      const found = prev.find((m) => m.id === id);
      if (found) revokeUrl(found.url);
      return prev.filter((m) => m.id !== id);
    });
  }

  function clearMedia() {
    setMedia((prev) => {
      prev.forEach((m) => revokeUrl(m.url));
      return [];
    });
    setMediaUrl("");
  }

  async function handleCopy(text: string, key: string) {
    const ok = await copyText(text);
    if (ok) {
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    }
  }

  function validate(): string {
    if (!title.trim()) return "Ajoute un titre court pour retrouver ce post.";
    const hasMedia = media.length > 0 || mediaUrl.trim() !== "";
    if (!content.trim() && !hasMedia)
      return "Ajoute du texte, ou une photo / vidéo juste en dessous.";
    if (status === "scheduled" && !scheduledDate) return "Choisis une date pour planifier ce post.";
    return "";
  }

  async function handleSave(asDraft = false) {
    if (saving) return;
    // La date est obligatoire dans tous les cas : c'est elle qui fait
    // vivre le dashboard et le calendrier.
    if (!scheduledDate) {
      setError("Mets une date — elle est obligatoire pour suivre tes publications.");
      requestAnimationFrame(() => errorRef.current?.scrollIntoView({ block: "center" }));
      return;
    }
    const err = asDraft ? (!title.trim() ? "Ajoute au moins un titre." : "") : validate();
    if (err) {
      setError(err);
      requestAnimationFrame(() => errorRef.current?.scrollIntoView({ block: "center" }));
      return;
    }
    // Garantit les blobs des images migrées de l'ancien format (dataURL -> IndexedDB)
    for (const m of media) {
      if (m.kind === "image" && m.url && m.url.startsWith("data:")) {
        try {
          const blob = await (await fetch(m.url)).blob();
          await saveBlob(m.id, blob);
        } catch {
          /* conservation impossible */
        }
      }
    }
    setSaving(true);
    const postId = editing?.id ?? uid();
    // Envoi vers le bucket cloud (si connecté) : les chemins sont stockés
    // dans la fiche, la copie locale reste pour le hors-ligne.
    const su = await getSessionUser().catch(() => null);
    const folder = su ? mediaFolder(su.id, title.trim(), scheduledDate || undefined) : "";
    const itemsForSave: { id: string; kind: "image" | "video"; name: string; path?: string }[] = [];
    const mediaErrors: string[] = [];
    for (const m of media) {
      let path = m.path;
      if (su && !path) {
        let blob: Blob | null = null;
        if (m.url) {
          try {
            blob = await (await fetch(m.url)).blob();
          } catch {
            blob = null;
          }
        }
        if (!blob) {
          try {
            blob = await getBlob(m.id);
          } catch {
            blob = null;
          }
        }
        if (blob) {
          try {
            path = await uploadMediaBlob(su.id, folder, m.id, m.name, blob);
          } catch (e) {
            mediaErrors.push(`${m.name} : ${describeError(e)}`);
          }
        } else {
          mediaErrors.push(`${m.name} : fichier introuvable en local`);
        }
      }
      itemsForSave.push(path ? { id: m.id, kind: m.kind, name: m.name, path } : { id: m.id, kind: m.kind, name: m.name });
    }
    const now = nowISO();
    // Bouton brouillon : ne "déplanifie" que les planifiées ; le reste
    // (dont "À terminer") garde son statut tel quel.
    const finalStatus: EditorialStatus = asDraft && status === "scheduled" ? "draft" : status;
    const post: EditorialPost = {
      id: postId,
      title: title.trim(),
      content: content.trim(),
      mediaType: derivedMediaType,
      pillar,
      status: finalStatus,
      scheduledDate: scheduledDate || undefined,
      scheduledTime: scheduledTime || undefined,
      platforms,
      variants,
      mediaUrl: mediaUrl.trim() || undefined,
      mediaPreview: undefined,
      mediaKind: undefined,
      mediaItems: itemsForSave,
      duration: duration.trim() || undefined,
      script: script.trim() || undefined,
      notes: notes.trim() || undefined,
      pinnedComment: pinnedComment.trim() || undefined,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
      publishedAt: finalStatus === "published" ? editing?.publishedAt ?? now : editing?.publishedAt,
    };
    onSave(
      post,
      mediaErrors.length > 0 ? `Médias gardés en local (cloud : ${mediaErrors[0]})` : undefined
    );
    setSaving(false);
    requestClose();
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-6 ${closing ? "animate-fade-out" : "animate-fade-in"}`} onClick={requestClose}>
      <div
        ref={panelRef}
        className={`flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${closing ? "animate-pop-out" : "animate-pop"}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? "Modifier la publication" : "Nouvelle publication"}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              {isEditing ? "Modifier la publication" : "Nouvelle publication"}
            </h2>
            <p className="text-xs text-zinc-500">Colle ton texte, choisis le pilier, fixe la date.</p>
          </div>
          <button onClick={requestClose} className="rounded-full p-2.5 text-zinc-500 transition-all duration-200 hover:bg-zinc-100 active:scale-90" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {error && (
            <div ref={errorRef} role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className={labelCls}>Titre *</label>
            <input ref={titleRef} className={inputCls} value={title} aria-label="Titre de la publication" onChange={(e) => setTitle(e.target.value)} placeholder="Ex : 3 astuces IA pour ton site vitrine" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Pilier éditorial *</label>
              <select className={inputCls} value={pillar} aria-label="Pilier éditorial" onChange={(e) => setPillar(e.target.value as EditorialPillar)}>
                {PILLARS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Statut *</label>
              <select className={inputCls} value={status} aria-label="Statut de la publication" onChange={(e) => setStatus(e.target.value as EditorialStatus)}>
                {STATUSES.filter(
                  // "Planifiée" et "À terminer" ; l'ancien statut est conservé
                  // tel quel quand on modifie une fiche existante.
                  (s) =>
                    s.value === "scheduled" ||
                    s.value === "to_finish" ||
                    (editing && s.value === editing.status)
                ).map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {status === "to_finish" && (
                <p className="mt-1 text-[11px] text-zinc-500">
                  Précise ce qu&apos;il manque dans « Notes personnelles » (lien, visuel…).
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Date prévue *</label>
              <input type="date" className={inputCls} value={scheduledDate} aria-label="Date prévue (obligatoire)" onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Heure (facultatif)</label>
              <input type="time" className={inputCls} value={scheduledTime} aria-label="Heure (facultatif)" onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Modèle de démarrage</label>
            <div className="flex flex-wrap gap-1.5">
              {PILLARS.map((pp) => (
                <button
                  key={pp.value}
                  type="button"
                  onClick={() => {
                    if (
                      content.trim() &&
                      !window.confirm(`Remplacer le texte actuel par le modèle « ${pp.label} » ?`)
                    )
                      return;
                    setPillar(pp.value);
                    setContent(PILLAR_TEMPLATES[pp.value]);
                  }}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-600 transition-all duration-200 hover:border-zinc-900 hover:text-zinc-900 active:scale-95"
                >
                  {pp.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">Cliquable à tout moment — remplace après confirmation.</p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className={labelCls}>
                {derivedMediaType === "text" ? "Contenu de base *" : "Description / légende"}
              </label>
              <div className="flex shrink-0 items-center gap-1.5">
                {content.trim() !== "" && (
                  <button
                    onClick={() => {
                      if (window.confirm("Effacer tout le texte ?")) setContent("");
                    }}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 transition-all duration-200 hover:bg-red-50 active:scale-95"
                  >
                    Effacer
                  </button>
                )}
                <button
                  onClick={() => handleCopy(content, "base")}
                  disabled={!content.trim()}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 transition-all duration-200 hover:bg-zinc-50 active:scale-95 disabled:opacity-40"
                >
                {copied === "base" ? <Check size={13} /> : <Copy size={13} />}
                {copied === "base" ? "Copié" : "Copier"}
              </button>
              </div>
            </div>
            <textarea
              className={`${inputCls} min-h-[140px] leading-relaxed`}
              value={content}
              aria-label="Texte de la publication"
              onChange={(e) => setContent(e.target.value)}
              placeholder="Colle ici ton post rédigé avec ChatGPT… Les retours à la ligne sont conservés."
            />
            <p className="mt-1 text-right text-[11px] text-zinc-500">{content.length} caractères</p>
          </div>

          <div>
            <label className={labelCls}>Photos / vidéos (aperçu immédiat)</label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center transition-all duration-200 hover:border-zinc-900 hover:bg-zinc-100 active:scale-[0.99]">
              <Film size={20} className="text-zinc-500" />
              <span className="text-xs font-bold text-zinc-800">Choisir des photos ou une vidéo…</span>
              <span className="text-[11px] text-zinc-500">Plusieurs photos possibles (max {MAX_MEDIA}) — aperçu aussitôt ci-dessous</span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  onPickMedia(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {media.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {media.map((m) => (
                  <div
                    key={m.id}
                    className="relative h-14 w-14 overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-200"
                    title={m.name}
                  >
                    {m.url && m.kind === "image" ? (
                      <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                    ) : m.url ? (
                      <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Film size={16} className="text-zinc-500" />
                      </div>
                    )}
                    <button
                      onClick={() => removeMedia(m.id)}
                      aria-label={`Retirer ${m.name}`}
                      className="absolute right-0.5 top-0.5 rounded-full bg-zinc-900/70 p-0.5 text-white transition-all duration-200 hover:bg-zinc-900 active:scale-90"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {(media.length > 0 || mediaUrl.trim()) && (
              <div className="mt-1.5 flex flex-col items-center gap-1 text-center">
                <p className="max-w-full truncate text-[11px] text-zinc-500">
                  {media.length > 0 ? `${media.length} fichier${media.length > 1 ? "s" : ""} joint${media.length > 1 ? "s" : ""}` : ""}
                  {media.length > 0 && mediaUrl.trim() ? " • " : ""}
                  {mediaUrl.trim() ? `Référence : ${mediaUrl.trim()}` : ""}
                  {media.some((m) => m.kind === "video")
                    ? " — les vidéos ne sont pas conservées après rechargement, garde les fichiers."
                    : ""}
                </p>
                <button
                  onClick={clearMedia}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition-all duration-200 hover:bg-red-50 active:scale-95"
                >
                  Tout retirer
                </button>
              </div>
            )}
          </div>

          {showMediaFields && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Lien vidéo / fichier</label>
                  <input
                    className={inputCls}
                    value={mediaUrl}
                    aria-label="Lien vidéo ou nom de fichier"
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="Lien Drive, vidéo non listée… ou nom du fichier"
                  />
                </div>
                <div>
                  <label className={labelCls}>Durée</label>
                  <input
                    className={inputCls}
                    value={duration}
                    aria-label="Durée du média"
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="Ex : 0:45"
                  />
                </div>
              </div>
              {derivedMediaType === "video" && (
                <div>
                  <label className={labelCls}>Script / plan de tournage</label>
                  <textarea
                    className={`${inputCls} min-h-[90px] leading-relaxed`}
                    value={script}
                    aria-label="Script ou plan de tournage"
                    onChange={(e) => setScript(e.target.value)}
                    placeholder="Accroche, plans, phrases clés, appel à l'action…"
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1"><Megaphone size={12} /> Réseaux ciblés</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const on = platforms.includes(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePlatform(p.value)}
                    aria-pressed={on}
                    aria-label={`Réseau ${p.label}`}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
                      on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                    }`}
                  >
                    <PlatformIcon platform={p.value} size={13} mono />
                    {p.value !== "x" && p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <details className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-zinc-500">
              Adaptations par réseau (facultatif)
            </summary>
            <div className="mb-2 mt-2 flex flex-wrap items-center justify-end gap-2">
              <button onClick={fillVariantFromBase} className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-100">
                Reprendre le texte de base
              </button>
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 ring-1 ring-zinc-200">
              <span className="text-[11px] font-bold text-zinc-500">Auto X + LinkedIn :</span>
              <button
                onClick={autoAdaptTexts}
                className="rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-bold text-white transition-all duration-200 hover:bg-zinc-700 active:scale-95"
              >
                Adapter les textes
              </button>
              <button
                onClick={autoAdaptTags}
                className="rounded-md bg-white px-2 py-1 text-[11px] font-bold text-zinc-700 ring-1 ring-zinc-200 transition-all duration-200 hover:bg-zinc-900 hover:text-white active:scale-95"
              >
                + tags auto
              </button>
            </div>
            <div className="mb-2 flex gap-1 overflow-x-auto">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setActiveVariant(p.value)}
                  aria-label={`Version ${p.label}`}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    activeVariant === p.value ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200"
                  }`}
                >
                  <PlatformIcon platform={p.value} size={12} mono />
                  {p.value !== "x" && p.label}
                  {variants[p.value]?.trim() ? " •" : ""}
                </button>
              ))}
            </div>
            <textarea
              className={`${inputCls} min-h-[100px]`}
              value={variants[activeVariant]}
              aria-label={`Version ${PLATFORMS.find((p) => p.value === activeVariant)?.label}`}
              onChange={(e) => setVariants((v) => ({ ...v, [activeVariant]: e.target.value }))}
              placeholder={`Version ${PLATFORMS.find((p) => p.value === activeVariant)?.label} — adapte le ton, les hashtags, la longueur…`}
            />
            <div className="mt-1 flex items-center justify-between">
              <p className={`text-[11px] font-semibold ${variants[activeVariant].length > PLATFORM_LIMITS[activeVariant] ? "text-red-600" : "text-zinc-500"}`}>
                {variants[activeVariant].length} / {PLATFORM_LIMITS[activeVariant]} caractères
                {variants[activeVariant].length > PLATFORM_LIMITS[activeVariant] && " — trop long pour ce réseau"}
              </p>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <button
                onClick={insertHashtags}
                className="rounded-md bg-white px-2 py-1 text-[11px] font-bold text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition-all duration-200 hover:bg-zinc-900 hover:text-white active:scale-95"
              >
                + hashtags
              </button>
            </div>
            <details className="mt-1.5 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-zinc-200">
              <summary className="cursor-pointer text-[11px] font-bold text-zinc-500">
                Gérer mes hashtags (socle commun + par réseau)
              </summary>
              <div className="space-y-1.5 py-2">
                <div>
                  <p className="mb-0.5 text-[11px] font-semibold text-zinc-500">Socle repris partout</p>
                  <input
                    className={inputCls}
                    value={tags.core}
                    aria-label="Hashtags du socle commun"
                    onChange={(e) => updateTags("core", e.target.value)}
                    placeholder="#VibeCoding #IA #DevWeb"
                  />
                </div>
                {PLATFORMS.map((p) => (
                  <div key={p.value}>
                    <p className="mb-0.5 text-[11px] font-semibold text-zinc-500">Complément {p.label}</p>
                    <input
                      className={inputCls}
                      value={tags[p.value]}
                      aria-label={`Hashtags complémentaires pour ${p.label}`}
                      onChange={(e) => updateTags(p.value, e.target.value)}
                      placeholder="Ex : #LinkedInTips"
                    />
                  </div>
                ))}
              </div>
            </details>
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => handleCopy(variants[activeVariant] || content, `variant-${activeVariant}`)}
                disabled={!(variants[activeVariant].trim() || content.trim())}
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:bg-zinc-700 active:scale-95 disabled:opacity-40"
              >
                {copied === `variant-${activeVariant}` ? <Check size={13} /> : <Copy size={13} />}
                {copied === `variant-${activeVariant}` ? "Copié !" : `Copier version ${PLATFORMS.find((p) => p.value === activeVariant)?.label}`}
              </button>
            </div>
          </details>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                Aperçus par réseau
              </p>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-500 ring-1 ring-zinc-200">
                Rendu simulé
              </span>
            </div>
            <div className="space-y-4">
              {PLATFORMS.map((p) => (
                <div key={p.value}>
                  <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                    <PlatformIcon platform={p.value} size={12} mono />
                    {p.value !== "x" && p.label}
                  </p>
                  <NetworkPreview
                    key={`${p.value}-${media.map((m) => m.id).join("|")}`}
                    platform={p.value}
                    title={title}
                    text={variants[p.value].trim() || content}
                    mediaType={derivedMediaType}
                    items={media.map((m) => ({ id: m.id, url: m.url, kind: m.kind, name: m.name }))}
                    linkName={mediaUrl.trim()}
                    pinnedComment={pinnedComment}
                    dateLabel={scheduledDate ? `Prévu le ${formatShort(scheduledDate)}${scheduledTime ? ` à ${scheduledTime}` : ""}` : "Brouillon"}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1"><StickyNote size={12} /> Notes personnelles</span>
            </label>
            <textarea className={`${inputCls} min-h-[60px]`} value={notes} aria-label="Notes personnelles" onChange={(e) => setNotes(e.target.value)} placeholder="Visuel à créer, lien à ajouter, point à vérifier…" />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className={labelCls}>
                <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> Premier commentaire épinglé</span>
              </label>
              <button
                onClick={() => handleCopy(pinnedComment, "pinned")}
                disabled={!pinnedComment.trim()}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 transition-all duration-200 hover:bg-zinc-50 active:scale-95 disabled:opacity-40"
              >
                {copied === "pinned" ? <Check size={13} /> : <Copy size={13} />}
                {copied === "pinned" ? "Copié" : "Copier"}
              </button>
            </div>
            <textarea
              className={`${inputCls} min-h-[70px] leading-relaxed`}
              value={pinnedComment}
              aria-label="Premier commentaire épinglé"
              onChange={(e) => setPinnedComment(e.target.value)}
              placeholder="Lien de ta formation, appel à l'action… à coller en premier commentaire et à épingler"
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
            <CalendarDays size={14} />
            Astuce : le statut « Publiée » se met à la main, même si la date est passée.
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-zinc-100 bg-white px-5 py-4 sm:flex-row sm:items-center">
          {isEditing && onDelete && editing && (
            <button
              onClick={() => {
                if (window.confirm("Supprimer cette publication ?")) {
                  onDelete(editing.id);
                  requestClose();
                }
              }}
              className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 size={15} /> Supprimer
            </button>
          )}
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
            {isEditing && editing && (
              <button
                onClick={() => {
                  const now = nowISO();
                  onSave({
                    ...editing,
                    id: uid(),
                    title: `${editing.title.replace(/ \(copie\)$/, "")} (copie)`,
                    status: "draft",
                    scheduledDate: undefined,
                    scheduledTime: undefined,
                    publishedAt: undefined,
                    variants: { ...editing.variants },
                    createdAt: now,
                    updatedAt: now,
                  });
                  requestClose();
                }}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Dupliquer
              </button>
            )}
            {!isEditing && (
              <button onClick={() => handleSave(true)} disabled={saving} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition-all duration-200 hover:bg-zinc-50 active:scale-95 disabled:opacity-40">
                {saving ? "Enregistrement…" : "Enregistrer en brouillon"}
              </button>
            )}
            <button onClick={() => handleSave(false)} disabled={saving} className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-zinc-700 active:scale-95 disabled:opacity-40">
              {saving ? "Enregistrement…" : isEditing ? "Enregistrer" : "Créer la publication"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
