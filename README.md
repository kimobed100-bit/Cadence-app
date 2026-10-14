# Cadence — Mon espace éditorial

Petit outil personnel pour savoir **quoi publier, quel jour, et où en est chaque publication**.

Rédigé avec ChatGPT → collé ici → planifié dans le calendrier → copié vers le réseau le jour J.
Aucune connexion aux réseaux sociaux, aucune IA intégrée : juste de l'organisation.

## Lancer l'app

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000

> Sur Windows, si `npm` est bloqué par la politique d'exécution PowerShell,
> utiliser `npm.cmd` : `npm.cmd install` puis `npm.cmd run dev`.

## Utilisation

1. **Dashboard** : ce qui est prévu aujourd'hui, les 5 prochaines publications,
   les compteurs (Planifiées / Brouillons / Publiées) et les 14 prochains jours.
2. **Calendrier** : vues Mois / Semaine. Cliquer un jour vide = créer à cette date.
   Cliquer une publication = la modifier. Glisser-déposer un post pour le déplacer.
3. **Publications** : recherche plein texte, filtres par statut, pilier et réseau,
   export / import JSON (sauvegarde).
4. **Boîte à idées + rythme** (dashboard) : capture d'idée en 5 secondes,
   rappel à l'ouverture s'il y a un post aujourd'hui, graphique des publiés
   par semaine sur 8 semaines + série en cours.

### Fiche publication

- **Formats auto** : Texte, Image ou Vidéo selon ce que tu joins.
  Pas de choix à faire : titre + texte, puis photos/vidéos facultatives
  (jusqu'à 10, sélection multiple). Les photos sont gardées en qualité
  d'origine, sans compression, dans IndexedDB (NoSQL navigateur) même après
  rechargement ; les vidéos restent en session
  (nom conservé, fichier à garder). Aperçu en galerie : carrousel Instagram,
  mosaïque X/Facebook, bandeau LinkedIn.
- **Modèles de démarrage** : juste avant le texte, 6 trames par pilier,
  recliquables à tout moment (remplacement après confirmation).
- **Aperçu fidèle par réseau** : dans le formulaire, le rendu simule vraiment
  chaque plateforme (Facebook, LinkedIn, Instagram, X — texte en haut,
  photo/vidéo en bas) et suit l'onglet actif. Zéro chiffre inventé.
  « Choisir un fichier » donne un aperçu immédiat ; les images légères (≤ 800 Ko)
  sont conservées après rechargement, les vidéos restent référencées par nom/lien.
- **Texte de base** : le post complet collé depuis ChatGPT (+ compteur de caractères).
- **Modèles par pilier** : trame de démarrage en 1 clic quand on crée un post vide.
- **Réseaux ciblés** : LinkedIn, Facebook, Instagram, X.
- **Adaptation auto X + LinkedIn** : « Adapter les textes » réduit intelligemment
  (fin de phrase, mot entier) à 280 / 3000 caractères ; « + tags auto » détecte
  les mots-clés du message (sigles comme IA en premier) et les ajoute en respectant
  les limites (2 max pour X). Instagram/Facebook : pas besoin, on reprend le texte.
- **Thread X** : découpe auto d'un long texte en morceaux numérotés ≤ 280 caractères,
  copiables un par un.
- **Dupliquer** : recopie une fiche en brouillon (depuis la liste ou le formulaire).
- **Statuts simplifiés** : le champ Statut propose **Planifiée** et
  **À terminer** (il manque un lien, un visuel… — pense à le noter).
  « À terminer » se comporte comme un brouillon (bouton Créer désactivé,
  non compté comme planifié) : complémente puis repasse en Planifiée.
  Date obligatoire. Brouillon via le bouton du bas, Publiée via le menu ⋯
  (badge vert encadré vert).
- **URL publiée** : lien manuel vers le post une fois en ligne.

## Données

Stockage **local du navigateur** par défaut (`localStorage` + IndexedDB pour les photos).
**Cloud Supabase (données + médias) :** exécute `supabase/schema.sql` une fois
dans le SQL Editor, ajoute `http://localhost:3000` dans *Auth → URL Configuration →
Redirect URLs*, puis clique **Cloud** dans l'app et reçois ton lien magique.
La première connexion fusionne local + cloud (le plus récent gagne, suppressions
respectées). Les photos/vidéos jointes montent vers le bucket privé en qualité
d'origine (liens signés pour l'aperçu) ; la copie locale reste pour le hors-ligne.
Le panneau Cloud (clic sur ton email) affiche l'état et un bouton **Tester maintenant**.

## Piliers éditoriaux

Éducatif · Démonstration · Problème → Solution · Build in public · Opinion ·
Projet / Cas client. Modifiables dans `src/lib/editorial.ts` (`PILLARS`).

## Stack

Next.js 16 + React 19 + TypeScript + Tailwind CSS v4. Icônes inline
(`src/components/icons.tsx`), aucune dépendance d'icônes.
