/* ============================================================
   MUNKAÓRA SZÁMLÁLÓ — alkalmazáslogika
   Tartalom:
     1. Firebase inicializálás
     2. Állapot (globális változók)
     3. Sötét / világos mód
     4. Tárolás (Firestore olvasás/írás)
     5. Toast értesítések
     6. Felugró megerősítő ablak
     7. Időértelmezés és formázás
     8. Megjelenítés (render)
     9. Nézetváltás (login <-> app)
    10. Bejelentkezés / regisztráció / kijelentkezés
    11. Munkaidő hozzáadása (mai nap)
    12. Visszamenőleges rögzítés (dátum szerint, FAB)
    13. Nullázás
    14. PWA service worker
   ============================================================ */

/* ----------------------------------------------------------
   1. FIREBASE INICIALIZÁLÁS
   Ez a konfiguráció szándékosan publikus: a Firebase webes
   alkalmazásoknál ez csak a projekt azonosítására szolgál,
   nem titkos kulcs. A biztonságot a Firestore szabályok és a
   Firebase Authentication adja.
   ---------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyDUeUmHji8AcHs7iO2Jxk_eApindOa2IAQ",
  authDomain: "munkaorak-40089.firebaseapp.com",
  projectId: "munkaorak-40089",
  storageBucket: "munkaorak-40089.firebasestorage.app",
  messagingSenderId: "1023561017073",
  appId: "1:1023561017073:web:aff753467fd427a5672b50"
};

// A Firebase Authentication e-mail címekkel dolgozik, ezért a
// felhasználónévhez ezt a végződést fűzzük hozzá. Nem igazi
// e-mail cím, csak belső azonosító.
const EMAIL_DOMAIN = "@munkaora.app";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* ----------------------------------------------------------
   2. ÁLLAPOT
   ---------------------------------------------------------- */
let currentUser = null;   // megjelenített felhasználónév
let currentUid = null;    // Firebase uid
let entriesCache = [];     // a bejelentkezett felhasználó bejegyzései

// rövid segéd az elemek eléréséhez
const $ = (id) => document.getElementById(id);

/* ----------------------------------------------------------
   3. SÖTÉT / VILÁGOS MÓD
   ---------------------------------------------------------- */
$("theme-toggle").addEventListener("click", () => {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  if (dark) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("munkaora-tema", "light");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("munkaora-tema", "dark");
  }
});

/* ----------------------------------------------------------
   4. TÁROLÁS (Firestore)
   Egy felhasználó összes bejegyzése egyetlen dokumentumban,
   a saját uid-ja alatt: munkaora/{uid} -> { entries: [...] }
   ---------------------------------------------------------- */
async function loadEntries() {
  const snap = await db.collection("munkaora").doc(currentUid).get();
  entriesCache = snap.exists ? (snap.data().entries || []) : [];
}

async function saveEntries() {
  await db.collection("munkaora").doc(currentUid).set({ entries: entriesCache });
}

/* ----------------------------------------------------------
   5. TOAST ÉRTESÍTÉSEK
   ---------------------------------------------------------- */
const TOAST_ICONS = {
  success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};

function toast(message, type) {
  type = type || "info";
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.innerHTML = TOAST_ICONS[type];
  el.appendChild(document.createTextNode(message));
  $("toast-container").appendChild(el);
  setTimeout(() => {
    el.classList.add("hide");
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

/* ----------------------------------------------------------
   6. FELUGRÓ MEGERŐSÍTŐ ABLAK (nullázáshoz)
   ---------------------------------------------------------- */
const confirmOverlay = $("modal-overlay");
let confirmCallback = null;

// opts: { title, confirmLabel } — a cím és a megerősítő gomb felirata állítható
function askConfirm(message, onConfirm, opts) {
  opts = opts || {};
  $("modal-title").textContent = opts.title || "Megerősítés";
  $("modal-text").textContent = message;
  $("modal-confirm").textContent = opts.confirmLabel || "Igen";
  confirmCallback = onConfirm;
  confirmOverlay.classList.add("show");
}
function closeConfirm() {
  confirmOverlay.classList.remove("show");
  confirmCallback = null;
}
$("modal-cancel").addEventListener("click", closeConfirm);
$("modal-confirm").addEventListener("click", () => {
  const cb = confirmCallback;
  closeConfirm();
  if (cb) cb();
});
confirmOverlay.addEventListener("click", (e) => {
  if (e.target === confirmOverlay) closeConfirm();
});

/* ----------------------------------------------------------
   7. IDŐÉRTELMEZÉS ÉS FORMÁZÁS
   ---------------------------------------------------------- */
// Elfogad: "8", "22", "8:30", "8.5", "8,5" — mindig 24 órás rendszerben.
// Visszaadja az órák számát tizedes törtként, vagy null-t ha érvénytelen.
function parseTime(str) {
  str = String(str).trim().replace(",", ".");
  if (!str) return null;

  const m = str.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) {
    const h = Number(m[1]), min = Number(m[2]);
    if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
    return h + min / 60;
  }
  if (/^\d{1,2}(\.\d+)?$/.test(str)) {
    const v = parseFloat(str);
    if (v > 24) return null;
    return v;
  }
  return null;
}

// Tizedes órából "8:30" alakú felirat
function timeLabel(v) {
  const h = Math.floor(v);
  const min = Math.round((v - h) * 60);
  return h + ":" + String(min).padStart(2, "0");
}

function formatHours(h) {
  const rounded = Math.round(h * 100) / 100;
  return (Number.isInteger(rounded) ? rounded : rounded.toFixed(2)) + " óra";
}

// Date -> "2026. 07. 06." felirat
function formatDate(d) {
  return d.getFullYear() + ". " +
    String(d.getMonth() + 1).padStart(2, "0") + ". " +
    String(d.getDate()).padStart(2, "0") + ".";
}

// "2026-07-06" (date input értéke) -> Date objektum (helyi idő)
function dateFromInput(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Egy műszak kiszámítása. Visszaad: { start, end, hours, overnight },
// { error: "same" } ha a két idő egyenlő, vagy null ha érvénytelen.
function computeShift(startRaw, endRaw) {
  const start = parseTime(startRaw);
  const end = parseTime(endRaw);
  if (start === null || end === null) return null;
  if (start === end) return { error: "same" };

  // Éjfélen átnyúló műszak: ha a befejezés nem nagyobb a kezdésnél, másnapra esik.
  const overnight = end <= start;
  let hours = end - start;
  if (overnight) hours += 24;
  return { start, end, hours, overnight };
}

/* ----------------------------------------------------------
   8. MEGJELENÍTÉS
   ---------------------------------------------------------- */
function render() {
  const total = entriesCache.reduce((sum, e) => sum + e.hours, 0);
  $("total-hours").textContent = formatHours(total);

  const list = $("entries-list");
  const empty = $("empty-msg");
  list.innerHTML = "";

  if (entriesCache.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  // A bejegyzéseket dátum szerint csökkenő sorrendben (legújabb felül).
  // A sortKey a megadott nap alapján rendez; azonos napon belül a
  // beszúrási sorrend dönt (később rögzített felül).
  const sorted = entriesCache
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const ka = a.e.sortKey || "", kb = b.e.sortKey || "";
      if (ka && kb && ka !== kb) return kb.localeCompare(ka);
      return b.i - a.i;
    });

  sorted.forEach(({ e }) => {
    const li = document.createElement("li");

    const info = document.createElement("div");
    const badge = e.overnight ? '<span class="badge">éjfélen át</span>' : "";
    info.innerHTML =
      '<div class="period">' + e.start + " – " + e.end + badge + "</div>" +
      '<div class="meta">' + e.date + "</div>";

    const right = document.createElement("div");
    right.className = "entry-right";

    const hours = document.createElement("div");
    hours.className = "hours";
    hours.textContent = formatHours(e.hours);

    const del = document.createElement("button");
    del.className = "entry-del";
    del.setAttribute("aria-label", "Nap törlése");
    del.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    // az e objektum referenciáját adjuk át, így a sorrendtől függetlenül a jó bejegyzést töröljük
    del.addEventListener("click", () => deleteEntry(e));

    right.appendChild(hours);
    right.appendChild(del);
    li.appendChild(info);
    li.appendChild(right);
    list.appendChild(li);
  });
}

// Egy nap (bejegyzés) törlése megerősítés után.
function deleteEntry(entryObj) {
  askConfirm(
    "Biztosan törlöd ezt a napot? Az órái kikerülnek az összesítésből.",
    async () => {
      const idx = entriesCache.indexOf(entryObj);
      if (idx === -1) return;
      const backup = entriesCache.slice();
      entriesCache.splice(idx, 1);
      try {
        await saveEntries();
      } catch (e) {
        entriesCache = backup;
        toast("Nem sikerült törölni. Ellenőrizd az internetkapcsolatot!", "error");
        return;
      }
      toast("Nap törölve.", "success");
      render();
    },
    { title: "Nap törlése", confirmLabel: "Törlés" }
  );
}

/* ----------------------------------------------------------
   9. NÉZETVÁLTÁS
   ---------------------------------------------------------- */
function showApp() {
  $("login-view").classList.add("hidden");
  $("app-view").classList.remove("hidden");
  $("fab-backdate").classList.remove("hidden");
  $("current-user-label").textContent = currentUser;
  $("avatar").textContent = currentUser.slice(0, 1);
  render();
}

function showLogin() {
  currentUser = null;
  currentUid = null;
  entriesCache = [];
  // az előző felhasználó eredménysora és beírt értékei ne maradjanak ott
  $("result-line").classList.remove("show");
  $("result-line").innerHTML = "";
  $("start-time").value = "";
  $("end-time").value = "";
  $("app-view").classList.add("hidden");
  $("fab-backdate").classList.add("hidden");
  $("login-view").classList.remove("hidden");
}

/* ----------------------------------------------------------
   10. BEJELENTKEZÉS / REGISZTRÁCIÓ / KIJELENTKEZÉS
   ---------------------------------------------------------- */
const loginBtn = $("login-btn");
const registerBtn = $("register-btn");
const tabLogin = $("tab-login");
const tabRegister = $("tab-register");

function setAuthTab(showRegister) {
  $("login-form").classList.toggle("hidden", showRegister);
  $("register-form").classList.toggle("hidden", !showRegister);
  tabLogin.classList.toggle("active", !showRegister);
  tabRegister.classList.toggle("active", showRegister);
}
tabLogin.addEventListener("click", () => setAuthTab(false));
tabRegister.addEventListener("click", () => setAuthTab(true));

async function doLogin() {
  const user = $("login-user").value.trim().toLowerCase();
  const pass = $("login-pass").value;

  if (!user || !pass) {
    toast("Add meg a felhasználónevet és a jelszót!", "error");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Bejelentkezés...";
  try {
    await auth.signInWithEmailAndPassword(user + EMAIL_DOMAIN, pass);
    // a betöltést és a nézetváltást az onAuthStateChanged intézi
    toast("Sikeres bejelentkezés. Szia, " + user + "!", "success");
    $("login-pass").value = "";
    $("login-user").value = "";
  } catch (err) {
    handleAuthError(err, "Nem sikerült bejelentkezni. Próbáld újra.");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Bejelentkezés";
  }
}

async function doRegister() {
  const user = $("reg-user").value.trim().toLowerCase();
  const pass = $("reg-pass").value;
  const pass2 = $("reg-pass2").value;

  if (!/^[a-z0-9]{3,20}$/.test(user)) {
    toast("A felhasználónév 3–20 karakter legyen, csak ékezet nélküli kisbetű és szám.", "error");
    return;
  }
  if (pass.length < 6) {
    toast("A jelszó legalább 6 karakter legyen.", "error");
    return;
  }
  if (pass !== pass2) {
    toast("A két jelszó nem egyezik.", "error");
    return;
  }

  registerBtn.disabled = true;
  registerBtn.textContent = "Regisztráció...";
  try {
    await auth.createUserWithEmailAndPassword(user + EMAIL_DOMAIN, pass);
    // sikeres regisztráció után a Firebase automatikusan beléptet
    toast("Sikeres regisztráció. Szia, " + user + "!", "success");
    $("reg-user").value = "";
    $("reg-pass").value = "";
    $("reg-pass2").value = "";
    setAuthTab(false);
  } catch (err) {
    if (err && err.code === "auth/email-already-in-use") {
      toast("Ez a felhasználónév már foglalt.", "error");
    } else {
      handleAuthError(err, "Nem sikerült a regisztráció. Próbáld újra.");
    }
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = "Regisztráció";
  }
}

// Közös hibaüzenet-kezelés a bejelentkezéshez/regisztrációhoz
function handleAuthError(err, fallback) {
  const code = err && err.code;
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    toast("Hibás felhasználónév vagy jelszó!", "error");
  } else if (code === "auth/too-many-requests") {
    toast("Túl sok próbálkozás. Várj egy kicsit, majd próbáld újra.", "error");
  } else if (code === "auth/network-request-failed") {
    toast("Nincs internetkapcsolat. Próbáld újra.", "error");
  } else if (code === "auth/weak-password") {
    toast("A jelszó túl gyenge. Legalább 6 karakter legyen.", "error");
  } else {
    toast(fallback, "error");
  }
}

loginBtn.addEventListener("click", doLogin);
$("login-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
registerBtn.addEventListener("click", doRegister);
$("reg-pass2").addEventListener("keydown", (e) => { if (e.key === "Enter") doRegister(); });

$("logout-btn").addEventListener("click", () => {
  auth.signOut(); // a nézetváltást az onAuthStateChanged intézi
  toast("Kijelentkeztél.", "info");
});

// Bejelentkezett állapot helyreállítása (oldalfrissítés után is)
auth.onAuthStateChanged(async (u) => {
  if (u) {
    currentUid = u.uid;
    currentUser = (u.email || "").split("@")[0];
    try {
      await loadEntries();
    } catch (e) {
      toast("Nem sikerült betölteni az adatokat. Frissítsd az oldalt!", "error");
      entriesCache = [];
    }
    showApp();
  } else {
    showLogin();
  }
});

/* ----------------------------------------------------------
   11. MUNKAIDŐ HOZZÁADÁSA (mai nap)
   ---------------------------------------------------------- */
const addBtn = $("add-btn");

addBtn.addEventListener("click", async () => {
  const startRaw = $("start-time").value;
  const endRaw = $("end-time").value;

  if (!startRaw.trim() || !endRaw.trim()) {
    toast("Add meg, hogy mettől meddig dolgoztál!", "error");
    return;
  }

  const shift = computeShift(startRaw, endRaw);
  if (shift === null) {
    toast("Érvénytelen időpont. Írj be egy számot 0 és 24 között, pl. 8 vagy 16:30.", "error");
    return;
  }
  if (shift.error === "same") {
    toast("A kezdés és a befejezés nem lehet ugyanaz.", "error");
    return;
  }

  // A műszak napja: ma — de ha éjfélen átnyúlt, akkor az előző nap,
  // mert a munka még előző nap kezdődött.
  const day = new Date();
  if (shift.overnight) day.setDate(day.getDate() - 1);

  const entry = makeEntry(day, shift);

  addBtn.disabled = true;
  entriesCache.push(entry);
  try {
    await saveEntries();
  } catch (e) {
    entriesCache.pop();
    toast("Nem sikerült menteni. Ellenőrizd az internetkapcsolatot!", "error");
    addBtn.disabled = false;
    return;
  }
  addBtn.disabled = false;

  const line = $("result-line");
  line.innerHTML = timeLabel(shift.start) + "-tól " + timeLabel(shift.end) + "-ig ez <strong>" +
    formatHours(shift.hours) + "</strong>" +
    (shift.overnight ? " (éjfélen átnyúló műszak, dátum: " + formatDate(day) + ")" : "") + ".";
  line.classList.add("show");

  $("start-time").value = "";
  $("end-time").value = "";
  $("start-time").focus();

  toast("Munkaidő rögzítve: " + formatHours(shift.hours), "success");
  render();
});

$("end-time").addEventListener("keydown", (e) => { if (e.key === "Enter") addBtn.click(); });

// Egy bejegyzés-objektum összeállítása egységesen.
// sortKey: rendezéshez használt "ÉÉÉÉ-HH-NN" kulcs (nem jelenik meg).
function makeEntry(day, shift) {
  return {
    date: formatDate(day),
    sortKey: day.getFullYear() + "-" +
      String(day.getMonth() + 1).padStart(2, "0") + "-" +
      String(day.getDate()).padStart(2, "0"),
    start: timeLabel(shift.start),
    end: timeLabel(shift.end),
    hours: shift.hours,
    overnight: shift.overnight
  };
}

/* ----------------------------------------------------------
   12. VISSZAMENŐLEGES RÖGZÍTÉS (dátum szerint, FAB)
   A jobb alsó sarki lebegő gombbal nyílik egy külön ablak,
   ahol dátumot és időt is meg lehet adni.
   ---------------------------------------------------------- */
const backdateOverlay = $("backdate-overlay");
const backdateSaveBtn = $("backdate-save");

function openBackdate() {
  // alapból a mai dátum, üres idők
  const today = new Date();
  $("bd-date").value = today.getFullYear() + "-" +
    String(today.getMonth() + 1).padStart(2, "0") + "-" +
    String(today.getDate()).padStart(2, "0");
  $("bd-start").value = "";
  $("bd-end").value = "";
  backdateOverlay.classList.add("show");
}
function closeBackdate() {
  backdateOverlay.classList.remove("show");
}

$("fab-backdate").addEventListener("click", openBackdate);
$("backdate-cancel").addEventListener("click", closeBackdate);
backdateOverlay.addEventListener("click", (e) => {
  if (e.target === backdateOverlay) closeBackdate();
});

async function saveBackdate() {
  const dateStr = $("bd-date").value;
  const startRaw = $("bd-start").value;
  const endRaw = $("bd-end").value;

  if (!dateStr) {
    toast("Válaszd ki a dátumot!", "error");
    return;
  }
  if (!startRaw.trim() || !endRaw.trim()) {
    toast("Add meg, hogy mettől meddig dolgoztál!", "error");
    return;
  }

  const shift = computeShift(startRaw, endRaw);
  if (shift === null) {
    toast("Érvénytelen időpont. Írj be egy számot 0 és 24 között, pl. 8 vagy 16:30.", "error");
    return;
  }
  if (shift.error === "same") {
    toast("A kezdés és a befejezés nem lehet ugyanaz.", "error");
    return;
  }

  // A megadott nap a műszak KEZDŐ napja. Éjfélen átnyúlásnál a
  // dátum akkor is a kezdő nap marad (ahogy a mai rögzítésnél is).
  const day = dateFromInput(dateStr);
  const entry = makeEntry(day, shift);

  backdateSaveBtn.disabled = true;
  entriesCache.push(entry);
  try {
    await saveEntries();
  } catch (e) {
    entriesCache.pop();
    toast("Nem sikerült menteni. Ellenőrizd az internetkapcsolatot!", "error");
    backdateSaveBtn.disabled = false;
    return;
  }
  backdateSaveBtn.disabled = false;

  closeBackdate();
  toast("Rögzítve (" + formatDate(day) + "): " + formatHours(shift.hours), "success");
  render();
}

backdateSaveBtn.addEventListener("click", saveBackdate);
$("bd-end").addEventListener("keydown", (e) => { if (e.key === "Enter") saveBackdate(); });

/* ----------------------------------------------------------
   13. NULLÁZÁS
   ---------------------------------------------------------- */
$("reset-btn").addEventListener("click", () => {
  askConfirm(
    "Az összes eddig rögzített munkaidőd törlődik, és a számolás elölről kezdődik. Biztosan folytatod?",
    async () => {
      const backup = entriesCache;
      entriesCache = [];
      try {
        await saveEntries();
      } catch (e) {
        entriesCache = backup;
        toast("Nem sikerült nullázni. Ellenőrizd az internetkapcsolatot!", "error");
        return;
      }
      $("result-line").classList.remove("show");
      toast("A számláló nullázva. Kezdheted elölről a számolást.", "success");
      render();
    },
    { title: "Számláló nullázása", confirmLabel: "Nullázás" }
  );
});

/* ----------------------------------------------------------
   14. PWA SERVICE WORKER
   ---------------------------------------------------------- */
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js");
}
