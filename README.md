# 🚀 DevHub — Version HTML / CSS / JS pur (sans npm, sans build)

Même site que la version React, mais en fichiers classiques — comme tes autres
projets (ISEN-NOTE, Projet Alpha). Pas de `npm install`, pas de Vite, pas de JSX.
Juste 3 fichiers : `index.html`, `style.css`, `app.js` (+ `firebase-config.js`).

---

## 1. Lancer le site en local

Il faut un petit serveur local (pas juste double-cliquer sur `index.html`) car
les `import` JavaScript et Firebase ont besoin du protocole `http://`, pas `file://`.

Dans ce dossier, ouvre un terminal et tape :

```bash
python -m http.server 8000
```

(ou `python3 -m http.server 8000` selon ton install)

Puis ouvre **http://localhost:8000** dans ton navigateur.

> Tu peux aussi utiliser l'extension VS Code **Live Server** si tu préfères, ça marche pareil.

---

## 2. Connexion Firebase

`firebase-config.js` est **déjà rempli** avec les identifiants de ton projet `alpha-b5f6a`.
Tu n'as rien à modifier pour tester en local.

⚠️ Avant que le site fonctionne complètement, va dans la **Console Firebase** :

### a) Authentication
- **Authentication → Sign-in method** → active **Email/Password**
- **Authentication → Users → Add user** → crée ton compte (email + mot de passe)
  → C'est ce compte qui te connectera en tant que modérateur sur le site.

### b) Realtime Database
- **Realtime Database → Rules** → colle le contenu de `database.rules.json` (fourni dans ce dossier), puis **Publier**.

> ℹ️ Pas de Firebase Storage ici : depuis fin 2024, Storage nécessite le plan payant Blaze
> même pour rester dans le quota gratuit. Pour éviter ça, le téléchargement de code se fait
> via un **lien GitHub** (ou Drive, releases...) au lieu d'un upload direct de `.zip`.

---

## 3. Utiliser le site

- **🔒 Connexion** (en haut à droite) → entre l'email/mot de passe créé à l'étape 2a
- **⚙ Admin → 👥 Membres** → ajoute-toi (et tes collaborateurs)
- Sur l'accueil, bouton **+ Créer** → ajoute un projet :
  - 🌐 **Site en ligne** → colle l'URL
  - 📄 **Intégrer le projet** → colle ton HTML/CSS/JS dans 3 champs séparés, ou dépose un `.zip` (détection automatique de `index.html` / `style.css` / `script.js` — ceci reste possible car le zip est lu directement dans le navigateur, sans passer par Storage)
  - 📦 **Téléchargement** → colle un lien vers ton repo GitHub (ou Drive, releases...)
- Ouvre un projet → **⚡ Push** pour ajouter une mise à jour → ça apparaît dans le bandeau, en popup, et dans l'historique

---

## 4. Mettre le site en ligne (gratuit, Firebase Hosting)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```

Pendant `firebase init` :
- Sélectionne ton projet Firebase `alpha-b5f6a`
- Dossier public : **`.`** (le dossier courant, puisqu'il n'y a pas de build)
- Configurer en single-page app : **Oui**

Puis pour mettre en ligne :

```bash
firebase deploy
```

> Note : `npm install -g firebase-tools` installe un outil en ligne de commande (une seule fois,
> globalement sur ton PC) — ce n'est pas lié au projet lui-même, donc ça reste cohérent avec
> l'approche "pas de build" du site en lui-même.

---

## 📁 Structure du projet

```
devhub-vanilla/
├── index.html           → page unique, charge style.css et app.js
├── style.css             → tout le design
├── app.js                 → toute la logique (rendu, modals, interactions)
├── firebase-config.js     → connexion Firebase (Auth, Realtime DB)
└── database.rules.json    → règles de sécurité de la base de données
```

---

## 🔒 Sécurité : la clé Firebase visible dans le code, c'est normal

Contrairement à un mot de passe, la `apiKey` Firebase **n'est pas secrète** — elle identifie
ton projet, elle ne donne aucun droit d'accès. N'importe qui peut la voir dans le code source
de n'importe quel site Firebase, y compris les gros sites pro. La vraie sécurité vient de :

1. **Les règles `database.rules.json`** → lecture publique, écriture uniquement si connecté (déjà en place)
2. **Authentication** → seuls les comptes que tu crées toi-même peuvent se connecter

Pour renforcer quand même un peu plus (optionnel) :

- Va sur [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) (même projet que Firebase)
- Clique sur ta clé API → **Restrictions relatives aux applications** → **Référents HTTP (sites web)**
- Ajoute ton domaine (ex: `https://devhub-xxxxx.web.app/*` et `http://localhost:8000/*` pour tester en local)
- Sauvegarde

Ça empêche n'importe qui d'utiliser ta clé depuis un autre site que le tien.

---

## ❓ Problèmes fréquents

**Page blanche / erreur dans la console** → Assure-toi d'accéder au site via
`http://localhost:8000` et pas en ouvrant directement le fichier `index.html`
(le `file://` bloque les imports JavaScript par sécurité du navigateur).

**Les visiteurs ne voient rien** → Vérifie que les règles `database.rules.json` sont bien publiées dans la console Firebase.
