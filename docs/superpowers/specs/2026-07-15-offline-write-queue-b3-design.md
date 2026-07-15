# B3 — File d'attente d'écriture hors-ligne

Date : 2026-07-15
Statut : approuvé, prêt pour plan d'implémentation

## Contexte

Aujourd'hui, le comportement hors-ligne est incohérent selon le type de donnée :

- **Recettes** (`recipes-store.js`) : `saveRecipe`/`deleteRecipeRemote` font un `await` bloquant sur l'appel Supabase et `throw` en cas d'échec. Hors-ligne, l'ajout/édition/suppression d'une recette échoue entièrement — rien n'est sauvegardé, même localement — et l'utilisateur voit "Impossible d'enregistrer la recette. Vérifie ta connexion."
- **Favoris et panier** (`recipes-store.js` fonctions favoris, `cart.js`) : mise à jour locale instantanée (state + `localStorage`), puis écriture Supabase en fire-and-forget (`.then(() => {}).catch(() => {})`). Si l'écriture échoue (hors-ligne ou autre), elle est perdue silencieusement et **jamais réessayée** — l'état local et le serveur divergent définitivement jusqu'à la prochaine modification.

B3 unifie ces deux comportements : toute écriture (recette, favori, panier) réussit **toujours** instantanément côté local, et une file d'attente persistante réessaie l'envoi vers Supabase dès que la connexion revient.

## Architecture

Nouveau module `public/js/write-queue.js`, avec un nouvel object store IndexedDB `write-queue` dans la base existante `carnet-sync` (`DB_VERSION` passe de 1 à 2).

Chaque entrée de la file a une clé composite `${type}:${key}` :
- `recipe:<recipeId>` — payload `{ op: "upsert" | "delete", recipe? }`
- `favorite:<recipeId>` — payload `{ isFavorite: boolean }`
- `cart:main` — payload `{ items, checked }` (état complet, une seule clé globale car `cart_state` est déjà un upsert mono-ligne par utilisateur)

**Coalescing : une seule opération en attente par clé.** Enqueue sur une clé déjà présente en file remplace l'entrée existante plutôt que de s'empiler. Ça couvre naturellement :
- édition puis suppression de la même recette hors-ligne → seule la suppression reste en file
- bascule d'un favori deux fois hors-ligne → la dernière opération enregistrée reflète l'état voulu
- plusieurs modifs du panier hors-ligne → un seul upsert final envoyé

API exposée par `write-queue.js` :
- `enqueue(type, key, payload)` — écrit/remplace une entrée dans l'object store
- `flush()` — parcourt la file dans l'ordre, appelle le handler Supabase correspondant à `type`, retire l'entrée en cas de succès
- `getQueueSize()` / `onQueueChange(callback)` — pour le badge UI, découplé du DOM

## Intégration

**`recipes-store.js`** — `saveRecipe`/`deleteRecipeRemote` appliquent d'abord la mise à jour locale (comme aujourd'hui pour le cache réussi), puis tentent l'écriture Supabase. En cas d'échec, au lieu de `throw`, appellent `enqueue("recipe", id, {...})`. Les appelants (`add-form.js`, `detail.js`) n'ont plus besoin de bloquer/afficher d'erreur sur cet échec — l'opération réussit toujours du point de vue utilisateur ; leurs blocs `catch` actuels ("Impossible d'enregistrer…", "Impossible de supprimer…") sont supprimés.

**Favoris (`recipes-store.js`) et panier (`cart.js`)** — `syncFavoriteRemote`/`syncCartRemote` gardent leur comportement optimiste, mais remplacent leur `.catch(() => {})` silencieux par `enqueue(...)`.

**Déclenchement du flush :**
1. `window.addEventListener("online", () => flush())`
2. Un appel à `flush()` au démarrage de l'app (dans `main.js`, après l'auth), pour couvrir le cas où l'app a été fermée hors-ligne et rouverte déjà en ligne sans jamais recevoir l'événement `online`.

**Transitoire vs permanent :** `flush()` ne s'exécute que lorsqu'on est censé être en ligne (déclenché par `online` ou au démarrage). Une erreur rencontrée pendant le flush est donc traitée comme un **échec réel** (violation RLS, recette supprimée entre-temps par l'autre compte, etc.) : l'entrée sort de la file et un toast d'erreur informe l'utilisateur que la synchronisation a échoué. Si le réseau retombe en pleine exécution du flush (erreur réseau franche plutôt qu'une réponse Supabase), le flush s'arrête immédiatement et les entrées restantes restent en file pour le prochain déclenchement — aucune perte.

## Indicateur visuel

Un petit point discret sur `#accountIcon` dans la topbar (même pattern que `#cartBadge`), visible dès que la file contient au moins une entrée, caché sinon (`title="Synchronisation en attente"` pour l'accessibilité). Pas de compteur numérique. Disparaît automatiquement une fois le flush terminé avec succès. Rendu géré par `profile.js` (ou le module propriétaire de `accountIcon`) via `onQueueChange`.

## Service worker

Aucun changement de logique : `write-queue.js` rejoint `APP_SHELL` comme les autres modules JS, `CACHE_NAME` est incrémenté en conséquence.

## Hors scope

- Résolution de conflits multi-appareils (reste last-write-wins, inchangé).
- File d'attente pour la lecture (pull) — B1 gère déjà le fallback offline en lecture.
- Retry avec backoff exponentiel ou tentatives multiples par entrée — un seul flush par déclenchement suffit (YAGNI).

## Tests / vérification

- Simuler hors-ligne (DevTools → offline) : ajouter une recette, basculer un favori, modifier le panier → tout doit réussir instantanément en local, badge apparaît.
- Repasser en ligne → badge disparaît, vérifier en base Supabase que les 3 écritures sont arrivées.
- Éditer puis supprimer la même recette hors-ligne → vérifier qu'une seule opération (delete) est en file avant flush.
- Fermer l'app hors-ligne, la rouvrir déjà en ligne → flush au démarrage vide la file sans action utilisateur.
- Forcer un échec permanent (ex. tenter de synchroniser une recette dont l'id a été supprimé côté serveur par l'autre compte) → toast d'erreur, entrée retirée de la file.
