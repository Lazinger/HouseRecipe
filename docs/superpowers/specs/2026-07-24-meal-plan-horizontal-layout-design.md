# Planning : grille horizontale sur PC, liste verticale sur mobile — Design

**Date :** 2026-07-24
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

La vue "Planning" (`public/js/meal-plan.js`, styles dans `public/style.css:761-773`) affiche aujourd'hui les 7 jours de la semaine en liste verticale (une carte par jour, empilées), quel que soit la taille d'écran. L'utilisateur veut une vraie grille calendrier horizontale sur PC (les 7 jours côte à côte), tout en gardant la liste verticale actuelle sur mobile.

## Portée retenue

- Changement **CSS uniquement** — aucune modification du HTML généré par `meal-plan.js` ni de sa logique. La structure DOM existante (`.meal-plan-days` > `.meal-plan-day` > `.meal-plan-day-title` + `.meal-plan-slots` > `.meal-plan-slot` > `.meal-plan-slot-label` + bouton) est déjà assez générique pour les deux dispositions ; seule la disposition flex change selon le breakpoint.
- Seuil de bascule : **640px**, le même déjà utilisé partout ailleurs sur ce site pour les adaptations mobile (`public/style.css:331`, `:501`).
- **PC (≥641px, comportement par défaut désormais)** : les 7 `.meal-plan-day` sont côte à côte en colonnes de largeur égale (grille calendrier), chacune avec son titre en haut et ses 2 créneaux Midi/Soir empilés verticalement dedans. À l'intérieur d'un créneau, l'étiquette ("Midi"/"Soir") passe au-dessus du contenu (bouton/nom de recette) au lieu de côte à côte, pour rester lisible dans une colonne étroite.
- **Mobile (≤640px)** : comportement strictement inchangé par rapport à aujourd'hui — jours empilés verticalement, étiquette de créneau côte à côte avec son contenu.
- `.meal-plan-body` passe de `max-width:760px` à `max-width:1080px` (comme `.grid-section`, la grille de recettes principale) pour laisser assez de place à 7 colonnes lisibles sur grand écran. Cette largeur ne change rien sur mobile (l'écran est de toute façon plus étroit que les deux valeurs).
- **Convention d'écriture** : suivant le pattern déjà en place dans ce fichier, la disposition **PC devient la règle de base** (sans media query), et le bloc `@media (max-width: 640px)` déjà existant (`public/style.css:331-336`) reçoit les règles qui ramènent la disposition en vertical pour mobile — inversion du sens actuel, où le vertical est la base sans aucune règle desktop dédiée.

## Détail des règles

**Base (PC, par défaut) :**
- `.meal-plan-body` : `max-width:1080px` (au lieu de 760px).
- `.meal-plan-days` : `flex-direction:row` (au lieu de `column`), les 7 `.meal-plan-day` en `flex:1; min-width:0` pour largeur égale.
- `.meal-plan-day` : `padding` réduit horizontalement (les colonnes sont étroites).
- `.meal-plan-slot` : `flex-direction:column; align-items:stretch` (étiquette au-dessus du contenu).
- `.meal-plan-slot-label` : `width:auto` (la largeur fixe de 44px n'a plus de sens en colonne).

**Mobile (`@media (max-width: 640px)`, ajouté au bloc existant) :**
- `.meal-plan-days` : `flex-direction:column` (retour à l'existant).
- `.meal-plan-day` : `padding` d'origine restauré.
- `.meal-plan-slot` : `flex-direction:row; align-items:center` (retour à l'existant).
- `.meal-plan-slot-label` : `width:44px` (retour à l'existant).

## Hors périmètre

- Aucun changement de `meal-plan.js` (JS/DOM) — uniquement `public/style.css`.
- Aucun changement du sélecteur de recette (`.recipe-picker`), du bouton "Ajouter la semaine au panier", ou de la navigation Précédent/Suivant/Aujourd'hui — ces éléments restent identiques sur les deux tailles d'écran.
- Pas de mode tablette intermédiaire — le seuil unique à 640px suffit, conforme au reste du site.

## Vérification

Pas de suite de tests automatisée (comme le reste du projet) — vérification manuelle dans le navigateur :
- Ouvrir Planning sur un écran ≥641px de large : les 7 jours apparaissent côte à côte en colonnes de largeur égale, chaque colonne lisible (titre du jour + 2 créneaux empilés).
- Réduire la fenêtre en dessous de 640px (ou tester sur mobile) : le planning repasse en liste verticale, identique au rendu actuel avant ce changement.
- Assigner/retirer une recette d'un créneau fonctionne de la même façon dans les deux dispositions (aucun changement de comportement, seulement de mise en page).
- Aucune erreur console sur les deux tailles d'écran.
