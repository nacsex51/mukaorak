# Munkaóra számláló

Egyszerű webalkalmazás ledolgozott munkaórák rögzítésére, két felhasználóval.
Egyetlen HTML fájlból áll (`index.html`), az adatokat Firebase-ben (Firestore) tárolja,
így több gépről is használható.

## Használat

- Írd be, mettől meddig dolgoztál (24 órás rendszerben, pl. `8` és `16`).
- Fél órák: `8:30` vagy `8.5`.
- Éjfélen átnyúló műszakot automatikusan felismeri: `8` → `2` = reggel 8-tól másnap hajnali 2-ig (18 óra), és az előző napi dátummal rögzíti.
- A „Számláló nullázása" gombbal törölhető az összes bejegyzés, és elölről kezdődik a számolás.
- Jobb felül sötét/világos mód kapcsoló.

## Firebase beállítás (egyszeri, kb. 10 perc)

Amíg ez nincs kész, az app „helyi módban" fut: működik, de az adatok csak az adott böngészőben tárolódnak.

### 1. Projekt létrehozása

1. Menj a [Firebase Console](https://console.firebase.google.com/)-ra, és hozz létre egy új projektet.
2. A projekten belül: **Projektbeállítások** (fogaskerék) → **Általános** → görgess le a **Saját alkalmazások** részhez → kattints a **`</>` (Web)** ikonra → adj neki nevet → **Regisztrálás**.
3. A megjelenő `firebaseConfig` értékeit másold be az `index.html` fájlba, a `firebaseConfig` részhez (a fájl vége felé, `IDE_MASOLD` feliratú helyekre).

### 2. Bejelentkezés (Authentication)

1. Bal oldali menü: **Authentication** → **Get started**.
2. **Sign-in method** fül → engedélyezd az **Email/Password** módot.
3. **Users** fül → **Add user** gombbal hozd létre a két felhasználót.
   A felhasználónévhez fűzd hozzá a `@munkaora.app` végződést, például:
   - `anna@munkaora.app` + jelszó → az appba `anna` néven lehet belépni
   - `peter@munkaora.app` + jelszó → az appba `peter` néven lehet belépni

### 3. Adatbázis (Firestore)

1. Bal oldali menü: **Firestore Database** → **Create database** → válaszd a **production mode**-ot.
2. A **Rules** fülön cseréld le a szabályokat erre, majd **Publish**:

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

Ez biztosítja, hogy mindenki csak a saját munkaóráit lássa és módosíthassa.

## Közzététel GitHub Pages-szel

1. A repo oldalán: **Settings** → **Pages**.
2. **Source**: Deploy from a branch, **Branch**: `main`, mappa: `/ (root)` → **Save**.
3. Pár perc múlva az app elérhető lesz a `https://<felhasznalonev>.github.io/<repo-nev>/` címen.
