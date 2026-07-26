# Quantités dynamiques dans les étapes — design

## Contexte

Sur la fiche recette, la liste d'ingrédients se met déjà à l'échelle quand on change le nombre de portions (`scaleQuantity` dans [quantity.js](../../../public/js/quantity.js), utilisé dans [detail.js](../../../public/js/detail.js)). Les étapes de préparation (`steps: string[]`), en revanche, sont du texte libre où les quantités sont écrites en dur dans la phrase (ex. `"Ajoutez 200 g de farine"`) — rendues telles quelles à [detail.js:97](../../../public/js/detail.js:97), sans aucune mise à l'échelle.

Contrairement aux ingrédients (une paire nom/quantité déjà structurée), il n'existe aucune structure exploitable dans le texte libre d'une étape pour savoir quel nombre correspond à quel ingrédient. Une extraction par regex sur le texte serait risquée : elle scalerait aussi bien "200 g de farine" (doit changer) que "20 minutes" ou "180°C" (ne doivent jamais changer), sans moyen fiable de distinguer les deux.

## Ce qui change

### Format des étapes

`steps` reste un tableau de chaînes de texte — **aucun changement de structure de données**. Une étape peut désormais contenir zéro ou plusieurs repères de la forme `{{qty:NomIngrédient}}`, où `NomIngrédient` reprend exactement le nom tel qu'il apparaît dans le tableau `ingredients` de la même recette.

Exemple : une recette avec `ingredients: [["Farine", "200 g"], ...]` peut avoir une étape `"Ajoutez {{qty:Farine}} de farine et mélangez."`.

### Prompts Gemini (import uniquement)

`EXTRACTION_PROMPT` (scan photo) et `TEXT_EXTRACTION_PROMPT` (import URL), dans [scan-recipe/index.ts](../../../supabase/functions/scan-recipe/index.ts) et [import-recipe-url/index.ts](../../../supabase/functions/import-recipe-url/index.ts), reçoivent une règle supplémentaire : quand une étape mentionne la quantité d'un ingrédient qui figure dans le tableau `ingredients` de la même réponse, remplacer cette quantité dans le texte de l'étape par `{{qty:NomExactDeLIngredient}}` (nom copié tel quel depuis `ingredients`). Ne jamais faire ça pour des temps de cuisson, températures, tailles de plat/moule, ou toute quantité qui ne correspond pas à un ingrédient de la liste.

Aucun changement du format de sortie global (toujours le même JSON), juste une règle de plus dans le texte du prompt.

### Résolution au rendu

Nouvelle fonction pure dans [quantity.js](../../../public/js/quantity.js) :

```
resolveStepQuantities(step: string, ingredients: [string, string][]) => string
```

Remplace chaque occurrence de `{{qty:Nom}}` dans `step` par la quantité de l'ingrédient dont le nom correspond (comparaison insensible à la casse et aux espaces superflus) dans `ingredients`. Si aucun ingrédient ne correspond (ex. l'ingrédient a été supprimé manuellement après l'import), le repère `{{qty:Nom}}` reste affiché tel quel dans le texte — un signal visible plutôt qu'une disparition silencieuse de l'information.

### Intégration dans la fiche recette

[detail.js](../../../public/js/detail.js) appelle `resolveStepQuantities` pour chaque étape avant de l'afficher, en lui passant la liste d'ingrédients **actuellement affichée** (donc déjà mise à l'échelle par `scaleQuantity` selon le nombre de portions courant) :

- Au rendu initial (ratio = 1, portions d'origine).
- Quand les boutons +/- de portions sont utilisés : la liste d'étapes est régénérée avec les quantités résolues à partir de la liste d'ingrédients nouvellement mise à l'échelle — même mécanisme que la mise à jour existante de la liste d'ingrédients (pas de nouvelle logique de calcul de ratio).

L'impression (`window.print()`) n'a rien de spécifique à changer : elle imprime le DOM déjà rendu, donc les quantités résolues s'impriment normalement.

### Édition manuelle

Le champ de texte d'une étape dans le formulaire "Modifier la recette" ([add-form.js](../../../public/js/add-form.js) / [dyn-rows.js](../../../public/js/dyn-rows.js)) n'a **aucun changement d'interface** — c'est toujours un simple champ texte. Si une étape importée contient `{{qty:Farine}}`, ce texte brut (repère technique inclus) apparaît tel quel dans le champ lors de l'édition. L'utilisateur peut :
- le laisser tel quel → le lien dynamique est conservé après enregistrement ;
- le déplacer dans la phrase, le dupliquer, etc. → toujours résolu au rendu, où qu'il soit dans le texte ;
- l'effacer → l'étape redevient du texte figé, comme avant cette fonctionnalité.

Aucune étape n'est convertie automatiquement dans un sens ou dans l'autre par le formulaire — le repère est juste du texte ordinaire que l'utilisateur manipule comme le reste de la phrase.

### Hors périmètre

- Les 8 recettes déjà en base ne sont **pas** converties rétroactivement (décision explicite de l'utilisateur — contrairement à la normalisation des ingrédients, convertir rétroactivement demanderait de refaire analyser chaque recette par l'IA pour deviner les correspondances quantité/ingrédient sur du texte déjà figé, avec un risque d'erreur plus élevé que ne justifie le bénéfice).
- Le formulaire manuel "Nouvelle recette" n'a aucune assistance pour insérer des repères — un utilisateur pourrait techniquement en taper un à la main et ça fonctionnerait (le mécanisme ne fait aucune distinction entre repère écrit par l'IA ou par un humain), mais ce n'est pas une fonctionnalité qu'on construit ou documente pour l'instant.
- Aucun changement visuel (pas de badge, pas de couleur différente) sur la quantité résolue dans une étape — elle s'affiche comme du texte normal, cohérent avec la liste d'ingrédients qui ne signale pas non plus visuellement qu'une quantité a été recalculée.

## Tests

`resolveStepQuantities` est une fonction pure sans dépendance DOM ni réseau, testable directement avec des exemples représentatifs (repère résolu, repère avec casse/espaces différents, repère sans correspondance qui reste affiché tel quel, étape sans aucun repère qui reste inchangée). La vérification en conditions réelles (rendu fiche recette, changement de portions) se fait ensuite via le navigateur.
