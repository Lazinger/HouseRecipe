# Vue impression pour les recettes — Design

**Date :** 2026-07-21
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

L'application n'a aujourd'hui aucune feuille de style d'impression (`@media print`). La fiche recette (`#detailView`) est affichée en superposition plein écran, `position:fixed` avec `overflow:hidden`/`overflow-y:auto` sur ses conteneurs — imprimer directement aujourd'hui (Ctrl+P pendant qu'une recette est ouverte) couperait le contenu à la hauteur d'un seul écran au lieu de s'étaler sur plusieurs pages, et imprimerait aussi tous les éléments d'interface (boutons, minuteur, photo) sans discrimination.

## Portée

- `public/js/detail.js` : nouveau bouton "Imprimer" parmi les actions existantes de la fiche recette (favoris, modifier, supprimer, panier), déclenchant `window.print()`.
- `public/style.css` : nouvelle feuille `@media print` isolant et remettant en page le contenu imprimable de la fiche recette.
- Aucun autre écran (grille, panier, scan, profil) n'a de vue impression dédiée dans ce plan — seule la fiche recette individuelle est concernée.

## Comportement

- Le bouton "Imprimer" n'est visible qu'à l'écran (masqué lui-même à l'impression, comme les autres boutons d'action).
- Au déclenchement de l'impression (bouton, ou Ctrl+P pendant que la fiche est ouverte — les deux passent par la même feuille de style navigateur, donc se comportent pareil) :
  - Seule la fiche recette actuellement ouverte est imprimée — le reste de l'application (en-tête, grille, menu, tout autre écran) est masqué.
  - La photo principale, les photos d'étape, les boutons d'action, le minuteur et le bouton "Voir plus" sont masqués ; la description s'affiche toujours en entier (pas de troncature).
  - La mise en page passe d'ingrédients/étapes côte à côte (2 colonnes à l'écran) à une seule colonne, plus adaptée au papier.
  - Le contenu se comporte comme un document normal (plus de superposition plein écran figée) : il s'étale sur autant de pages que nécessaire au lieu d'être coupé à la hauteur de l'écran.
  - Restent visibles : titre, catégorie, temps/personnes/difficulté, calories/protéines si renseignées, allergènes, ustensiles, liste d'ingrédients, étapes, astuce.
  - Les quantités d'ingrédients et le nombre de personnes reflètent l'état actuel de la fiche à l'écran (si les portions ont été ajustées avec les boutons +/-, l'impression suit ces valeurs, pas les valeurs d'origine de la recette — comportement naturel puisque l'impression capture le contenu déjà affiché, sans logique séparée).

## Hors scope

- Pas de vue impression pour la grille de recettes, le panier, ou tout autre écran — uniquement la fiche recette individuelle.
- Pas d'export PDF dédié ni de mise en page imprimée personnalisable (marges, taille de police, choix des sections à inclure) — seulement le résultat de l'impression navigateur standard.
- Pas de bouton d'impression déporté ailleurs (ex. depuis la grille sans ouvrir la recette).

## Implémentation (aperçu, détaillé dans le plan)

- **`public/js/detail.js`** : ajout d'un bouton (icône imprimante) dans `.detail-actions-row`, câblé sur `window.print()`.
- **`public/style.css`** : bloc `@media print` qui (1) masque tout le corps de la page sauf `#detailView` via la technique `visibility:hidden` globale + `visibility:visible` ciblée (évite d'énumérer chaque écran par son id), (2) redéfinit `#detailView`/`#detailScroll` en flux de document normal (`position:static`, `overflow:visible`, `height:auto`) pour permettre la pagination, (3) masque `.detail-hero`, `.detail-topbar` (contient tous les boutons d'action), `.timer-panel`, `.detail-sub-toggle`, `.step-photo`, (4) force `.detail-sub` à afficher le texte complet (retire le `-webkit-line-clamp`), (5) repasse `.detail-body` en une seule colonne.

## Vérification

Pas de suite de tests automatisée — vérification manuelle dans le navigateur (aperçu avant impression, Ctrl+P) :
- Ouvrir une recette, cliquer "Imprimer" (ou Ctrl+P) → l'aperçu ne montre que le contenu de la recette, pas l'en-tête/la grille/le menu de l'application.
- La photo, les boutons d'action, le minuteur et les photos d'étape n'apparaissent pas dans l'aperçu.
- La description complète s'affiche même si elle était tronquée à l'écran avant le clic sur "Voir plus".
- Ingrédients et étapes s'affichent en une seule colonne, lisibles, et s'étalent sur plusieurs pages si le contenu est long (pas de coupure brutale à la hauteur d'un écran).
- Ajuster les portions avec +/- avant d'imprimer → les quantités imprimées reflètent l'ajustement.
- Aucune erreur console.
