# BiblioKemon 🃏

Une petite appli (PWA) pour cataloguer la collection de cartes Pokémon,
connaître leur valeur estimée et suivre son évolution jour après jour.

- **Recherche officielle des cartes** via la base [pokemontcg.io](https://pokemontcg.io)
- **Valeur** : prix moyen de vente Cardmarket (marché européen, en €), avec le
  prix TCGplayer (US, en $) affiché en complément sur la fiche de chaque carte
- **Photo** de la vraie carte prise/choisie à l'ajout
- **Historique** : à chaque ouverture de l'appli (une fois par jour), la cote
  du jour est enregistrée, ce qui dessine une courbe d'évolution par carte
- **Installable** sur l'écran d'accueil du téléphone (fonctionne comme une
  vraie appli, même hors-ligne pour la partie catalogue)

Tout est stocké **sur le téléphone** (aucun compte, aucun serveur perso) :
simple, privé, gratuit à vie.

---

## Déploiement en 5 minutes (GitHub Pages)

### 1. Crée un nouveau dépôt
Sur github.com : bouton **New repository** → nom au choix, ex. `bibliokemon`
→ Public → **Create repository**.

### 2. Ajoute les fichiers
Sur la page du dépôt vide, clique **uploading an existing file**, puis
glisse-dépose **tous les fichiers de ce dossier** (`index.html`, `styles.css`,
`app.js`, `manifest.json`, `sw.js`, et le dossier `icons/` avec les deux
images dedans). Clique **Commit changes**.

### 3. Active GitHub Pages
Dans le dépôt : **Settings** → **Pages** (menu de gauche) →
sous "Build and deployment", choisis **Deploy from a branch** → branche
`main`, dossier `/ (root)` → **Save**.

Attends 1-2 minutes, l'URL de l'appli apparaît en haut de cette page,
du style :

```
https://TON-PSEUDO.github.io/bibliokemon/
```

### 4. Installe-la sur le téléphone de ton fils
- **Android (Chrome)** : ouvrir l'URL → menu ⋮ → **Ajouter à l'écran d'accueil**.
- **iPhone (Safari)** : ouvrir l'URL → bouton Partager → **Sur l'écran d'accueil**.

Une icône **BiblioKemon** apparaît alors comme une vraie appli.

---

## Mettre à jour l'appli plus tard
Pour changer un fichier (ex. le style), modifie-le directement dans GitHub
(bouton crayon ✏️ sur le fichier) et commit — GitHub Pages republie
automatiquement en quelques dizaines de secondes.

## Limites à connaître
- La collection (cartes + photos) est stockée **dans le navigateur du
  téléphone utilisé**. Changer de téléphone = exporter/réimporter (pas encore
  automatisé dans cette v1 — dis-moi si tu veux que je l'ajoute).
- Les cotes se mettent à jour **quand l'appli est ouverte** (au maximum une
  fois par jour). Il n'y a pas de "robot" qui tourne quand le téléphone est
  éteint — ça demanderait un petit serveur en plus, possible mais pas
  nécessaire pour un usage familial.
- Certaines cartes très récentes ou promo peuvent ne pas encore avoir de cote
  sur Cardmarket/TCGplayer : la valeur affichera alors "—" quelques jours.
