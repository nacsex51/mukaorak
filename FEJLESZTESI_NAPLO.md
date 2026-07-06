# Fejlesztési napló — Munkaóra számláló

Ez a napló nyilvántartja a projekt fejlesztéseit és döntéseit. Későbbi
módosítás előtt **ezt a fájlt érdemes átnézni**, hogy tudjuk, mi hogyan és
miért működik. Új munka után mindig egy új bejegyzést adunk hozzá felülre.

## Projekt áttekintés

- **Cél:** ledolgozott munkaórák rögzítése és összesítése, több felhasználóval,
  több gépről is elérhetően.
- **Technológia:** statikus weboldal (nincs saját szerver), Firebase Authentication
  (bejelentkezés) + Firestore (adattárolás). GitHub Pages-en fut, PWA-ként telepíthető.
- **Fájlszerkezet:**
  - `index.html` — csak a szerkezet (HTML). Betölti a CSS-t, a JS-t és a Firebase SDK-t.
  - `style.css` — minden stílus, számozott szekciókban tagolva (lásd a fájl tetején).
  - `app.js` — minden alkalmazáslogika, számozott szekciókban tagolva (lásd a fájl tetején).
  - `manifest.json` — PWA metaadatok (név, színek, ikonok).
  - `sw.js` — service worker (offline gyorsítótárazás).
  - `icon-192.png`, `icon-512.png` — app ikonok.
  - `README.md` — beállítási és üzemeltetési útmutató.

## Adatmodell (Firestore)

- Gyűjtemény: `munkaora`, dokumentum azonosító: a felhasználó `uid`-ja.
- Dokumentum: `{ entries: [ ... ] }`
- Egy bejegyzés (`entry`) mezői:
  - `date` — megjelenített dátum, pl. `"2026. 07. 06."`
  - `sortKey` — rendezéshez, pl. `"2026-07-06"` (nem jelenik meg)
  - `start`, `end` — időpontok szövegként, pl. `"8:00"`, `"16:30"`
  - `hours` — a műszak hossza órában (tizedes szám)
  - `overnight` — `true`, ha a műszak éjfélen átnyúlt

## Fontos működési szabályok

- **Időbevitel:** 24 órás rendszer, elég egy szám (pl. `8`), fél óra `8:30` vagy `8.5`/`8,5`.
- **Éjfélen átnyúló műszak:** ha a befejezés <= kezdés, az app másnapra érti,
  és a nappal átfordulást automatikusan hozzászámolja (pl. 8 → 2 = 18 óra).
  A bejegyzés dátuma ilyenkor a **kezdő nap**.
- **Biztonság:** a `firebaseConfig` szándékosan publikus (nem titok). A védelmet a
  Firestore szabályok adják: mindenki csak a saját `uid`-jához tartozó adatot éri el.

---

## Változásnapló (legújabb felül)

### 2026-07-06 — Modal szimmetrikus középre igazítás (iOS dátummező)
- Az előző `min-width: 0` nem volt elég: iOS-en a rendszer dátummező belső minimális
  szélessége továbbra is szétfeszítette és elcsúsztatta az ablakot (aszimmetrikus
  margók, a dátummező kilógott). Megoldás: a `.modal` explicit, fix szélességet
  kapott — `width: min(380px, calc(100vw - 32px))` —, így sosem szélesebb a
  képernyőnél, és flex-közepesítéssel mindkét oldalon pontosan 16px a szegély.
- A `.modal input` mostantól `width/max-width/min-width` + `box-sizing: border-box`
  együttesével biztosan a szülő szélességén belül marad.
- Ellenőrizve 320 / 390 px szélességen: bal és jobb margó egyaránt 16px (szimmetrikus),
  nincs vízszintes túllógás.
- Service worker cache: `v3` (hogy a friss CSS eljusson a klienshez).

### 2026-07-06 — Modal kilógás (iOS) + betöltési sebesség
- **Hibajavítás (iOS):** a felugró ablak kilógott a képernyőből, mert flex-elemként
  a `min-width: auto` alapérték miatt az iOS-es dátummező belső minimális szélessége
  szélesebbre feszítette a képernyőnél (Chrome-ban nem jött elő). Megoldás:
  `.modal { min-width: 0 }` + `.modal input { max-width: 100% }`.
- **Sebesség 1:** a három Firebase SDK szkript `defer`-t kapott (az `app.js`-szel
  együtt, hogy a sorrend megmaradjon). Így a több száz KB-os SDK nem blokkolja a
  megjelenítést — a váz azonnal kirajzolódik, a Firebase a háttérben töltődik.
- **Sebesség 2:** a service worker „hálózat-először" helyett „stale-while-revalidate"
  (gyorsítótár-először, háttérfrissítés) lett, és a Firebase-kéréseket már nem fogja
  el. Az app-váz így ismételt megnyitáskor azonnal betölt. Cache verzió: `v2`,
  bővítve a `style.css` és `app.js` fájlokkal.

### 2026-07-06 — Nap törlése + visszamenőleges ablak elrendezés-javítás
- **Új funkció:** a „Rögzített időszakok" listában minden sor mellett egy törlés
  (kuka) gomb, amivel egy nap törölhető. Törlés előtt megerősítő ablak jelenik meg.
  A törlés az `e` objektum referenciája alapján történik (`indexOf`), így a
  megjelenítési sorrendtől függetlenül a helyes bejegyzést törli.
- A megerősítő ablak (`askConfirm`) újrahasználható lett: `opts.title` és
  `opts.confirmLabel` paraméterrel a cím és a gomb felirata állítható. A `<h3>`
  `modal-title` id-t kapott. A nullázás és a törlés is ezt az egy ablakot használja.
- **Elrendezés-javítás:** a visszamenőleges rögzítés ablakában vízszintes görgetés
  jelentkezett (a flexbox `min-width: auto` alapértéke miatt az input mezők nem
  húzódtak össze). Megoldás: `.row > div` és `.row input` most `min-width: 0`,
  a `.modal` pedig `overflow-x: hidden`. Így az ablak fix, nem kell görgetni.

### 2026-07-06 — Fájlszétválasztás, visszamenőleges rögzítés, mobiloptimalizálás
- A korábbi egyetlen `index.html`-t három fájlra bontottuk: `index.html` (szerkezet),
  `style.css` (stílusok), `app.js` (logika). Mindkét új fájl számozott szekciókra tagolva.
- **Új funkció:** visszamenőleges rögzítés. Jobb alsó sarokban egy narancssárga lebegő
  gomb (FAB) nyit egy külön ablakot, ahol dátum + mettől–meddig adható meg. Így korábbi
  napokra is rögzíthető munkaidő.
- Az `entry` objektum új `sortKey` mezőt kapott, hogy a lista dátum szerint,
  csökkenő sorrendben (legújabb felül) jelenjen meg — a visszamenőleges bejegyzések
  a helyükre kerülnek. A régi, `sortKey` nélküli bejegyzések a lista végén maradnak.
- **Mobiloptimalizálás:** álló telefonra hangolt elrendezés (`@media max-width: 480px`),
  `viewport-fit=cover` + safe-area figyelembevétel, kisebb paddingek, a téma kapcsoló és a
  fejléc nem takarják egymást, a lebegő gomb nem lóg a tartalomra (alsó padding).
- **Új dokumentum:** ez a fejlesztési napló.

### 2026-07-06 — PWA (telepíthető alkalmazás)
- `manifest.json`, `sw.js` (service worker) és app ikonok (192/512 px) hozzáadva.
- Az oldal mostantól „Hozzáadás a kezdőképernyőhöz" opcióval telepíthető, és offline is betölt.
- GitHub Pages bekapcsolva: az app elérhető a `https://nacsex51.github.io/mukaorak/` címen.

### 2026-07-06 — Regisztrációs fül, beégetett felhasználók eltávolítása
- Bejelentkező kártyán két fül: Bejelentkezés / Regisztráció (Firebase Auth `createUser`).
- A kódba írt `felhasznalo1`/`felhasznalo2` és a „helyi mód" teljesen eltávolítva —
  többé nincs jelszó a forráskódban.
- README kiegészítve a biztonsági magyarázattal és az API-kulcs korlátozási útmutatóval.
- Javítás: profilváltáskor (kijelentkezéskor) törlődik az előző felhasználó
  eredménysora és a beírt időmezők, hogy ne látszódjanak a következő belépőnek.

### 2026-07-06 — Firebase áttérés
- localStorage helyett Firebase Authentication + Firestore, hogy több gépről is
  ugyanazok az adatok legyenek elérhetők.
- A `firebaseConfig` beállítva a `munkaorak-40089` projekthez.

### 2026-07-06 — Kezdeti verzió
- Egyfájlos webalkalmazás: bejelentkezés, munkaidő-rögzítés mettől–meddig alapon,
  összesítő, nullázás gomb, appon belüli toast értesítések és megerősítő ablak.
- AM/PM megszüntetve: 24 órás, egyszerű számbevitel; éjfélen átnyúló műszak
  automatikus felismerése.
- Dizájn a ui-ux-pro-max ajánlása alapján: flat design, teal/petrol színvilág,
  Inter betűtípus. Sötét/világos mód kapcsoló.
