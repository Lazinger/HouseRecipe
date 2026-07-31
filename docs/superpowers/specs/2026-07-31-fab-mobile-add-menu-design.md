# Bouton + : menu d'ajout mobile uniquement — Design

**Date :** 2026-07-31
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

Le bouton flottant `+` (`#addFab`, coin bas-droit) ouvre directement le formulaire d'ajout manuel de recette. Depuis que le menu latéral liste explicitement les 3 façons d'ajouter une recette ("Ajouter une recette", "Scanner une recette", "Importer une URL"), le bouton `+` fait doublon avec la première option et n'a plus vraiment d'utilité propre — surtout sur desktop où le menu est déjà à portée immédiate.

## Décision

- **Desktop (≥768px, seuil déjà utilisé ailleurs dans `style.css`)** : le bouton `+` disparaît entièrement. Le menu latéral reste l'unique point d'entrée pour ajouter une recette.
- **Mobile (<768px)** : le bouton `+` reste visible, mais son clic n'ouvre plus directement le formulaire — il bascule un petit menu déroulant (3 lignes, mêmes icônes que le menu latéral) : Ajouter manuellement / Scanner une recette / Importer une URL.

## Portée

- `public/index.html` : nouveau bloc `#fabMenu` (cachée par défaut), 3 boutons juste au-dessus de `#addFab`, mêmes SVG que `navAddBtn`/`navScanBtn`/`navImportUrlBtn`.
- `public/style.css` :
  - nouveau style `.fab-menu` (petite carte arrondie, `box-shadow` cohérent avec le reste de l'app, positionnée en `fixed` juste au-dessus du bouton).
  - règle `@media (min-width: 768px)` qui masque `.fab` (et donc `.fab-menu`, qui n'a plus de sens sans son déclencheur).
- `public/js/main.js` : le listener de clic sur `addFab` bascule l'affichage de `#fabMenu` au lieu d'appeler `openAddForm()` directement. Les 3 boutons du menu appellent respectivement les fonctions déjà existantes `goToAddRecipe`, `goToScanRecipe`, `goToImportUrl` (aucune nouvelle logique métier — ce sont les mêmes fonctions déjà branchées sur le menu latéral).

## Comportement du menu

- Clic sur `+` : bascule l'affichage de `#fabMenu` (ouvre si fermé, ferme si ouvert) — même pattern que le panneau de filtre allergènes existant (`allergenFilterPanel`/`allergenFilterToggle` dans `main.js`).
- Clic sur une des 3 lignes : lance l'action correspondante et ferme le menu.
- Clic en dehors du menu, ou touche Échap : ferme le menu sans action.
- Le menu ne s'affiche jamais sur desktop (masqué avec le bouton via la même media query).

## Hors scope

- Aucun changement aux fonctions `goToAddRecipe`/`goToScanRecipe`/`goToImportUrl` elles-mêmes, ni aux formulaires qu'elles ouvrent.
- Aucun changement au menu latéral (les 3 entrées y restent, inchangées, pour l'usage desktop).
- Pas de nouvelle donnée, pas de backend — uniquement de l'UI/interaction cliente.
- Pas d'animation d'ouverture élaborée (fade/scale simple suffit, cohérent avec le reste de l'app).

## Vérification

Pas de suite de tests automatisée (UI pure, pas de logique métier nouvelle) — vérification manuelle dans le navigateur, aux deux largeurs :

- **Desktop (≥768px)** : le bouton `+` est absent ; le menu latéral fonctionne comme avant (3 entrées d'ajout inchangées).
- **Mobile (<768px)** :
  - Le bouton `+` est visible.
  - Clic dessus → le petit menu apparaît avec 3 lignes.
  - Clic sur "Ajouter manuellement" → le formulaire d'ajout s'ouvre, menu fermé.
  - Rouvrir le menu, clic sur "Scanner une recette" → la vue scan s'ouvre, menu fermé.
  - Rouvrir le menu, clic sur "Importer une URL" → la vue import s'ouvre, menu fermé.
  - Rouvrir le menu, clic en dehors → le menu se ferme sans action.
  - Rouvrir le menu, touche Échap → le menu se ferme sans action.
- Aucune erreur console sur l'ensemble de ces parcours.
