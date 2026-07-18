# Présentation responsive des vues secondaires (dialogue PC / plein écran mobile) — Design

**Date :** 2026-07-18
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

La feuille remontante (bottom sheet) livrée plus tôt aujourd'hui pour `detailView`, `addView`, `panierView`, `profileView` ne convient pas telle quelle : sur PC, l'utilisateur veut un vrai dialogue centré (comme la modale de fiche recette de HelloFresh, référence visuelle fournie), pas un panneau ancré en bas ; sur mobile, il veut un plein écran classique avec fermeture par le geste natif du téléphone (balayage retour iOS, bouton/geste retour Android), pas de feuille avec fond assombri. Un bug de centrage horizontal a aussi été repéré sur la version actuelle (marges gauche/droite asymétriques sur grand écran) — ce mécanisme de centrage est remplacé par ce design, donc corrigé de fait, mais la nouvelle implémentation doit être testée explicitement sur un viewport large pour confirmer un centrage correct.

## Portée

Concerne les 4 mêmes vues que le travail précédent : `detailView` (fiche recette), `addView` (ajout/édition), `panierView` (panier), `profileView` (compte). `authView` reste plein écran, non fermable, glissant depuis la droite — inchangé, comme décidé précédemment.

**Nouveau dans ce design :** le titre "Le Carnet" dans l'en-tête devient cliquable (lien retour accueil).

## Seuil responsive

768px de largeur d'écran (seuil classique mobile/tablette), validé par l'utilisateur. En dessous : présentation mobile. À partir de : présentation PC.

## Présentation PC (≥768px) — dialogue centré

- Carte centrée verticalement **et** horizontalement dans le viewport, avec une marge visible sur les 4 côtés (contrairement à la feuille ancrée en bas d'aujourd'hui).
- Coins arrondis sur les 4 coins (pas seulement en haut).
- Largeur maximale ~720px (plus proche des proportions de la référence HelloFresh qu'un large panneau).
- Hauteur : la carte s'adapte à son contenu jusqu'à une hauteur maximale raisonnable (le contenu long — étapes de recette, etc. — scrolle à l'intérieur via `.detail-scroll`, comme aujourd'hui), avec une marge minimale garantie en haut et en bas du viewport même pour un contenu court ou long.
- **Bouton ✕** : cercle blanc flottant, positionné en haut à droite, chevauchant légèrement le bord de l'image d'en-tête (comme sur la référence visuelle) — remplace/s'ajoute au mécanisme de fermeture.
- Fermeture par le ✕ **ou** par tap sur le fond assombri autour de la carte (les deux coexistent, confirmé par l'utilisateur).
- Le fond assombri (`#sheetBackdrop`) reste un unique élément partagé, inchangé dans son principe (juste son opacité/couverture, déjà correcte dans le mécanisme actuel — seul le centrage de la carte elle-même doit être corrigé).

## Présentation mobile (<768px) — plein écran

- La vue recouvre tout l'écran (comme avant toute la refonte du jour) : pas de marge visible, pas de coins arrondis, pas de fond assombri visible (il n'y a rien de significatif à voir "derrière" en plein écran).
- Glissement depuis la droite (`translateX`), pas depuis le bas — reprend le comportement d'origine du projet avant la refonte bottom-sheet.
- Pas de "grabber" (le repère visuel de la feuille remontante n'a plus de sens en plein écran).
- Pas de bouton ✕ visible ni de bouton "Retour" — la fermeture se fait exclusivement via le geste natif du téléphone (voir section suivante). C'est un choix délibéré de l'utilisateur (cohérent avec la suppression des boutons "Retour" plus tôt aujourd'hui).

## Fermeture par geste natif (mobile) — mécanisme technique

Pour que le geste système (balayage retour iOS, bouton/geste retour Android, et toujours le pont WebView Android déjà géré) fonctionne, l'app doit s'appuyer sur l'historique de navigation du navigateur (`history.pushState`/`popstate`), pas seulement sur des classes CSS togglées en JS comme aujourd'hui :

- Ouvrir une vue **depuis l'accueil** (aucune autre vue déjà ouverte) ajoute une entrée d'historique.
- Empiler une seconde vue par-dessus une vue déjà ouverte (ex. ouvrir le panier depuis une fiche recette) **n'ajoute pas** de nouvelle entrée d'historique — cohérent avec la décision prise précédemment que fermer doit tout refermer d'un coup et ramener à l'accueil, pas dévoiler la vue du dessous. Un seul geste retour (ou un seul appel `history.back()`) ramène donc toujours directement à l'accueil, quel que soit le nombre de vues empilées.
- Passer directement d'une vue à une autre sans repasser par l'accueil (ex. "Modifier" depuis une fiche recette, qui ferme la fiche et ouvre le formulaire) **remplace** l'entrée d'historique courante (`history.replaceState`) plutôt que d'en empiler une nouvelle — un retour depuis le formulaire d'édition ramène directement à l'accueil, pas à la fiche recette d'origine. C'est une conséquence assumée du choix "un seul niveau d'historique par groupe de vues empilées", à valider en la testant.
- Le bouton ✕ (PC) et le tap sur le fond assombri (PC) utilisent ce **même mécanisme** (`history.back()`) plutôt que de fermer directement — ainsi la fermeture reste cohérente et centralisée quel que soit son déclencheur (geste natif, ✕, tap fond, bouton retour Android existant), toute la logique de fermeture visuelle réelle continue de passer par le même point d'entrée (`popstate`) qu'aujourd'hui.

## Titre "Le Carnet" cliquable

Comportement identique au bouton "Toutes les recettes" du menu de navigation (`goToAllRecipes()`) : ferme toute vue ouverte, réinitialise la recherche et le filtre de catégorie à "Tout", retour à l'accueil.

## Vérification

Pas de suite de tests automatisée — vérification manuelle dans le navigateur, à tester explicitement :
- Sur un viewport large (≥768px) : la carte est bien centrée horizontalement ET verticalement, marges symétriques des 2 côtés (corrige le bug de centrage repéré), ✕ fonctionne, tap sur le fond assombri fonctionne.
- Sur un viewport étroit (<768px) : plein écran, glissement depuis la droite, pas de fond visible.
- Redimensionner la fenêtre de part et d'autre de 768px avec une vue ouverte (si possible) pour confirmer qu'il n'y a pas d'état visuel cassé au changement de seuil.
- Simuler le retour (popstate) avec une seule vue ouverte → retour accueil direct.
- Simuler l'empilement (fiche recette puis panier) puis un seul retour → retour accueil direct (pas d'étape intermédiaire).
- Simuler "Modifier" depuis une fiche recette puis un retour → retour accueil direct (comportement assumé, à confirmer visuellement que ce n'est pas déroutant).
- Cliquer le titre "Le Carnet" avec un filtre/recherche actif → tout se réinitialise et revient à l'accueil.
