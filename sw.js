/* Service worker : rend le site utilisable hors connexion après une première visite.
   - pyodide/ (gros fichiers qui ne changent pas) : servi depuis le cache ;
   - le reste : réseau d'abord, pour que les mises à jour du contenu arrivent tout de suite,
     et cache en secours quand il n'y a pas de connexion.
   À l'installation, seuls les fichiers absents du cache sont téléchargés : une mise à jour du site
   ne recharge pas Pyodide. Si Pyodide est mis à jour, changer le nom du cache ci-dessous. */
const CACHE = "mue-v1";
const BASE = ["./", "index.html", "prof.html", "css/style.css", "js/contenu.js", "js/moteur.js", "js/bilan.js", "js/app.js", "js/prof.js", "js/confort.js", "js/prof-plus.js", "js/qrcode.min.js", "manifest.webmanifest", "icones/icone-192.png", "icones/icone-512.png", "polices/bricolage-grotesque-latin-800-normal.woff2", "polices/atkinson-hyperlegible-latin-400-normal.woff2", "polices/atkinson-hyperlegible-latin-400-italic.woff2", "polices/atkinson-hyperlegible-latin-700-normal.woff2", "polices/jetbrains-mono-latin-400-normal.woff2", "polices/jetbrains-mono-latin-700-normal.woff2",
  "pyodide/pyodide.mjs", "pyodide/pyodide.asm.mjs", "pyodide/pyodide.asm.wasm", "pyodide/python_stdlib.zip", "pyodide/pyodide-lock.json"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => Promise.all(BASE.map(u => c.match(u).then(h => h || c.add(u).catch(() => {}))))).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.includes("/pyodide/")) {
    e.respondWith(caches.open(CACHE).then(c => c.match(r).then(h => h || fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }))));
  } else {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const copie = res.clone(); caches.open(CACHE).then(c => c.put(r, copie)); } return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(h => h || Response.error())));
  }
});
