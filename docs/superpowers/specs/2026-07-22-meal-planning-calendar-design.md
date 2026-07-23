# Planning de repas — vue calendrier

## Contexte

Remplace le mode "Planifier" éphémère (cases à cocher sur la grille + ajout groupé au panier, livré le 2026-07-22 — voir `docs/superpowers/specs/2026-07-22-meal-planning-batch-cart-design.md`). Après l'avoir testé, l'utilisateur a demandé une vraie planification persistante par calendrier plutôt qu'une sélection ponctuelle et éphémère — et a noté que le bouton "Planifier" ressemblait à une icône de filtre générique, sans rapport avec sa fonction.

## Portée retenue

- Vraies dates, semaines navigables (passé/futur), pas de simple boucle "lundi-dimanche" sans date.
- Deux créneaux nommés par jour : Midi / Soir.
- Le planning est propre à chaque compte (pas partagé entre les comptes du foyer) — même modèle que le panier actuel (RLS `user_id = auth.uid()`), pas celui des recettes (partagées par tout le foyer). Confirmé explicitement après avoir vérifié que les recettes, elles, sont bien partagées par tout compte connecté (`auth.uid() IS NOT NULL`, sans colonne de foyer) — ce n'est délibérément pas le modèle choisi ici.
- Synchronisé via Supabase (nouvelle table), avec le même mécanisme de file d'attente hors ligne que le panier/favoris.
- Nouvelle entrée "Planning" dans le tiroir de navigation, qui ouvre une vue plein écran dédiée — remplace entièrement le bouton "Planifier" de l'en-tête (retiré).
- Un bouton "Ajouter la semaine au panier" sur cette vue ajoute d'un coup toutes les recettes planifiées de la semaine affichée.
- Assignation d'une recette à un créneau : clic sur un créneau vide → sélecteur de recette (recherche + liste, choix ferme le sélecteur).
- Clic sur un créneau déjà rempli → ouvre la fiche recette normale ; un bouton "Retirer" séparé sur le créneau le vide sans l'ouvrir.
- Navigation : flèches Précédent/Suivant + bouton "Aujourd'hui".
- Aucun test automatisé pour cette fonctionnalité (comme pour tout le reste du projet à ce jour) — vérification manuelle. La mise en place de tests automatisés pour le projet en général est explicitement hors périmètre de ce plan, traitée comme une initiative séparée.

## Modèle de données

Nouvelle table `public.meal_plan` :

```sql
create table public.meal_plan (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('midi', 'soir')),
  recipe_id text references public.recipes(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, date, slot)
);

alter table public.meal_plan enable row level security;

create policy "Users manage their own meal plan"
  on public.meal_plan for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

- Clé primaire composite `(user_id, date, slot)` : un seul créneau par jour/moment, upsert naturel pour remplacer une recette déjà planifiée.
- `recipe_id on delete cascade` : si une recette est supprimée, la ligne `meal_plan` correspondante disparaît automatiquement — le créneau redevient vide sans référence fantôme ni erreur à gérer côté client.
- RLS identique à `cart_state`/`favorites` (`user_id = auth.uid()`), pas au modèle "tout le foyer" de `recipes`.
- Migration exécutée manuellement dans le tableau de bord Supabase (SQL Editor → New query → coller le bloc ci-dessus → Run), comme toutes les migrations précédentes de ce projet — pas d'étape automatisée.

## Flux utilisateur

1. Le tiroir de navigation gagne une entrée "Planning" (nouvelle icône calendrier, à côté de "Scanner une recette"/"Importer depuis une URL"). Le bouton "Planifier" de l'en-tête et tout le mode éphémère associé (cases à cocher sur les cartes, barre du bas) sont retirés.
2. La vue "Planning" affiche : un en-tête avec le nom de la semaine ("Semaine du 21 juillet"), des flèches ◀ ▶ pour changer de semaine, un bouton "Aujourd'hui" (revient à la semaine contenant la date du jour). En dessous, une liste verticale de 7 jours (lundi à dimanche de la semaine affichée), chacun avec ses deux créneaux Midi/Soir empilés ou côte à côte.
3. Un créneau vide affiche un bouton "+". Cliquer dessus ouvre un sélecteur de recette (liste de toutes les recettes avec un champ de recherche en haut, filtrage en direct comme la grille principale). Choisir une recette l'assigne au créneau et ferme le sélecteur.
4. Un créneau rempli affiche le titre (et la photo si disponible) de la recette assignée, plus un petit bouton "Retirer" séparé. Cliquer sur le créneau (hors bouton Retirer) ouvre la fiche recette normale. Cliquer sur "Retirer" vide le créneau sans rien ouvrir.
5. Un bouton "Ajouter la semaine au panier" en haut ou en bas de la vue ajoute d'un coup toutes les recettes des créneaux remplis de la semaine actuellement affichée (ignore les créneaux vides). Désactivé si la semaine affichée est entièrement vide.
6. Le planning persiste entre sessions et appareils (synchronisé via Supabase, propre à chaque compte) — contrairement à l'ancien mode "Planifier", rien ne se vide silencieusement en quittant la vue.

## Composants touchés

- **Supabase** : migration SQL (table `meal_plan` + RLS ci-dessus), note de déploiement manuel (comme pour le filtre allergène et l'import URL).
- **Nouveau fichier `public/js/meal-plan.js`** : chargement/sauvegarde du planning (Supabase + file d'attente hors ligne via `write-queue.js`, même pattern que `cart.js` — `registerHandler("meal_plan", ...)`, `enqueue("meal_plan", `${date}:${slot}`, payload)` avec une clé de file distincte par créneau pour que plusieurs modifications hors ligne sur des créneaux différents ne s'écrasent pas entre elles dans la file), rendu de la semaine affichée, navigation semaine précédente/suivante/aujourd'hui, ouverture du sélecteur de recette, retrait d'un créneau, bouton d'ajout groupé au panier (réutilise `addRecipesToCartBatch` déjà existant dans `cart.js`).
- **`public/index.html`** : nouvelle section de vue (`#mealPlanView`, même structure de sheet plein écran que `#panierView`/`#scanView`/`#importUrlView`), nouvelle entrée `#navMealPlanBtn` dans le tiroir de navigation avec une icône calendrier.
- **`public/js/dom.js`, `public/js/main.js`, `public/js/ui.js`** : câblage standard d'une nouvelle vue plein écran (ouverture/fermeture, historique de navigation, verrouillage du défilement du corps de page), suivant exactement le pattern déjà utilisé par `import-url.js`.
- **Retrait du mode "Planifier" actuel** : suppression de `#planBtn`, `#planBar`, des cases à cocher sur les cartes (`.card-plan` dans `grid.js`), et de tout le code associé ajouté par le plan du 2026-07-22 dans `grid.js`/`cart.js`/`main.js`/`style.css`/`index.html` — `addRecipesToCartBatch` dans `cart.js` est conservé (réutilisé par la nouvelle vue), tout le reste lié spécifiquement à l'ancien mode éphémère est retiré.
- **`public/style.css`** : styles de la vue Planning (liste de jours, créneaux vides/remplis, sélecteur de recette), retrait des styles de l'ancien mode Planifier devenus orphelins.
- **`public/sw.js`** : bump `CACHE_NAME`.

## Cas particuliers

- **Recette supprimée alors qu'elle était planifiée** : `on delete cascade` fait disparaître la ligne `meal_plan` correspondante automatiquement — le créneau redevient vide sans action côté client.
- **"Ajouter la semaine au panier" avec des créneaux vides** : ignore les créneaux vides, n'ajoute que les recettes réellement planifiées. Bouton désactivé si la semaine affichée est entièrement vide (même logique que l'ancien bouton du mode Planifier).
- **Recette déjà présente au panier** : `addRecipeToCart` la remplace simplement (comportement déjà existant, inchangé).
- **Hors ligne** : le planning se charge depuis le cache local le plus récent au démarrage de la vue ; les modifications (assigner/retirer un créneau) sont mises en file d'attente et resynchronisées au retour du réseau, avec une clé de file par créneau (voir Composants touchés) pour ne pas perdre de modifications concurrentes sur des créneaux différents.
- **Navigation vers une semaine sans jamais avoir chargé ce planning** : tous les créneaux de cette semaine s'affichent vides tant qu'aucune donnée Supabase ne les remplit — pas de distinction visuelle entre "vide car jamais planifié" et "vide car réseau indisponible" (hors périmètre, comme le reste de l'app en mode hors ligne).
- **Aucun test automatisé** : vérification manuelle dans le navigateur. Contrairement aux fonctionnalités précédentes, cette vue dépend entièrement d'une vraie session Supabase authentifiée pour son chargement/sauvegarde réels (pas de contournement possible en injectant des données côté client comme pour la grille) — le plan d'implémentation documentera précisément ce qui reste vérifiable statiquement (rendu de la structure, navigation entre semaines avec des données injectées en mémoire) vs. ce qui nécessitera un test manuel de l'utilisateur après déploiement de la migration Supabase.

## Hors périmètre (explicitement)

- Mise en place de tests automatisés pour le projet (traité comme une initiative séparée).
- Partage du planning entre comptes du foyer (chaque compte a son propre planning, comme le panier).
- Plus de deux créneaux par jour, ou créneaux personnalisables/renommables.
- Distinction visuelle "jamais planifié" vs. "hors ligne" pour un créneau vide.
- Réintroduction ultérieure d'un mode de sélection rapide/éphémère en plus du calendrier (l'ancien mode "Planifier" est retiré, pas conservé en option).
