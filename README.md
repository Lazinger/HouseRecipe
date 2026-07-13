# Le Carnet — site de recettes

Site statique en HTML / CSS / JS pur (aucune dépendance à installer, aucun build).
Fonctionne 100 % hors-ligne : polices auto-hébergées et service worker
(`sw.js`) qui met le site en cache après la première visite.

## Structure
```
index.html     → structure de la page
style.css      → design ("carnet lumineux épuré")
js/            → logique en modules ES (recettes, panier, minuteur, photos, vues...) — voir js/main.js pour le point d'entrée
manifest.json  → manifeste PWA (nom, icône, couleurs)
sw.js          → service worker (mise en cache pour le mode hors-ligne)
fonts/         → Fraunces, DM Sans, Caveat en .woff2 (auto-hébergées)
icons/         → icône de l'app (icons/icon.svg)
```

## Utilisation
Servez le dossier avec n'importe quel serveur statique (ex. `npx serve .`).
Le service worker requiert `http://` ou `https://` — ouvrir `index.html`
directement en `file://` fonctionne pour la navigation, mais sans mise en
cache hors-ligne.

Les favoris et les recettes ajoutées sont stockés dans `localStorage` ; les
photos de recettes sont stockées dans IndexedDB (trop volumineuses pour
`localStorage`). Tout reste sur l'appareil — export/import JSON disponible
dans le menu pour sauvegarder/transférer ses recettes.

## Passage en application Android

Le site a été conçu pour être facilement encapsulé dans une WebView, sans
modification majeure :
- aucune dépendance réseau (polices auto-hébergées, service worker),
- pas de données sensibles en stockage local,
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
