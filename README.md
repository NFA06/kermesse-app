# Kermesse PWA — APIEC

Progressive Web App convertie depuis l'application Android Studio.  
Fonctionne sur iOS, Android, et desktop depuis le navigateur.

## Stack

- **React 18** + **Vite** — équivalent de Jetpack Compose
- **React Router v6** — équivalent des Activity + Intent
- **Firebase JS SDK v10** — même projet Firestore que l'app Android
- **vite-plugin-pwa** — manifest + service worker automatiques

## Installation

```bash
npm install
```

## Configuration Firebase (⚠️ obligatoire)

1. Ouvrez la **Console Firebase** de votre projet existant
2. Allez dans **Paramètres du projet** → **Vos applications** → Cliquez **"Ajouter une appli"** → **Web**
3. Copiez la config et collez-la dans `src/services/firebase.js` :

```js
const firebaseConfig = {
  apiKey:            "...",
  authDomain:        "....firebaseapp.com",
  projectId:         "...",
  storageBucket:     "....appspot.com",
  messagingSenderId: "...",
  appId:             "..."
}
```

> Le `projectId` est identique à votre app Android — vous utilisez **la même base Firestore**.

## Lancement en développement

```bash
npm run dev
# → http://localhost:5173
```

## Build production

```bash
npm run build
# Génère le dossier dist/ avec le service worker PWA
```

## Déploiement recommandé

### Firebase Hosting (le plus simple — même projet)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Public directory: dist
# SPA: yes
npm run build
firebase deploy
```

### Netlify / Vercel
Reliez votre repo Git, la commande de build est `npm run build`, le répertoire de sortie est `dist`.

## Installation sur iOS (depuis Safari)

1. Ouvrez l'URL dans **Safari** (pas Chrome)
2. Appuyez sur le bouton **Partager** ↑
3. Sélectionnez **"Sur l'écran d'accueil"**
4. L'app s'installe avec l'icône et se lance en plein écran

## Architecture — correspondance Android → PWA

| Android (Kotlin)         | PWA (React)                    |
|--------------------------|-------------------------------|
| `HomeActivity.kt`        | `src/views/HomeView.jsx`       |
| `MainScreen.kt`          | `src/views/CaisseView.jsx`     |
| `ColorRunActivity.kt`    | `src/views/ColorRunView.jsx`   |
| `PlanningActivity.kt`    | `src/views/PlanningView.jsx`   |
| `GestionLotsActivity.kt` | `src/views/LotsView.jsx`       |
| `StatsActivity.kt`       | `src/views/StatsView.jsx`      |
| `BenevoleActivity.kt`    | `src/views/BenevoleView.jsx`   |
| `AdminActivity.kt`       | `src/views/AdminView.jsx`      |
| `FirebaseManager.kt`     | `src/services/firebase.js`     |
| `SharedPreferences`      | `localStorage`                 |
| `Intent/startActivity`   | `useNavigate()` react-router   |
| `StateFlow`              | `useState` / `useEffect`       |

## Fonctionnalité Bluetooth (impression tickets)

L'impression Bluetooth ESC/POS n'est **pas supportée nativement** dans les PWA sur iOS/Safari.  
Options possibles :
- **Web Bluetooth API** — fonctionne sur Android Chrome, pas sur iOS Safari (restriction Apple)
- **QR code** à la place du ticket papier
- **Impression réseau** via une imprimante WiFi (Web Serial API ou proxy local)
- Conserver l'app Android uniquement pour la caisse avec imprimante

## Sécurité admin

Le mot de passe admin est actuellement en dur dans `AdminView.jsx`.  
En production, utilisez **Firebase Authentication** :
```bash
npm install firebase
# Activez Email/Password dans Console Firebase → Authentication
```

## Fichiers à ajouter dans /public/
- `icon-192.png` — icône PWA 192×192
- `icon-512.png` — icône PWA 512×512  
- `apple-touch-icon.png` — icône iOS 180×180
- `favicon.ico`
- `logo.png` — votre logo kermesse

Utilisez le logo existant de l'app Android (drawable `ic_launcher`).
