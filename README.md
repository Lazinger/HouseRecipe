# Le Carnet — site de recettes

Site statique en HTML / CSS / JS pur (aucune dépendance à installer, aucun build).

## Structure
```
index.html   → structure de la page
style.css    → design (carnet de cuisine, fiches façon classeur)
script.js    → données des recettes + logique (recherche, filtres, favoris)
```

## Utilisation
Ouvrez simplement `index.html` dans un navigateur, ou servez le dossier avec
n'importe quel serveur statique (ex. `npx serve .`).

Les favoris sont stockés dans `localStorage`, donc ils persistent d'une visite
à l'autre sur le même appareil/navigateur.

## Passage en application Android

Le site a été conçu pour être facilement encapsulé dans une WebView, sans
modification majeure :
- pas de dépendance réseau obligatoire (polices Google Fonts en ligne
  uniquement — vous pouvez les rendre locales pour un usage 100 % hors-ligne),
- pas de `localStorage` sensible,
- boutons et zones tactiles dimensionnés pour le doigt,
- écoute de l'événement `popstate` déjà en place pour se brancher sur le
  bouton "retour" matériel Android.

Deux approches courantes pour la suite :

1. **Capacitor** (recommandé si vous voulez du code natif Android/iOS à
   partir de ce même projet web) :
   ```
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init "Le Carnet" "com.example.lecarnet"
   npx cap add android
   npx cap copy
   npx cap open android
   ```
   Placez `index.html`, `style.css`, `script.js` dans le dossier `www/`
   généré par Capacitor avant `npx cap copy`.

2. **WebView Android simple** (si vous préférez un projet Android natif
   minimal) : créez une `WebView` plein écran dans une `Activity`, chargez
   les fichiers depuis `assets/`, et activez JavaScript
   (`settings.javaScriptEnabled = true`). Pour le bouton retour matériel,
   interceptez `onBackPressed()` et appelez `webView.goBack()` ou injectez
   un événement `popstate`.

Pour rendre les polices disponibles hors-ligne, téléchargez les fichiers
`.woff2` de Fraunces, Work Sans et JetBrains Mono et remplacez le lien
Google Fonts dans `index.html` par des règles `@font-face` locales.
