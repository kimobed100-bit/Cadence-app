// Icônes inline (style Lucide) — évite une dépendance externe.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Plus = (p: P) => base({ ...p, children: (<><path d="M5 12h14" /><path d="M12 5v14" /></>) });
export const X = (p: P) => base({ ...p, children: (<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>) });
export const Check = (p: P) => base({ ...p, children: <path d="M20 6 9 17l-5-5" /> });
export const Copy = (p: P) => base({ ...p, children: (<><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>) });
export const Pencil = (p: P) => base({ ...p, children: (<><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></>) });
export const Trash2 = (p: P) => base({ ...p, children: (<><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></>) });
export const Search = (p: P) => base({ ...p, children: (<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>) });
export const ChevronLeft = (p: P) => base({ ...p, children: <path d="m15 18-6-6 6-6" /> });
export const ChevronRight = (p: P) => base({ ...p, children: <path d="m9 18 6-6-6-6" /> });
export const CalendarDays = (p: P) => base({ ...p, children: (<><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></>) });
export const CalendarPlus = (p: P) => base({ ...p, children: (<><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M12 18v-4" /><path d="M10 16h4" /></>) });
export const LayoutDashboard = (p: P) => base({ ...p, children: (<><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></>) });
export const ListTodo = (p: P) => base({ ...p, children: (<><rect x="3" y="3" width="5" height="5" rx="1" /><rect x="3" y="16" width="5" height="5" rx="1" /><path d="M12 8h9" /><path d="M12 12h9" /><path d="M12 20h4" /></>) });
export const Megaphone = (p: P) => base({ ...p, children: (<><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>) });
export const Link2 = (p: P) => base({ ...p, children: (<><path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 1 1 0 10h-2" /><line x1="8" x2="16" y1="12" y2="12" /></>) });
export const StickyNote = (p: P) => base({ ...p, children: (<><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" /><path d="M15 3v5h5" /></>) });
export const Download = (p: P) => base({ ...p, children: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></>) });
export const Upload = (p: P) => base({ ...p, children: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></>) });
export const Duplicate = (p: P) => base({ ...p, children: (<><rect width="13" height="13" x="9" y="9" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>) });
export const Film = (p: P) => base({ ...p, children: (<><rect width="18" height="18" x="3" y="3" rx="2" /><path d="m10 9 5 3-5 3z" /></>) });
export const Heart = (p: P) => base({ ...p, children: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /> });
export const MessageCircle = (p: P) => base({ ...p, children: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /> });
export const Share2 = (p: P) => base({ ...p, children: (<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" x2="15.4" y1="13.5" y2="17.5" /><line x1="15.4" x2="8.6" y1="6.5" y2="10.5" /></>) });
export const Globe = (p: P) => base({ ...p, children: (<><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>) });
export const MoreHorizontal = (p: P) => base({ ...p, children: (<><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" /></>) });
export const Bookmark = (p: P) => base({ ...p, children: <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /> });
export const Repeat2 = (p: P) => base({ ...p, children: (<><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>) });
export const ThumbsUp = (p: P) => base({ ...p, children: (<><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></>) });
export const Send = (p: P) => base({ ...p, children: (<><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>) });
export const Eye = (p: P) => base({ ...p, children: (<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>) });
export const Cloud = (p: P) => base({ ...p, children: <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /> });
export const LogOut = (p: P) => base({ ...p, children: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><line x1="21" x2="9" y1="12" y2="12" /></>) });
