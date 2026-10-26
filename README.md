# Genius Inline Button (GIB)

Extension Chrome / Brave / Edge / Firefox qui ajoute un petit bouton **Genius** à côté du morceau en cours sur **YouTube**, **YouTube Music** et **Spotify Web**. Un clic et la page des paroles s'ouvre dans un nouvel onglet.

## Ce qu'elle fait

- lit le titre et l'artiste affichés sur la page, au moment du clic
- nettoie ce qui gêne la recherche : (Official Video), [Clip Officiel], (Lyrics), (Remastered 2011), feat., #hashtags, "TheWeekndVEVO", "Daft Punk - Topic"...
- cherche le morceau sur Genius et ouvre directement la bonne page (si "Titre Artiste1 x Artiste2" ne donne rien, elle retente avec un seul artiste, puis avec le titre seul)
- si elle n'est pas sûre du résultat (ou si Genius ne répond pas), elle ouvre la page de recherche Genius plutôt qu'une mauvaise chanson

Sur YouTube, le bouton n'apparaît que sur les vidéos qui ressemblent à de la musique : carte "Musique" de YouTube qui correspond au titre, description "Provided to YouTube by" (vidéos auto-générées, même quand le titre ne contient pas l'artiste), chaîne VEVO ou label, titre "Artiste - Titre", mots comme clip, lyrics, feat. Quand YouTube nomme lui-même le morceau, c'est ce nom-là qui est cherché sur Genius. Pas de bouton sur les Shorts ni sur l'accueil. Sur Spotify, rien pour les podcasts et les pubs.

Astuce : clic molette ou Ctrl+clic pour ouvrir Genius en arrière-plan.

## Installation

Il faut **Chrome / Edge / Brave 121+** ou **Firefox 121+**.

Récupère le projet :

```bash
git clone https://github.com/abateee/GIB-genius-inline-button-.git
```

### Chrome / Brave / Edge

1. Ouvre `chrome://extensions` (ou `edge://extensions`, `brave://extensions`).
2. Active le **Mode développeur**.
3. Clique sur **Charger l'extension non empaquetée** et choisis le dossier du projet.

Chrome peut afficher un avertissement "Unrecognized manifest key 'browser_specific_settings'" : c'est la clé pour Firefox, il l'ignore et l'extension marche normalement.

### Firefox

1. Ouvre `about:debugging#/runtime/this-firefox`.
2. Clique sur **Charger un module complémentaire temporaire**.
3. Choisis le fichier `manifest.json` du projet.

Une extension temporaire disparaît quand tu fermes Firefox, il faut la recharger au prochain lancement.

### Après une mise à jour

Recharge l'extension, puis rafraîchis les onglets YouTube / Spotify déjà ouverts. Tant que l'onglet n'est pas rafraîchi, le bouton ouvre la page de recherche Genius au lieu de la page du morceau.

## Comment ça marche

```
content.js (sur la page)          background.js
  lit titre + artiste      ──►      genius.com/api/search/multi
  lib/parse.js nettoie              lib/match.js choisit la chanson
                                     ouvre l'onglet (tabs.create)
```

- `lib/parse.js` : nettoyage des titres et lecture "Artiste - Titre", sans accès au DOM
- `lib/match.js` : score titre + artiste sur les résultats Genius, traductions Genius ignorées
- `content.js` : un adaptateur par site (sélecteurs CSS), injection du bouton
- `background.js` : appel à Genius, cache en mémoire, ouverture de l'onglet

La recherche passe par le background parce qu'une page web n'a pas le droit d'appeler l'API de Genius (CORS), et qu'un `window.open` après une requête se fait bloquer comme une popup.

## Permissions et vie privée

- `youtube.com`, `music.youtube.com`, `open.spotify.com` : pour afficher le bouton
- `genius.com` : pour chercher le morceau

Le titre et l'artiste ne sont envoyés à Genius qu'au moment où tu cliques. Rien n'est stocké en dehors d'un petit cache en mémoire, vidé quand le navigateur met le background en veille. Aucune autre donnée ne sort.

## Limites connues

- L'API de recherche utilisée est celle du site genius.com, elle n'est pas documentée. Si elle change, l'extension se rabat sur la page de recherche Genius.
- Si YouTube ou Spotify changent leur HTML, les sélecteurs de `content.js` devront être mis à jour.
- Sur YouTube, une chanson postée avec juste son titre, sans carte "Musique" ni mention "clip", "lyrics"..., sur une chaîne qui n'est ni VEVO ni un label, n'aura pas de bouton.

## Développement

Les tests portent sur le parsing et le matching, ils tournent avec Node 18+ sans aucune dépendance :

```bash
npm test
```

`package.json` ne sert qu'à ça : l'extension elle-même n'a besoin d'aucun build.
