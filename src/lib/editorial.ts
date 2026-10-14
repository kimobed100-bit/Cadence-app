export type EditorialStatus =
  | "draft"
  | "to_prepare"
  | "ready"
  | "scheduled"
  | "to_finish"
  | "published";

export type EditorialPillar =
  | "educational"
  | "demonstration"
  | "problem_solution"
  | "build_in_public"
  | "opinion"
  | "project_case_study";

export type PlatformKey = "linkedin" | "facebook" | "instagram" | "x";

export type MediaType = "text" | "image" | "video";

export type MediaItem = {
  id: string; // clé du blob en local (IndexedDB) et nom distant
  kind: "image" | "video";
  name: string; // nom du fichier ou libellé
  path?: string; // chemin dans le bucket cloud (phase 2), ex user/post/id-nom
};

export type EditorialPost = {
  id: string;
  title: string;
  content: string; // texte de base (ou légende / description si vidéo)
  pillar: EditorialPillar;
  status: EditorialStatus;
  mediaType: MediaType;
  scheduledDate?: string; // YYYY-MM-DD (date calendrier, pas d'UTC)
  scheduledTime?: string; // HH:MM facultatif
  platforms: PlatformKey[]; // réseaux ciblés
  variants: Record<PlatformKey, string>; // adaptations par réseau
  mediaUrl?: string; // lien vidéo (Drive, non listée…) ou nom de fichier
  mediaPreview?: string; // (historique) dataURL d'image — remplacé par mediaItems
  mediaKind?: "image" | "video"; // (historique) type du média — remplacé par mediaItems
  mediaItems?: MediaItem[]; // photos/vidéos jointes (blobs en IndexedDB)
  duration?: string; // durée indicative, ex : 0:45
  script?: string; // script / plan de tournage / prises
  notes?: string;
  pinnedComment?: string; // premier commentaire épinglé (lien formation, CTA…)
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export const STORAGE_KEY = "content-planner-posts-v1";

export const PILLARS: { value: EditorialPillar; label: string; hint: string }[] = [
  { value: "educational", label: "Éducatif", hint: "Astuces, tutos, explications" },
  { value: "demonstration", label: "Démonstration", hint: "Outil IA, démo, expérience" },
  { value: "problem_solution", label: "Problème → Solution", hint: "Besoin concret + solution" },
  { value: "build_in_public", label: "Build in public", hint: "Avancement, coulisses" },
  { value: "opinion", label: "Opinion", hint: "Point de vue web / IA" },
  { value: "project_case_study", label: "Projet / Cas client", hint: "Réalisation, résultat" },
];

export const STATUSES: { value: EditorialStatus; label: string }[] = [
  { value: "draft", label: "Brouillon" },
  { value: "to_prepare", label: "À préparer" },
  { value: "ready", label: "Prête" },
  { value: "scheduled", label: "Planifiée" },
  { value: "to_finish", label: "À terminer" },
  { value: "published", label: "Publiée" },
];

export const PLATFORMS: { value: PlatformKey; label: string }[] = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X" },
];

export const MEDIA_TYPES: { value: MediaType; label: string; hint: string }[] = [
  { value: "text", label: "Texte", hint: "Post classique" },
  { value: "image", label: "Image", hint: "Visuel, carrousel" },
  { value: "video", label: "Vidéo", hint: "Horizontale ou verticale" },
];

// Ancien format "reel" (retiré) -> traité comme vidéo
export function normalizeMediaType(m: unknown): MediaType {
  if (m === "image" || m === "video") return m;
  if (m === "reel") return "video";
  return "text";
}

export const mediaLabel = (m: MediaType) =>
  MEDIA_TYPES.find((x) => x.value === m)?.label ?? m;

export const pillarLabel = (p: EditorialPillar) =>
  PILLARS.find((x) => x.value === p)?.label ?? p;

export const statusLabel = (s: EditorialStatus) =>
  STATUSES.find((x) => x.value === s)?.label ?? s;

export const platformLabel = (p: PlatformKey) =>
  PLATFORMS.find((x) => x.value === p)?.label ?? p;

// Limites de caractères indicatives par réseau (légendes)
export const PLATFORM_LIMITS: Record<PlatformKey, number> = {
  x: 280,
  instagram: 2200,
  linkedin: 3000,
  facebook: 63206,
};

// Banque de hashtags perso : un socle commun + compléments par réseau
export type HashtagSets = { core: string } & Record<PlatformKey, string>;

const HASHTAG_KEY = "content-planner-hashtags-v1";

export const DEFAULT_HASHTAGS: HashtagSets = {
  core: "#VibeCoding #IA #DevWeb",
  linkedin: "",
  facebook: "",
  instagram: "",
  x: "",
};

export function loadHashtags(): HashtagSets {
  if (typeof window === "undefined") return { ...DEFAULT_HASHTAGS };
  try {
    const raw = window.localStorage.getItem(HASHTAG_KEY);
    if (!raw) return { ...DEFAULT_HASHTAGS };
    const parsed = JSON.parse(raw) as Partial<HashtagSets>;
    return { ...DEFAULT_HASHTAGS, ...parsed };
  } catch {
    return { ...DEFAULT_HASHTAGS };
  }
}

export function saveHashtags(tags: HashtagSets) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HASHTAG_KEY, JSON.stringify(tags));
  } catch {
    /* ignore */
  }
}

// Ajoute les hashtags manquants en fin de texte (sans doublons)
export function appendHashtags(base: string, tags: string): string {
  const add = tags
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (add.length === 0) return base;
  const existing = new Set(base.split(/\s+/));
  const missing = add.filter((t) => !existing.has(t));
  if (missing.length === 0) return base;
  const trimmed = base.replace(/\s+$/, "");
  const sep = trimmed === "" ? "" : "\n\n";
  return trimmed + sep + missing.join(" ");
}

// Modèles de démarrage par pilier (le contenu reste à rédiger / coller)
export const PILLAR_TEMPLATES: Record<EditorialPillar, string> = {
  educational:
    "Accroche : [1 phrase qui promet un résultat concret]\n\nErreur fréquente : [ce que les débutants font]\nÀ faire à la place :\n1. …\n2. …\n3. …\n\nTeste et dis-moi ton résultat en commentaire.",
  demonstration:
    "Je viens de tester [outil] pour [usage concret].\n\nCe que ça fait bien : …\nCe qui m'a surpris : …\nLimite trouvée : …\n\nVerdict : [pour qui / pour quoi]\n\nTu veux que je montre [cas précis] en vidéo ?",
  problem_solution:
    "Le problème : [qui] galère avec [quoi], parce que [pourquoi].\n\nMon idée : [la solution en 1 phrase].\n\nJe construis : [quoi, avec quels outils].\n\nTu vis ça aussi ? Raconte en commentaire.",
  build_in_public:
    "Build in public — [projet], jour [X].\n\nFait : …\nBloqué sur : …\nAppris : …\n\nProchaine étape : …\n\nJe documente tout ici, abonne-toi pour suivre.",
  opinion:
    "Avis tranché : [ton point de vue en 1 phrase].\n\nPourquoi je le pense :\n• …\n• …\n\nOn m'objectera que [contre-argument], et c'est vrai quand [cas].\n\nD'accord ou pas ?",
  project_case_study:
    "Projet livré : [nom] pour [qui].\n\nObjectif : …\nConstruit avec : …\nRésultat : [effet concret ou chiffre].\n\nLeçon : …\n\nUn projet similaire en tête ? Écris-moi.",
};

// Découpe un texte en morceaux <= limit (mots entiers, mots trop longs coupés),
// numérotés "1/3 ..." pour un thread X.
export function splitThread(text: string, limit = 280): string[] {  const clean = text.trim().replace(/\n{3,}/g, "\n\n");
  if (!clean) return [];
  const reserve = 8; // place pour "12/34 "
  const max = limit - reserve;
  const words = clean.split(/\s+/);
  const parts: string[] = [];
  let cur = "";
  for (const w of words) {
    if (w.length > max) {
      if (cur) {
        parts.push(cur);
        cur = "";
      }
      for (let i = 0; i < w.length; i += max) parts.push(w.slice(i, i + max));
      continue;
    }
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= max) {
      cur = next;
    } else {
      parts.push(cur);
      cur = w;
    }
  }
  if (cur) parts.push(cur);
  const n = parts.length;
  return parts.map((p, i) => `${i + 1}/${n} ${p}`);
}

// Réduit un texte à `limit` caractères en coupant proprement :
// fin de phrase d'abord, sinon mot entier, sinon coupe franche. Ajoute "…".
export function smartTruncate(text: string, limit: number): string {
  const clean = text.trim().replace(/\n{3,}/g, "\n\n");
  if (clean.length <= limit) return clean;
  const max = Math.max(limit - 1, 10);
  const cut = clean.slice(0, max);
  const ends = [
    cut.lastIndexOf(". "),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("? "),
    cut.lastIndexOf(".\n"),
    cut.lastIndexOf("\n"),
  ];
  const at = Math.max(...ends);
  if (at > limit * 0.4) return `${cut.slice(0, at + 1).trim()}…`;
  const space = cut.lastIndexOf(" ");
  if (space > limit * 0.4) return `${cut.slice(0, space).trim()}…`;
  return `${cut.trim()}…`;
}

// Construit une variante : texte réduit pour tenir avec les tags.
export function buildVariant(base: string, limit: number, tags: string[]): string {
  const clean = base.trim().replace(/\n{3,}/g, "\n\n");
  const tagStr = tags.join(" ");
  if (!clean) return tagStr;
  if (!tagStr) return smartTruncate(clean, limit);
  const body = smartTruncate(clean, Math.max(limit - tagStr.length - 2, 20));
  return `${body}\n\n${tagStr}`;
}

// Mots vides français (comparés sans accents, en minuscules)
const FR_STOP = new Set(
  "a,as,au,aux,avec,ce,ces,comme,dans,de,des,du,elle,en,entre,est,sont,ete,etre,avoir,ont,fait,faire,font,plus,par,pour,que,qui,quoi,sa,ses,ses2,son,sur,tes,ton,ta,tout,tous,toute,toutes,tres,aussi,alors,ainsi,autre,autres,avant,apres,chez,contre,depuis,moins,sans,sous,vers,voici,voila,ca,cela,celui,celle,ceux,celles,mon,ma,mes,notre,nos,votre,vos,leur,leurs,mais,ou,donc,or,ni,car,lorsque,quand,comment,combien,pourquoi,parce,afin,chaque,plusieurs,certains,certaines,quel,quelle,quels,quelles,lequel,ceci,dont,etre,cest,lorsqu,autant,tant,peu,beaucoup,assez,trop,bien,mal,mieux,grand,grande,petit,petite,jeune,nouveau,nouvelle,premier,premiere,dernier,derniere,bon,bonne,seul,seule,aucun,aucune,quelque,quelques,tel,telle,etre,peut,peuvent,doit,doivent,aller,venir,voir,prendre,mettre,dire,lire,suivre,partager,cliquer,tester,essaie,essayez,voici,grace,fois,an,annee,jour,mois,semaine,heure,minute,fois,exemple,cas,point,partie,article,video,photo,post,article,thread,tweet,compte,reseau,monde,gens,personne,choses,truc,vraiment,juste,donc,alors,deja,encore,toujours,jamais,souvent,presque,peutetre,voila,allez,merci,bravo,super,top,cool,nous,vous,pendant,incroyable,absolument,totalement,simplement,seulement,possible,facile,rapide,vite,adore,aime,aimer,creer,cree,devient,devenir,minutes,heures,secondes,essayer".split(
    ","
  )
);

// Suggère des hashtags depuis le message : #tags déjà présents d'abord,
// puis mots-clés fréquents (longs, significatifs). Max `max` tags.
export function suggestHashtags(text: string, max = 5): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const re = /#([\p{L}\p{N}_-]+)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const tag = `#${m[1]}`;
    const k = tag.toLowerCase();
    if (!seen.has(k) && found.length < max) {
      seen.add(k);
      found.push(tag);
    }
  }
  if (found.length >= max) return found;
  // Sigles en capitales (IA, API, SEO…) : excellents hashtags, prioritaires
  const acronyms = new Set<string>();
  for (const w of text.split(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/)) {
    if (/^[A-Z]{2,}$/.test(w) && w.length <= 8) acronyms.add(`#${w}`);
  }
  for (const tag of acronyms) {
    if (found.length >= max) break;
    const k = tag.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      found.push(tag);
    }
  }
  if (found.length >= max) return found;
  const stripped = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const freq = new Map<string, number>();
  for (const w of stripped.split(/[^a-z0-9]+/)) {
    if (w.length < 4 || /^\d+$/.test(w) || FR_STOP.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const ranked = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([w]) => w);
  for (const w of ranked) {
    if (found.length >= max) break;
    const tag = `#${w[0].toUpperCase()}${w.slice(1)}`;
    const k = tag.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      found.push(tag);
    }
  }
  return found;
}

// Lundi (YYYY-MM-DD) de la semaine contenant iso
export function weekKeyOf(iso: string): string {
  const d = parseISODate(iso);
  const offset = (d.getDay() + 6) % 7;
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset));
}

// Les n derniers lundis (ordre croissant, le dernier = semaine en cours)
export function lastNWeeks(n: number): string[] {
  const thisMonday = parseISODate(weekKeyOf(todayISO()));
  return Array.from({ length: n }, (_, k) => {
    const i = n - 1 - k;
    return toISODate(
      new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - i * 7)
    );
  });
}

export function weekLabelShort(mondayISO: string): string {
  try {
    return parseISODate(mondayISO).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return mondayISO;
  }
}

// --- Dates : toujours en heure locale, jamais converties en UTC ---
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDayLong(iso: string): string {
  try {
    return parseISODate(iso).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return iso;
  }
}

export function formatShort(iso?: string): string {
  if (!iso) return "Sans date";
  try {
    return parseISODate(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function emptyVariants(): Record<PlatformKey, string> {
  return { linkedin: "", facebook: "", instagram: "", x: "" };
}

export function loadPosts(): EditorialPost[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as EditorialPost[];
    if (!Array.isArray(arr)) return [];
    // migration douce : valeurs garanties + suppression des réseaux retirés
    const validPlatforms = new Set(PLATFORMS.map((x) => x.value));
    return arr.map((p) => {
      const vv =
        p.variants && typeof p.variants === "object"
          ? (p.variants as Record<string, unknown>)
          : {};
      const variants = emptyVariants();
      for (const k of Object.keys(variants) as PlatformKey[]) {
        if (typeof vv[k] === "string") variants[k] = vv[k] as string;
      }
      const rawMedia = (p as { mediaType?: unknown }).mediaType;
      const legacy = p as unknown as Record<string, unknown>;
      return {
        ...p,
        mediaType: normalizeMediaType(rawMedia),
        // ancien champ "URL publiée" récupéré comme commentaire épinglé
        pinnedComment:
          typeof p.pinnedComment === "string"
            ? p.pinnedComment
            : typeof legacy.publishedUrl === "string"
              ? legacy.publishedUrl
              : undefined,
        pillar: PILLARS.some((x) => x.value === p.pillar) ? p.pillar : "educational",
        status: STATUSES.some((x) => x.value === p.status) ? p.status : "draft",
        platforms: Array.isArray(p.platforms)
          ? p.platforms.filter((k): k is PlatformKey => validPlatforms.has(k as PlatformKey))
          : [],
        variants,
      };
    });
  } catch {
    // Données illisibles : on les met de côté (récupérables via import)
    // au lieu de les écraser au prochain enregistrement.
    try {
      window.localStorage.setItem(`${STORAGE_KEY}.corrupt`, raw);
    } catch {
      /* ignore */
    }
    return [];
  }
}

export function savePosts(posts: EditorialPost[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  } catch {
    // Quota dépassé (images intégrées) : on réessaie sans les aperçus
    try {
      const slim = posts.map((p) => {
        const { mediaPreview: _dropped, ...rest } = p;
        void _dropped;
        return rest;
      });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch {
      /* stockage plein : on garde l'état précédent */
    }
  }
}

export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // repli pour contextes non sécurisés
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}
