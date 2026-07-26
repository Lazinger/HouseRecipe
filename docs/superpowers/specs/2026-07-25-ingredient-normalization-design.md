# Normalisation des ingrédients à l'import — design

## Contexte

Aujourd'hui, `sanitizeExtractedRecipe` (dans [scan-recipe.js](../../../public/js/scan-recipe.js)) fait un tout petit nettoyage des ingrédients extraits par Gemini : si la quantité est vide, elle essaie d'en extraire une depuis le début du nom via `splitLeadingQuantity` (ex. `"1 pièce(s) Poireau"` → `["Poireau", "1 pièce(s)"]`). Cette fonction est partagée par les deux chemins d'import IA :
- **scan photo** ([scan-recipe.js](../../../public/js/scan-recipe.js)) — appelle `sanitizeExtractedRecipe` directement.
- **import URL** ([import-url.js](../../../public/js/import-url.js)) — réutilise la même fonction (`import { sanitizeExtractedRecipe } from "./scan-recipe.js"`).

Ce point d'entrée unique est déjà le bon endroit pour la nouvelle normalisation : aucun changement de prompt Gemini n'est nécessaire, et les deux chemins d'import en bénéficient automatiquement sans dupliquer de logique.

Le formulaire manuel "Nouvelle recette" ([add-form.js](../../../public/js/add-form.js)) n'est **pas concerné** — il n'appelle pas `sanitizeExtractedRecipe`, et la demande porte explicitement sur l'import.

## Ce qui change

Une nouvelle fonction pure `normalizeIngredientPair(name, qty)` dans [quantity.js](../../../public/js/quantity.js), qui remplace la logique actuelle de fixup dans `sanitizeExtractedRecipe`. Pour chaque paire `[nom, quantité]` extraite :

1. **Si la quantité est vide et que le nom commence par une quantité + unité** (ex. `"1 cuillère à soupe d'huile d'olive"`), on extrait la quantité, l'unité, et on retire le connecteur `de`/`d'` pour ne garder que l'ingrédient dans le nom.
2. **Reconnaissance des unités ciblées**, insensible à la casse et aux variantes d'écriture courantes :
   - `cuillère(s) à soupe`, `c. à soupe`, `c à s`, `càs` → **`CS`**
   - `cuillère(s) à café`, `c. à café`, `c à c`, `càc` → **`CC`**
   - `pincée(s)` → **`pinc.`**
   - `gousse(s)` → reste `gousse`/`gousses` (accord singulier/pluriel selon la valeur), pas d'abréviation — juste la structure nom/quantité qui est nettoyée si l'unité était collée au nom.
   - Toute autre unité (g, ml, pièce(s), etc.) n'est **pas modifiée**, seulement recopiée telle quelle.
3. **Majuscule initiale** sur le nom final (seule la première lettre change, le reste de la chaîne est inchangé).

Cette normalisation s'applique que la quantité soit déjà séparée par Gemini (ex. `["Huile d'olive", "1 cuillère à soupe"]` → abrégé en `"1 CS"`) ou encore collée dans le nom (cas géré aujourd'hui uniquement pour les unités à un seul mot).

### Exemples

| Entrée (nom, qté) | Sortie (nom, qté) |
|---|---|
| `"1 cuillère à soupe d'huile d'olive"`, `""` | `"Huile d'olive"`, `"1 CS"` |
| `"Huile d'olive"`, `"1 cuillère à soupe"` | `"Huile d'olive"`, `"1 CS"` |
| `"farine"`, `"200 g"` | `"Farine"`, `"200 g"` |
| `"2 gousses d'ail"`, `""` | `"Ail"`, `"2 gousses"` |
| `"sel"`, `"1 pincée"` | `"Sel"`, `"1 pinc."` |
| `"1 càc de vanille"`, `""` | `"Vanille"`, `"1 CC"` |

### Ce qui ne change pas

- Aucun changement des prompts Gemini (`EXTRACTION_PROMPT` / `TEXT_EXTRACTION_PROMPT`).
- Le formulaire manuel "Nouvelle recette" reste inchangé (pas de normalisation automatique).
- Les nombres eux-mêmes ne sont pas reformatés (une virgule décimale reste une virgule).
- Aucun changement sur les étapes (steps) — ça fait l'objet d'une spec séparée (quantités dynamiques dans le pas-à-pas).

## Application rétroactive aux recettes existantes

À la demande explicite de l'utilisateur, les recettes déjà en base (8 lignes dans `public.recipes`) sont aussi mises à jour, pas seulement les futurs imports.

**Démarche :**
1. Récupérer `id` + `ingredients` de toutes les recettes via Supabase (projet `bmotbwubruvsrflaufis`).
2. Appliquer `normalizeIngredientPair` (le même code que celui utilisé à l'import, exécuté localement via Node) à chaque paire de chaque recette.
3. Ne garder que les recettes dont au moins une paire change réellement.
4. **Présenter un avant/après** à l'utilisateur pour validation avant d'écrire quoi que ce soit.
5. Une fois approuvé, appliquer les `UPDATE` uniquement sur les lignes concernées (via `execute_sql`, pas de migration de schéma).

Cette étape est un nettoyage ponctuel de données, pas un comportement du produit — elle ne sera pas rejouée automatiquement plus tard (cohérent avec le fait qu'un futur correctif ne répare jamais rétroactivement les données déjà en base, sauf demande explicite comme ici).

## Tests

`normalizeIngredientPair` est une fonction pure sans dépendance réseau ni DOM — testable directement avec les exemples ci-dessus (table de cas) avant tout appel réel à Gemini. La vérification en conditions réelles (scan photo + import URL) se fait ensuite via le navigateur, comme pour les correctifs précédents sur ces mêmes fichiers.
