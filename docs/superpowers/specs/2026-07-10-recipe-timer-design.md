# Minuteur de cuisine — design approuvé (non implémenté)

Statut : **approuvé par l'utilisateur, implémentation pas commencée.**

## Fonctionnalité

Un minuteur de cuisine (compte à rebours) accessible depuis la fiche recette.

## Décisions (issues du brainstorming)

1. **Type** : compte à rebours (pas un chronomètre qui compte de 0). L'utilisateur saisit une durée, ça décompte, alerte à 0. Pas de pré-remplissage avec le temps de préparation de la recette — durée saisie manuellement, sert au suivi de cuisson en général.
2. **Un seul minuteur global** actif à la fois (pas un minuteur par étape, pas plusieurs minuteurs simultanés). Démarrer un nouveau minuteur remplace le précédent.
3. **Persistance en arrière-plan** : le minuteur continue de tourner si on quitte la fiche recette (grille, panier, etc.), et même après un rechargement de page.

## Détails techniques décidés

- **Stockage** : `localStorage`, clé à créer (ex. `carnet-minuteur`). Stocker une **heure de fin absolue** (`endAt` timestamp), pas juste un compteur de secondes — permet de recalculer le temps restant correctement même après mise en arrière-plan de l'onglet ou rechargement complet (`remaining = endAt - Date.now()`), plutôt qu'un simple `setInterval` qui dérive avec le throttling navigateur.
- Champs à stocker : `endAt`, `durationSeconds` (durée originale, pour un éventuel redémarrage), `running` (bool, pour distinguer pause/arrêt), `recipeId` + `recipeTitle` (pour que la pastille puisse rouvrir la bonne fiche via `openDetail(recipeId)`).

## UI

**Sur la fiche recette** (dans `openDetail()`, script.js) : un panneau "Minuteur" — emplacement suggéré : sous les stats (⏱/👤/difficulté) ou près du bouton "Ajouter au panier". Contenu :
- Champ de saisie de durée (minutes), ou boutons rapides +1 min / +5 min
- Affichage MM:SS du temps restant
- Boutons Démarrer / Pause / Réinitialiser

**Pastille persistante** : dans l'en-tête (`.header-actions`, à côté de cart-toggle/fav-toggle), visible seulement si un minuteur est actif ou en pause, affichant le temps restant en MM:SS. Clic → `openDetail(recipeId)` de la recette d'origine.

**Fin du minuteur** :
- Toast "Minuteur terminé !" (`showToast()` existe déjà)
- Bip sonore généré via Web Audio API (`AudioContext` + `OscillatorNode`) — **pas de fichier audio externe**, pour garder l'app 100% hors-ligne (cohérent avec le reste du projet, cf. README).
- `navigator.vibrate(...)` si disponible (bonus mobile/WebView Android).

## Cohérence avec le reste de l'app

- Suivre le style visuel "carnet-scrapbook" déjà en place (voir style.css : `--torn`, `.tape`, `var(--font-display)` = Fraunces, couleurs `--coral`/`--teal`/`--amber`, ombres `--shadow-paper`/`--shadow-paper-sm`).
- Suivre le pattern déjà établi pour les autres vues persistées (favoris = `state.favorites` + localStorage, panier = `cart`/`checkedItems` + localStorage dans script.js).
- `syncBodyScrollLock()` n'a pas besoin d'être touché (le minuteur n'est pas une vue plein écran, juste un panneau + une pastille).

## Prochaine étape

Implémenter : HTML (pastille dans header), CSS (panneau minuteur + pastille, style papier cohérent), JS (état global du minuteur, fonctions start/pause/reset, tick via `setInterval` recalculant depuis `endAt`, rendu du panneau dans `openDetail()`, bip sonore, badge header).
