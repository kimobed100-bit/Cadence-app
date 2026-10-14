// Aperçus fidèles au style visuel de chaque réseau (maquettes statiques,
// sans chiffres inventés) : texte en haut, média(s) en bas, comme une fois publié.
// Plusieurs photos : carrousel (Instagram), grille (X, Facebook), bandeau (LinkedIn).
import { useState } from "react";
import type { MediaType, PlatformKey } from "@/lib/editorial";
import { splitThread } from "@/lib/editorial";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Eye,
  Film,
  Globe,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Send,
  Share2,
  ThumbsUp,
} from "@/components/icons";

export type PreviewItem = {
  id: string;
  url: string | null;
  kind: "image" | "video";
  name: string;
};

export type NetworkPreviewProps = {
  platform: PlatformKey;
  title: string;
  text: string;
  mediaType?: MediaType;
  items: PreviewItem[];
  linkName: string; // lien manuel éventuel (affiché si aucun fichier)
  pinnedComment: string; // premier commentaire épinglé
  dateLabel: string;
};

function Avatar({ className = "h-9 w-9 text-xs" }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-900 font-black text-white ${className}`}
    >
      OK
    </div>
  );
}

function Body({ text, className = "" }: { text: string; className?: string }) {
  if (!text.trim()) {
    return <p className={`italic text-zinc-300 ${className}`}>Le texte apparaîtra ici…</p>;
  }
  return <p className={`whitespace-pre-line break-words ${className}`}>{text}</p>;
}

// Premier commentaire épinglé, style bulle (Facebook / LinkedIn)
function PinnedComment({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="flex gap-2 px-3 py-2">
      <Avatar className="h-7 w-7 text-[10px]" />
      <div className="min-w-0 flex-1 rounded-2xl bg-zinc-100 px-3 py-1.5">
        <p className="text-[11px] font-bold text-zinc-900">
          Obed Kim <span className="ml-1 font-semibold text-zinc-500">• Épinglé</span>
        </p>
        <p className="whitespace-pre-line text-xs text-zinc-800 break-words">{text.trim()}</p>
      </div>
    </div>
  );
}

function TileContent({ item, controls, className }: { item: PreviewItem; controls: boolean; className: string }) {
  if (item.url && item.kind === "image") {
    return <img src={item.url} alt={item.name || "Aperçu"} className={className} />;
  }
  if (item.url) {
    return controls ? (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video src={item.url} controls playsInline className={`${className} bg-black`} />
    ) : (
      <video src={item.url} muted playsInline preload="metadata" className={className} />
    );
  }
  return (
    <div className={`flex flex-col items-center justify-center gap-1 bg-zinc-100 px-2 text-center ${className}`}>
      <Film size={20} className="text-zinc-300" />
      <p className="truncate text-[11px] text-zinc-500">{item.name || "Média"}</p>
    </div>
  );
}

// Galerie multi-photos : carrousel (flèches + points), grille (mosaïque),
// bandeau (vignettes cliquables). Une seule photo = affichage simple.
function PreviewMedia({
  items,
  linkName,
  aspectClass,
  roundedClass = "",
  mode,
}: {
  items: PreviewItem[];
  linkName: string;
  aspectClass: string;
  roundedClass?: string;
  mode: "carousel" | "strip" | "grid";
}) {
  const [sel, setSel] = useState(0);
  const n = items.length;
  const cur = items[Math.min(sel, Math.max(n - 1, 0))];

  if (n === 0) {
    return (
      <div
        className={`${aspectClass} ${roundedClass} flex flex-col items-center justify-center gap-1 bg-zinc-100 px-4 text-center`}
      >
        <Film size={22} className="text-zinc-300" />
        <p className="text-xs text-zinc-500">
          {linkName ? `Média : ${linkName}` : "Ajoute une photo ou une vidéo pour voir le rendu"}
        </p>
      </div>
    );
  }

  if (mode === "grid" && n > 1) {
    const shown = items.slice(0, 4);
    const extra = n - shown.length;
    return (
      <div className={`${roundedClass} overflow-hidden`}>
        <div className="grid grid-cols-2 gap-0.5">
          {shown.map((it, i) => (
            <div
              key={it.id}
              className={`relative overflow-hidden bg-zinc-100 ${
                n === 3 && i === 0 ? "row-span-2 h-full min-h-full" : "aspect-square"
              }`}
            >
              <TileContent item={it} controls={false} className="h-full w-full object-cover" />
              {extra > 0 && i === shown.length - 1 && (
                <span className="absolute inset-0 flex items-center justify-center bg-zinc-900/60 text-xl font-black text-white">
                  +{extra + 1}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${roundedClass} overflow-hidden`}>
      <div className={`relative ${aspectClass} w-full overflow-hidden bg-zinc-100`}>
        <TileContent item={cur} controls className="h-full w-full object-cover" />
        {n > 1 && mode === "carousel" && (
          <>
            <button
              onClick={() => setSel((s) => (s - 1 + n) % n)}
              aria-label="Photo précédente"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-zinc-900/60 p-1.5 text-white transition-all duration-200 hover:bg-zinc-900 active:scale-90"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setSel((s) => (s + 1) % n)}
              aria-label="Photo suivante"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-zinc-900/60 p-1.5 text-white transition-all duration-200 hover:bg-zinc-900 active:scale-90"
            >
              <ChevronRight size={14} />
            </button>
          </>
        )}
        {n > 1 && (
          <span className="absolute right-2 top-2 rounded-full bg-zinc-900/70 px-2 py-0.5 text-[10px] font-bold text-white">
            {Math.min(sel, n - 1) + 1}/{n}
          </span>
        )}
      </div>
      {n > 1 && mode === "carousel" && (
        <div className="flex justify-center gap-1 bg-white py-1.5">
          {items.map((it, i) => (
            <span
              key={it.id}
              className={`h-1.5 w-1.5 rounded-full ${i === Math.min(sel, n - 1) ? "bg-zinc-900" : "bg-zinc-300"}`}
            />
          ))}
        </div>
      )}
      {n > 1 && mode === "strip" && (
        <div className="flex gap-1.5 overflow-x-auto bg-white px-3 py-2">
          {items.map((it, i) => (
            <button
              key={it.id}
              onClick={() => setSel(i)}
              aria-label={`Voir ${it.name}`}
              className={`h-11 w-11 shrink-0 overflow-hidden rounded-lg transition-all duration-200 ${
                i === Math.min(sel, n - 1) ? "ring-2 ring-zinc-900" : "opacity-70 ring-1 ring-zinc-200"
              }`}
            >
              <TileContent item={it} controls={false} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Facebook ----------------
function FacebookPreview(p: NetworkPreviewProps) {
  const long = p.text.trim().length > 220;
  return (
    <div className="bg-[#f0f2f5] py-3">
      <div className="bg-white shadow-sm">
        <div className="flex items-center gap-2.5 px-3 pt-3">
          <Avatar />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-bold text-[#050505]">Obed Kim</p>
            <p className="flex items-center gap-1 text-[11px] text-zinc-500">
              {p.dateLabel} • <Globe size={11} />
            </p>
          </div>
          <MoreHorizontal size={18} className="shrink-0 text-zinc-500" />
        </div>
        <div className="px-3 pt-2">
          <Body text={p.text} className={`text-[13px] text-[#050505] ${long ? "line-clamp-4" : ""}`} />
          {long && <span className="text-[13px] font-semibold text-zinc-500">Voir plus</span>}
        </div>
        <div className="mt-2">
          <PreviewMedia items={p.items} linkName={p.linkName} aspectClass="aspect-[16/10]" mode="grid" />
        </div>
        <div className="flex items-center justify-around border-t border-zinc-100 px-2 py-1 text-zinc-500">
          {[
            { icon: <ThumbsUp size={16} />, label: "J'aime" },
            { icon: <MessageCircle size={16} />, label: "Commenter" },
            { icon: <Share2 size={16} />, label: "Partager" },
          ].map((a) => (
            <span key={a.label} className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold">
              {a.icon}
              {a.label}
            </span>
          ))}
        </div>
        <PinnedComment text={p.pinnedComment} />
      </div>
    </div>
  );
}

// ---------------- LinkedIn ----------------
function LinkedInPreview(p: NetworkPreviewProps) {
  const long = p.text.trim().length > 180;
  return (
    <div className="bg-[#f4f2ee] p-2">
      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-200">
        <div className="flex items-start gap-2.5 px-3 pt-3">
          <Avatar className="h-12 w-12 text-sm" />
          <div className="min-w-0 flex-1 leading-snug">
            <p className="truncate text-sm font-bold text-zinc-900">Obed Kim</p>
            <p className="truncate text-[11px] text-zinc-600">Créateur de solutions numériques</p>
            <p className="flex items-center gap-1 text-[11px] text-zinc-500">
              {p.dateLabel} • <Globe size={11} />
            </p>
          </div>
          <MoreHorizontal size={18} className="shrink-0 text-zinc-500" />
        </div>
        <div className="px-3 pt-2">
          <Body text={p.text} className={`text-[13px] text-zinc-900 ${long ? "line-clamp-3" : ""}`} />
          {long && <span className="text-[13px] text-zinc-500">…voir plus</span>}
        </div>
        <div className="mt-2">
          <PreviewMedia items={p.items} linkName={p.linkName} aspectClass="aspect-[16/10]" mode="strip" />
        </div>
        <div className="flex items-center justify-between px-2 py-1 text-zinc-600">
          {[
            { icon: <ThumbsUp size={16} />, label: "J'aime" },
            { icon: <MessageCircle size={16} />, label: "Commenter" },
            { icon: <Repeat2 size={16} />, label: "Republier" },
            { icon: <Send size={16} />, label: "Envoyer" },
          ].map((a) => (
            <span key={a.label} className="flex items-center gap-1.5 px-2 py-2 text-[12px] font-semibold">
              {a.icon}
              <span className="hidden min-[380px]:inline">{a.label}</span>
            </span>
          ))}
        </div>
        <PinnedComment text={p.pinnedComment} />
      </div>
    </div>
  );
}

// ---------------- Instagram ----------------
function InstagramPreview(p: NetworkPreviewProps) {
  return (
    <div className="bg-white">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-violet-500 p-[2px]">
          <div className="rounded-full bg-white p-[2px]">
            <Avatar className="h-7 w-7 text-[10px]" />
          </div>
        </div>
        <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-zinc-900">Obed Kim</p>
        <MoreHorizontal size={18} className="shrink-0 text-zinc-900" />
      </div>
      <PreviewMedia items={p.items} linkName={p.linkName} aspectClass="aspect-[4/5] max-h-[420px]" mode="carousel" />
      <div className="flex items-center gap-4 px-3 pt-2.5 text-zinc-900">
        <Heart size={22} />
        <MessageCircle size={22} />
        <Share2 size={22} />
        <span className="flex-1" />
        <Bookmark size={22} />
      </div>
      <div className="px-3 pb-3 pt-2">
        {p.text.trim() ? (
          <p className="line-clamp-2 text-[13px] text-zinc-900 break-words">
            <span className="mr-1.5 font-bold">Obed Kim</span>
            {p.text.trim()}
          </p>
        ) : (
          <p className="text-[13px] italic text-zinc-300">La légende apparaîtra ici…</p>
        )}
        {p.pinnedComment.trim() !== "" && (
          <p className="pt-1 text-[13px] text-zinc-900 break-words">
            <span className="mr-1.5 font-bold">Obed Kim</span>
            {p.pinnedComment.trim()}
          </p>
        )}
        <p className="mt-1 text-[10px] uppercase text-zinc-500">{p.dateLabel}</p>
      </div>
    </div>
  );
}

// ---------------- X ----------------
function XPreview(p: NetworkPreviewProps) {
  // Le média s'affiche dès qu'il est prévu : fichiers, référence,
  // ou format image/vidéo (même si le fichier n'est pas encore choisi).
  const showMedia = p.items.length > 0 || !!p.linkName || (p.mediaType && p.mediaType !== "text");
  const threadCount = p.text.trim().length > 280 ? splitThread(p.text).length : 0;
  return (
    <div className="bg-white px-3 py-3">
      <div className="flex gap-2.5">
        <Avatar />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-zinc-500">
            <span className="mr-1.5 font-bold text-zinc-900">Obed Kim</span>· {p.dateLabel}
          </p>
          <Body text={p.text} className="pt-0.5 text-[15px] leading-normal text-zinc-900" />
          {threadCount > 1 && (
            <p className="mt-1.5 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600">
              Texte de {p.text.trim().length} caractères → à publier en fil de {threadCount} posts.
            </p>
          )}
          {showMedia && (
            <div className="mt-2">
              <PreviewMedia
                items={p.items}
                linkName={p.linkName}
                aspectClass="aspect-[16/10]"
                roundedClass="rounded-2xl border border-zinc-200"
                mode="grid"
              />
            </div>
          )}
          <div className="flex max-w-xs items-center justify-between pt-2.5 text-zinc-500">
            <MessageCircle size={16} />
            <Repeat2 size={16} />
            <Heart size={16} />
            <Eye size={16} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NetworkPreview(props: NetworkPreviewProps) {
  switch (props.platform) {
    case "facebook":
      return <FacebookPreview {...props} />;
    case "linkedin":
      return <LinkedInPreview {...props} />;
    case "instagram":
      return <InstagramPreview {...props} />;
    case "x":
      return <XPreview {...props} />;
    default:
      return <FacebookPreview {...props} />;
  }
}
