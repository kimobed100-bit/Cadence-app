"use client";

import { useEffect, useState } from "react";
import { X, Check, Cloud } from "@/components/icons";
import { signInWithEmail } from "@/lib/cloud";

export default function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setSent(false);
    setError("");
    setBusy(false);
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function send() {
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError("Entre un email valide.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signInWithEmail(mail);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-zinc-950/40 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm animate-pop rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Connexion cloud"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-1.5 text-base font-bold text-zinc-900">
            <Cloud size={17} /> Synchroniser avec le cloud
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-2 text-zinc-500 transition-all duration-200 hover:bg-zinc-100 active:scale-90"
          >
            <X size={16} />
          </button>
        </div>
        {sent ? (
          <div className="rounded-xl bg-emerald-50 px-4 py-6 text-center ring-1 ring-emerald-200">
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-800">
              <Check size={15} /> Lien envoyé !
            </p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-emerald-700">
              Ouvre l&apos;email et clique le lien — la synchro démarre toute seule à ton retour ici.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-zinc-500">
              Reçois un lien magique par email, sans mot de passe. Tes publications se synchroniseront entre
              tes appareils.
            </p>
            {error && (
              <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <input
              type="email"
              value={email}
              aria-label="Ton email"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder="toi@exemple.fr"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 [@media(pointer:coarse)]:text-base"
            />
            <button
              onClick={send}
              disabled={busy}
              className="mt-3 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-bold text-white transition-all duration-200 hover:bg-zinc-700 active:scale-95 disabled:opacity-40"
            >
              {busy ? "Envoi…" : "M'envoyer le lien"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
