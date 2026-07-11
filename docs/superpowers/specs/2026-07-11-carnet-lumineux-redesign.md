# Refonte visuelle "Carnet lumineux épuré" — design approuvé

Statut : **approuvé par l'utilisateur, implémentation pas commencée.**

## Contexte

Le design "carnet-scrapbook" (papier crème `#FBF2DE`, palette corail/sarcelle/ambre saturée, bords "papier déchiré" en `clip-path`, scotch/washi tape, cartes flottantes avec ombres colorées et rotations) ne convient plus. Retours de l'utilisateur, dans l'ordre :

1. Le site fait trop "abstrait, enfantin, minimaliste" et ressemble à une appli e-commerce plutôt qu'à un livre de recette.
2. Direction testée "carnet de Mamie" (kraft/encre/scotch, façon carnet manuscrit familial) → rejetée : trop terne, trop sombre.
3. Variante plus lumineuse/verte de la même direction → rejetée aussi : "c'est moche", trop de vert comme couleur principale, ton crème toujours refusé.
4. Direction finale demandée : **innovant, pur, stylisé, lumineux, sans aucun ton crème**. Couleurs laissées au choix de l'agent.

Trois nouvelles pistes ont été proposées (voir maquettes du companion visuel, session `.superpowers/brainstorm/924-1783754869/`) : (1) blanc & encre avec touche rouge, (2) poster graphique aplats francs, (3) carnet lumineux épuré à une seule couleur bijou (vert émeraude). **L'option 3 a été choisie**, confirmée à la fois sur une page d'accueil et sur une fiche recette.

## Direction retenue : "Carnet lumineux épuré"

Presque blanc (pas crème), une seule couleur bijou dominante (vert émeraude) portée par les titres/accents, une signature manuscrite réservée à la marque uniquement. Minimal mais chaleureux — sans scotch, sans bord de papier déchiré, sans ombres colorées ni rotations de cartes.

### Palette

```
--bg:            #FBFAF6   /* presque blanc, très légèrement chaud — jamais crème/beige */
--surface:       #FFFFFF
--ink:           #20241D   /* noir chaud, pas de brun */
--ink-soft:      #5C6154
--ink-faint:     #8A8F84
--line:          #E4E2D8   /* traits fins de séparation, remplacent les ombres */

--emerald:       #1F5C42   /* couleur principale du site */
--emerald-dark:  #163F2D
--emerald-tint:  #E8F0E4

--terracotta:    #B5533A   /* accent catégorie "plat" uniquement, pas de fond plein */
--mustard:       #B3822A   /* accent catégorie "dessert" uniquement, pas de fond plein */
```

L'émeraude devient la couleur "de marque" (logo, boutons principaux, numéros d'étape, pastilles de stats). Terracotta et moutarde ne servent plus qu'aux petites étiquettes de catégorie (texte, pas de fond saturé plein écran) — cohérent avec "une seule couleur bijou, pas de couleur dominante autre que l'accent principal".

### Typographie

- **Fraunces** (déjà utilisée sur le site), en italique pour les titres de recette et les grands titres (`font-style: italic; font-weight: 600`) — remplace l'usage droit/gras précédent.
- **DM Sans** remplace Inter pour le corps de texte et l'UI (boutons, labels, stats).
- **Caveat** (manuscrite) réservée exclusivement au wordmark "Le Carnet" dans le header — plus aucun autre usage de police manuscrite ailleurs (fini les titres de recette en Caveat testés dans la direction "carnet de Mamie").

### Principes de mise en page

- **Plus de `clip-path` torn/torn-bottom, plus de `.tape`** : ces éléments décoratifs du système scrapbook sont retirés du site. Les séparations se font avec des traits fins `1px solid var(--line)`.
- **Plus d'ombres papier colorées ni de rotations de cartes** (`--shadow-paper`, `transform: rotate(...)` sur les cartes) : mise en page nette, alignée, pas de désordre "scrapbook".
- **Statistiques** (temps/personnes/difficulté) : petites pastilles `background: var(--emerald-tint); color: var(--emerald-dark)`, coins légèrement arrondis (`border-radius: 3-4px`), pas de pilule blanche translucide sur fond coloré.
- **Étapes de préparation** : numéro dans un cercle à contour fin (`border: 1.5px solid var(--emerald)`), pas de disque plein.
- **Liste d'ingrédients** : lignes séparées par un trait fin (`border-bottom: 1px solid var(--line)`), plus de fond alterné en carte.
- **Bouton principal** (ajouter au panier, etc.) : fond plein `var(--emerald)`, texte blanc, `border-radius` léger (3-4px), pas de dégradé ni rotation.
- **Header de fiche recette** : plus de bandeau de couleur plein écran. Le titre (Fraunces italique) est directement sur le fond `--bg`, avec juste une étiquette de catégorie en petit texte coloré au-dessus et un trait de séparation `--line` en bas de la zone.

## Portée

Cette direction remplace entièrement le système "carnet-scrapbook" existant dans `style.css` : tokens `:root` (`--coral`/`--teal`/`--amber`, `--torn`, `--torn-bottom`, `--tape-*`, `--shadow-paper*`), et tous les composants qui les utilisent — header/nav, hero page d'accueil, cartes de recette (grille), fiche recette (dont le header retravaillé la session précédente), panier, formulaire d'ajout de recette, panneau minuteur, tiroir de navigation.

**Après cette implémentation, le sujet design est mis de côté** (demande explicite de l'utilisateur) — pas d'itération supplémentaire sur le style tant qu'il ne le redemande pas.

## Prochaine étape

Passer par le skill `writing-plans` pour découper l'implémentation (probablement : tokens + composants partagés d'abord, puis page par page : accueil, fiche recette, panier, formulaire, minuteur, tiroir de navigation), en vérifiant chaque page dans le navigateur au fur et à mesure.
