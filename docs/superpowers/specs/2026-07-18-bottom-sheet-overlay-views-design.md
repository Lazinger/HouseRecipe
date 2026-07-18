# Feuilles remontantes pour les vues secondaires — Design

**Date :** 2026-07-18
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

Aujourd'hui, `fiche recette`, `ajout/édition de recette`, `panier`, `connexion` et `compte` partagent toutes le même mécanisme visuel `.detail-view` : plein écran, glissement depuis la droite (`transform: translateX(100%→ 0)`), fond opaque qui recouvre entièrement la page d'accueil.

L'utilisateur veut que `fiche recette`, `ajout/édition`, `panier` et `compte` se présentent plutôt comme une **feuille remontant du bas**, par-dessus la page d'accueil assombrie mais visible en transparence — inspiré du modal de fiche recette sur le site HelloFresh (référence visuelle fournie par l'utilisateur), adapté au format téléphone après comparaison de 3 maquettes (carte centrée à marges fines / feuille remontante / petite boîte de dialogue centrée) : la **feuille remontante** a été choisie.

## Portée

**Changent de présentation :** `detailView` (fiche recette), `addView` (ajout/édition de recette), `panierView` (panier), `profileView` (compte).

**Ne change pas :** `authView` (écran de connexion) reste en plein écran, opaque, non-fermable par tap-extérieur — avant authentification, l'accueil n'affiche aucune recette (RLS Supabase bloque la lecture sans session), donc il n'y a rien de significatif à voir "derrière", et l'utilisateur ne doit pas pouvoir contourner la connexion en tapant à côté. Le tiroir de navigation (`drawer`) n'est pas concerné non plus (mécanisme différent, glissement latéral déjà distinct de `.detail-view`).

**Hors périmètre pour cette itération :** geste de balayage (swipe) vers le bas pour fermer la feuille. Le tap sur le fond assombri est le seul mécanisme de fermeture ajouté ; le retour matériel Android (déjà géré via l'écouteur `popstate` existant dans `main.js`) continue de fonctionner sans modification.

## Comportement visuel

- Un fond semi-transparent (`backdrop`) recouvre toute la page, assombrissant la page d'accueil qui reste visible et rendue derrière (elle n'est jamais masquée ou détruite — seul le style visuel change, pas la logique d'affichage du DOM).
- La feuille elle-même est ancrée en bas de l'écran, largeur pleine ou quasi-pleine, coins arrondis en haut uniquement, hauteur fixe occupant environ les 4/5 inférieurs du viewport (le contenu long — étapes de recette, etc. — scrolle **à l'intérieur** de la feuille via le `.detail-scroll` existant, qui ne change pas).
- Animation : glissement du bas vers le haut, même durée et courbe qu'aujourd'hui (`.32s cubic-bezier(.32,.72,0,1)`), seul l'axe change (`translateY` au lieu de `translateX`).
- Un petit indicateur visuel ("grabber", une petite barre horizontale) en haut de la feuille signale qu'il s'agit d'un élément qui se manipule — purement décoratif dans cette itération (pas de geste associé), mais prépare le terrain si le swipe-to-dismiss est ajouté plus tard.

## Fermeture

- **Tap n'importe où sur le fond assombri** (en dehors de la feuille) → ferme la feuille et revient à l'accueil. Réutilise les fonctions de fermeture existantes (`closeDetail`, `closeAddForm`, `closePanier`, `closeProfile`) sans changer leur logique interne.
- Les boutons "Retour" actuellement présents dans l'en-tête de chaque vue sont **supprimés** (markup + écouteur associé) dans `detail.js`, `add-form.js`, `panierScroll`/`cart.js`, `profile.js` — le tap sur le fond les remplace.
- Le retour matériel Android (`popstate` dans `main.js`) n'est pas modifié : il ferme déjà la vue ouverte, ce comportement reste correct avec la nouvelle présentation visuelle.
- Les boutons d'action à l'intérieur de la feuille (Enregistrer, Ajouter au panier, etc.) ne sont pas affectés — seule la navigation "retour" change.

## Implémentation (aperçu, détaillé dans le plan)

- **CSS (`style.css`)** : le gros du changement. Le sélecteur partagé `.detail-view` (et son état `.is-open`) passe d'un plein-écran opaque glissant en X à un modèle backdrop + feuille glissant en Y. `authView` doit explicitement garder l'ancien comportement (nouvelle classe modificatrice, p.ex. `.detail-view.is-fullscreen` ou une classe dédiée sur `#authView`, à trancher dans le plan).
- **JS** : ajout d'un écouteur de clic sur le fond assombri (probablement un seul élément `backdrop` partagé, ou un par vue) qui appelle la fonction de fermeture correspondante ; suppression des boutons/écouteurs "Retour" dans les 4 modules concernés.
- **`CACHE_NAME`** dans `sw.js` doit être incrémenté (convention du projet — tout fichier caché modifié invalide le cache).

## Vérification

Pas de suite de tests automatisée dans ce projet — vérification manuelle dans le navigateur (comme d'habitude), sur téléphone réel ou viewport réduit :
- Ouvrir chacune des 4 vues (recette, ajout, panier, compte) → la feuille remonte du bas, l'accueil est visible et assombri derrière.
- Taper sur le fond assombri → la feuille se ferme, retour à l'accueil, pour chacune des 4 vues.
- Vérifier qu'aucun bouton "Retour" ne subsiste dans ces 4 vues.
- Vérifier que l'écran de connexion reste inchangé (plein écran, pas de fermeture par tap extérieur).
- Vérifier que le bouton retour matériel Android / navigateur (ou `popstate` simulé) ferme toujours la feuille ouverte.
- Recharger deux fois après déploiement pour confirmer la prise en compte du nouveau `CACHE_NAME`.
