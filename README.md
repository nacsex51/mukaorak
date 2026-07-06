# Munkaóra számláló

Egyszerű webalkalmazás ledolgozott munkaórák rögzítésére. Az adatokat Firebase-ben
(Firestore) tárolja, a bejelentkezést a Firebase Authentication kezeli — így több
gépről is használható, és mindenki csak a saját munkaóráit látja.

**Fájlszerkezet:** `index.html` (szerkezet), `style.css` (stílusok), `app.js` (logika),
`manifest.json` + `sw.js` + ikonok (PWA). A fejlesztések története a
`FEJLESZTESI_NAPLO.md` fájlban követhető.

## Használat

- **Regisztráció:** az app Regisztráció fülén bárki létrehozhat magának fiókot
  (felhasználónév + jelszó). Mindenki csak a saját adatait éri el.
- **Munkaidő rögzítése:** írd be, mettől meddig dolgoztál (24 órás rendszerben, pl. `8` és `16`).
- Fél órák: `8:30` vagy `8.5`.
- Éjfélen átnyúló műszakot automatikusan felismeri: `8` → `2` = reggel 8-tól másnap
  hajnali 2-ig (18 óra), és az előző napi dátummal rögzíti.
- A „Számláló nullázása" gombbal törölhető az összes bejegyzés, és elölről kezdődik a számolás.
- Jobb felül sötét/világos mód kapcsoló.

## Biztonság

- **A `firebaseConfig` (benne az `apiKey`) szándékosan publikus.** A Firebase webes
  alkalmazásoknál ez nem titkos kulcs, hanem a projekt azonosítója — a Google
  dokumentációja szerint nyugodtan szerepelhet nyilvános kódban. A GitHub
  figyelmeztetése ezért ennél a kulcstípusnál hamis riasztás.
- A tényleges védelmet két dolog adja:
  1. **Firebase Authentication** — csak bejelentkezett felhasználó érheti el az adatbázist.
  2. **Firestore szabályok** — mindenki kizárólag a saját (`uid`-hoz kötött) adatait
     olvashatja és írhatja, más adataihoz akkor sem fér hozzá, ha akarna.
- Extra védelemként az API-kulcs korlátozható a saját domainre:
  [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
  → válaszd ki a `munkaorak-40089` projektet → kattints a **Browser key (auto created by Firebase)**
  kulcsra → **Application restrictions: Websites** → add hozzá:
  `https://nacsex51.github.io/*` → **Save**. Ezután a kulcs kizárólag a saját
  weboldaladról használható. (Figyelem: utána a gépről közvetlenül megnyitott
  `index.html` nem fog működni, csak a github.io-s cím.)

## Firestore szabályok

A Firebase Console-ban a **Firestore Database → Rules** fülön ennek kell szerepelnie
(Publish után él):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /munkaora/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Felhasználók kezelése

- Új felhasználó az app **Regisztráció** fülén hozható létre (a háttérben
  `felhasznalonev@munkaora.app` formában jön létre a Firebase-ben — ez nem igazi
  e-mail cím, csak azonosító).
- Felhasználó törlése / jelszó visszaállítása: Firebase Console →
  **Authentication → Users** fül → a sor végén a ⋮ menü.

## Közzététel GitHub Pages-szel

1. A repo oldalán: **Settings** → **Pages**.
2. **Source**: Deploy from a branch, **Branch**: `main`, mappa: `/ (root)` → **Save**.
3. Pár perc múlva az app elérhető: `https://nacsex51.github.io/mukaorak/`
