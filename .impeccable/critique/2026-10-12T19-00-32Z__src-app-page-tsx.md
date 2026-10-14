---
timestamp: 2026-10-12T19-00-32Z
slug: src-app-page-tsx
---
# Critique — dashboard + modale de création + aperçus (Content Planner)

Method: dual-agent (A: design review · B: detector + static evidence). No PRODUCT.md/DESIGN.md; judged against incumbent calm zinc Operate world. Detector: type [] + layout [] clean on page.tsx, PostModal.tsx, NetworkPreview.tsx. No browser automation exposed (fallback).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | solid (counts, badges, toast) ; DnD move has no feedback |
| 2 | Match System / Real World | 2 | "En attente / ⋯ → Oui, c'est publié" hides the real act of publishing |
| 3 | User Control and Freedom | 2 | delete/import via blocking native dialogs, no undo |
| 4 | Consistency and Standards | 2 | "Planifiée" (form/filter) vs "En attente" (badges/counts) |
| 5 | Error Prevention | 2 | mandatory date only caught at Save ; X over-limit is red text only |
| 6 | Recognition Rather Than Recall | 2 | publish buried in ⋯ ; icon-only X controls unnamed |
| 7 | Flexibility and Efficiency | 3 | solid (express idea, duplicate, per-row copy) ; no shortcuts/bulk |
| 8 | Aesthetic and Minimalist Design | 3 | solid calm hierarchy ; modal stacks ~10 sections in one scroll |
| 9 | Help Users Recover from Errors | 1 | red error box only ; delete/move/import have no undo |
| 10 | Help and Documentation | 3 | solid (3-step guide, "Rendu simulé", hints) |
| **Total** | | **23/40** | **Acceptable** |

## Design Specificity Verdict

LLM: authored calm Operate planner (zinc/white, micro-labels, black pills, French single-user copy), not interchangeable — breaks only where status language forks and where the creation modal stacks the whole loop in one scroll.
Deterministic scan: `detect.mjs` type + layout clean (0 findings, 3 files). It caught what the review under-weighted: 4 unlabeled filter selects, inputs/labels not programmatically bound, icon-only X controls without names, metadata grammar ("Sais quoi publier"). False positives: overlay click-catcher (intentional), tab icon-only labels on mobile (accessible name kept), color badges (always paired with text). No browser overlay possible (no browser tooling).

## Overall Impression

The daily loop reads instantly ("quoi publier aujourd'hui" above the fold, faithful per-network previews), but publish day — the highest-stakes moment — hides behind ⋯, and the status vocabulary says two different things in two places.

## What's Working

- "Aujourd'hui" + "À venir" + 14-day dots answer the core question above the fold.
- Per-network previews with real constraints (X 280/thread note, LinkedIn "…voir plus", IG carousel).
- Calm inline guidance (3-step guide, rotating idea prompts, pillar templates, "Rendu simulé").

## Priority Issues

- **[P0] Publish is invisible**: critical action lives only inside ⋯; overdue posts linger. Fix: promote a visible publish affordance; keep ⋯ for secondary actions. (`/clarify`, `/layout`)
- **[P1] Status language fork**: "Planifiée" (form/filter/STATUSES) vs "En attente" (badges/counts). Fix: one French term everywhere. (`/clarify`)
- **[P1] Destructive actions without undo**: delete/import via native confirm/alert, drag-move silent. Fix: toast with Annuler; replace native dialogs. (`/harden`)
- **[P2] Modal overload + late date error**: ~10 stacked sections; mandatory date revealed only at Save. Fix: staged disclosure, date asked upfront/pre-filled. (`/layout`, `/onboard`)
- **[P2] Unnamed controls / unbound labels**: icon-only X toggles/tabs, 4 filter selects, hashtag inputs, labels without htmlFor. Fix: aria-labels + programmatic labels. (`/harden`, `/audit`)

## Persona Red Flags

- **Jordan (First-Timer)**: stalls on 6 template pills (replace-after-confirm), misses mandatory date until Save error, never finds publish inside ⋯ ("Clique ici"), confused by "En attente" vs "Planifiée".
- **Sam (keyboard + screen reader)**: no focus trap/return in modal, ⋯ menu without menu semantics, calendar day cells are div-onClick with no keyboard DnD, chart only generically labelled.
- **Casey (distracted mobile)**: bottom-sheet modal is a long scroll with footer actions easily missed, month cells cramped, no draft autosave on interruption.

## Minor Observations

- Metadata "Sais quoi publier…" is ungrammatical (→ "Sache…").
- "quand tu es prêt" assumes masculine; "thread/posts" inside French strings; "Dashboard" tab untranslated.
- next14 strip wraps 4-col on mobile; video-loss caveat is 11px small print; publish toast identical for every post.
- Dropped: "Prête" flagged by review is correct French (publication féminine).

## Questions to Consider

- If marking-as-published is manual by design, why can a post stay "En retard" forever instead of forcing a daily triage?
- What would you remove from the modal if creation had to succeed one-handed in 30 seconds on a phone?
