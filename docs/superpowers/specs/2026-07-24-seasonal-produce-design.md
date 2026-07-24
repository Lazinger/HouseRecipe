# Fruits et légumes de saison — Design

**Date :** 2026-07-24
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

L'utilisateur veut un endroit dans l'appli pour voir les fruits/légumes de saison du moment, et pouvoir passer directement des recettes contenant cet ingrédient (ex. taper "Pomme de terre" → liste des recettes qui en contiennent).

## Décision structurante : ids côté saisonnalité, pas sur les recettes

Les recettes stockent déjà leurs ingrédients en texte libre (`ingredients: [string, string][]`, ex. `["Pommes de terre", "500 g"]`), remplies par saisie manuelle, scan photo ou import URL. Ajouter un id canonique à chaque ingrédient de chaque recette demanderait de modifier le schéma, de migrer les recettes existantes, et d'apprendre aux deux prompts Gemini (scan + import URL) à assigner un id fiable à chaque nouvel ingrédient — disproportionné pour ce besoin.

À la place, l'id/canonicalisation vit uniquement côté données de saisonnalité : chaque fruit/légume a un id, un libellé, et une liste d'alias (variantes de texte qui doivent matcher). Le rapprochement avec une recette se fait en comparant ces alias au texte de ses ingrédients, sans toucher au format des recettes ni aux fonctions d'import/scan.

## Portée retenue

- Nouvelle donnée statique intégrée à l'appli (comme `ALLERGENS` dans `recipes-data.js`), pas de table Supabase — ce n'est pas une donnée utilisateur, elle ne change jamais dynamiquement.
- Nouvel écran plein écran "Saison", accessible depuis le tiroir de navigation (même famille de vue que Planning/Import URL).
- Affiche le mois en cours par défaut, avec navigation Précédent/Suivant vers d'autres mois (pas de retour "Aujourd'hui" nécessaire vu qu'un mois suffit à se réorienter, contrairement aux semaines du Planning).
- Pour chaque fruit/légume du mois affiché : libellé + nombre de recettes correspondantes (0 si aucune).
- Taper sur un fruit/légume ferme l'écran Saison et ouvre la grille de recettes principale, filtrée sur cet ingrédient (nouveau mode de filtre, cumulable avec la recherche texte existante mais **pas** avec le filtre de catégorie tabs / favoris — voir "Interaction avec les filtres existants").
- Un chip visible au-dessus de la grille ("Pomme de terre ✕") indique que ce filtre est actif ; cliquer la croix le retire et revient à la liste normale.
- Aucun test automatisé (comme le reste du projet) — vérification manuelle dans le navigateur.

## Modèle de données

Nouveau fichier `public/js/season-data.js` :

```js
export const SEASONAL_PRODUCE = [
  { id: "pomme-de-terre", label: "Pomme de terre", months: [1,2,3,4,5,6,7,8,9,10,11,12], aliases: ["pomme de terre", "pommes de terre", "patate", "patates"] },
  { id: "potiron", label: "Potiron", months: [9,10,11,12], aliases: ["potiron", "citrouille"] },
  // ... ~35-45 entrées au total, fruits et légumes courants du marché français
];
```

- `months` : tableau des mois (1=janvier … 12=décembre) de pleine saison, rédigé à la main par Claude (donnée factuelle stable, pas de génération IA ni de recherche web).
- `aliases` : toujours en minuscules sans accents dans le fichier source ; la comparaison normalise aussi le texte des ingrédients des recettes à la volée (accents/majuscules) au moment du matching, en réutilisant le même principe que `slugify()` dans `recipes-store.js:57` (décomposition NFD + filtrage des diacritiques), factorisé dans une petite fonction `normalizeForMatch()` partagée (nouveau petit utilitaire, ex. dans `public/js/quantity.js` ou un nouveau fichier `text-match.js` si aucun fichier existant n'est un bon foyer naturel — à trancher pendant le plan).
- Aucune donnée ne transite par Supabase : la liste est statique et embarquée dans le bundle JS comme `ALLERGENS`.

## Flux utilisateur

1. Nouvelle entrée "Saison" dans le tiroir de navigation (icône simple, ex. une feuille/plante), à côté de "Planning".
2. La vue "Saison" affiche l'en-tête du mois en cours (ex. "Juillet"), avec des flèches ◀ ▶ pour changer de mois (pas de limite d'années — navigation infinie comme les mois d'un calendrier, en boucle sur `months` 1-12 en changeant l'année affichée implicitement si besoin, mais sans jamais afficher l'année puisque la saisonnalité ne dépend que du mois).
3. En dessous, une liste des fruits/légumes dont `months` inclut le mois affiché, triée alphabétiquement. Chaque ligne affiche le libellé et le nombre de recettes correspondantes entre parenthèses (ex. "Pomme de terre (2)"), y compris "(0)" si aucune.
4. Taper une ligne : ferme la vue Saison, active le filtre saisonnier (`state.seasonalFilter = { id, label, aliases }`), ferme aussi le filtre allergène/catégorie s'il y en avait un incompatible (voir plus bas), et affiche la grille principale avec le chip de filtre actif et la liste filtrée (potentiellement vide, avec l'état vide déjà existant de l'appli).
5. Le chip de filtre saisonnier reste visible tant qu'il est actif, même si l'utilisateur change de catégorie ou fait une recherche texte entre-temps ; cliquer sa croix le retire (`state.seasonalFilter = null`) sans toucher aux autres filtres actifs.

## Interaction avec les filtres existants

- Le filtre saisonnier est un **nouveau critère indépendant**, combiné en ET avec les filtres déjà en place (`state.filter` catégorie/favoris, `state.excludedAllergens`, `state.query` recherche texte) dans `getFilteredRecipes()` (`grid.js`) — pas de mode exclusif.
- Pas de limite au nombre de filtres actifs simultanément (ex. "plat" + exclure gluten + saisonnier "Pomme de terre" + recherche "béchamel" fonctionnent tous ensemble, résultat éventuellement vide).
- Le filtre saisonnier est un état **local, non persistant** (pas de `localStorage`, contrairement aux favoris/allergènes) : il est pensé comme un point d'entrée ponctuel depuis l'écran Saison, pas un réglage durable. Un rechargement de page ou une fermeture de l'appli le réinitialise.

## Composants touchés

- **Nouveau fichier `public/js/season-data.js`** : la liste `SEASONAL_PRODUCE` (donnée statique).
- **Nouveau fichier `public/js/season.js`** : rendu de la vue Saison (mois affiché, navigation, liste des produits avec compteur de recettes calculé via `ALL_RECIPES`), câblage d'ouverture/fermeture (même pattern sheet plein écran que `meal-plan.js`/`import-url.js`), fonction de matching alias ↔ ingrédients recette.
- **`public/js/dom.js`** : nouvel état `state.seasonalFilter` (objet ou `null`, non persistant).
- **`public/js/grid.js`** : `getFilteredRecipes()` ajoute la condition de matching saisonnier ; rendu du chip de filtre actif au-dessus de la grille (nouvelle petite fonction de rendu, similaire au badge du panneau allergènes).
- **`public/index.html`** : nouvelle section `#seasonView` (même structure que `#mealPlanView`), nouvelle entrée `#navSeasonBtn` dans le tiroir de navigation, emplacement du chip de filtre saisonnier au-dessus de la grille.
- **`public/js/main.js`, `public/js/ui.js`** : câblage standard d'une nouvelle vue plein écran, suivant le pattern déjà utilisé par `meal-plan.js`.
- **`public/style.css`** : styles de la vue Saison (en-tête mois + flèches, liste de produits avec compteur) et du chip de filtre actif.
- **`public/sw.js`** : bump `CACHE_NAME`.

## Cas particuliers

- **Fruit/légume sans aucune recette correspondante** : affiché quand même dans la liste Saison avec "(0)" ; le tap ouvre la grille filtrée vide (état "aucune recette" déjà existant).
- **Ingrédient d'une recette qui matche plusieurs alias de produits différents** (rare, ex. un alias trop générique) : chaque produit saisonnier compte la recette indépendamment ; pas de déduplication à gérer, chaque filtre est évalué séparément au moment du tap.
- **Recette ajoutée/modifiée après consultation de l'écran Saison** : le compteur affiché n'est recalculé qu'à l'ouverture de la vue Saison (pas de mise à jour réactive en temps réel pendant que la vue est ouverte) — cohérent avec le reste de l'appli qui ne pousse pas de mises à jour live entre onglets/sessions.
- **Changement de mois pendant que le filtre saisonnier d'un mois précédent est actif** : n'affecte pas le filtre déjà actif sur la grille (ce sont deux états indépendants ; naviguer dans Saison ne referme pas un filtre déjà appliqué ailleurs).

## Hors périmètre (explicitement)

- Toute donnée de saisonnalité par région/pays autre que la France.
- Persistance du filtre saisonnier entre sessions ou synchronisation entre appareils.
- Association d'ids canoniques aux ingrédients des recettes elles-mêmes (voir "Décision structurante" plus haut).
- Suggestions automatiques de recettes de saison (notification, mise en avant sur l'accueil) — seulement la consultation manuelle via l'écran dédié.
- Mode "montrer uniquement les produits avec au moins une recette" (la liste Saison montre toujours tous les produits du mois, y compris ceux à "(0)").

## Vérification

Pas de suite de tests automatisée — vérification manuelle dans le navigateur :
- Ouvrir "Saison" depuis le tiroir : le mois en cours s'affiche avec la bonne liste de produits.
- Naviguer vers le mois précédent/suivant : la liste change en conséquence.
- Un produit avec des recettes correspondantes affiche le bon compteur ; taper dessus ouvre la grille avec le chip actif et uniquement les recettes attendues.
- Un produit à "(0)" ouvre la grille vide (état "aucune recette").
- Combiner le filtre saisonnier avec une recherche texte et/ou un filtre catégorie : le résultat respecte les deux critères à la fois.
- Retirer le filtre via la croix du chip : la grille revient à son état précédent (catégorie/recherche toujours actifs, filtre saisonnier disparu).
- Recharger la page avec un filtre saisonnier actif : il est réinitialisé (comportement attendu, non persistant).
- Aucune erreur console sur l'ensemble de ces parcours.
