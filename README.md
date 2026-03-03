# Genius Inline Button ( GIB EXTENSION)

Extension prête à charger localement dans Chrome / Brave / Edge / Firefox.

## Ce qu'elle fait
- ajoute un petit bouton **Genius** à côté du titre du morceau
- fonctionne sur **YouTube**, **YouTube Music** et **Spotify Web**
- au clic, ouvre l'URL Genius la plus probable via une recherche Google `I'm Feeling Lucky` limitée à `site:genius.com`

## Installation

### Chrome / Brave / Edge
1. Dézippe l'archive.
2. Ouvre `chrome://extensions`.
3. Active **Mode développeur**.
4. Clique sur **Charger l'extension non empaquetée**.
5. Sélectionne le dossier extrait.

### Firefox
1. Dézippe l'archive.
2. Ouvre `about:debugging#/runtime/this-firefox`.
3. Clique sur **Load Temporary Add-on**.
4. Sélectionne le fichier `manifest.json` du dossier extrait.

## Fichiers
- `manifest.json`
- `content.js`
- `content.css`
- `icons/`

## Notes
- le matching dépend du titre/artiste visibles sur la page
- si un site change son HTML, certains sélecteurs pourront nécessiter un ajustement
