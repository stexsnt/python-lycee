/* Service worker : rend le site utilisable hors connexion après une première visite.
   - Pyodide (gros fichiers qui ne changent pas) : servi depuis un cache partagé par Mue, Synapse,
     Périple et Sésame, pour n'être téléchargé qu'une fois ;
   - le reste : réseau d'abord, pour que les mises à jour du contenu arrivent tout de suite,
     et cache en secours quand il n'y a pas de connexion.
   À l'installation, seuls les fichiers absents du cache sont téléchargés.
   Si Pyodide est mis à jour, changer CACHE_PY ci-dessous, dans les quatre sites. */
const CACHE = "mue-v2", CACHE_PY = "pyodide-314";
const BASE = ["./", "index.html", "prof.html", "css/style.css", "js/contenu.js", "js/moteur.js", "js/bilan.js", "js/app.js", "js/prof.js", "js/confort.js", "js/prof-plus.js", "js/qrcode.min.js", "manifest.webmanifest", "icones/icone-192.png", "icones/icone-512.png", "polices/bricolage-grotesque-latin-800-normal.woff2", "polices/atkinson-hyperlegible-latin-400-normal.woff2", "polices/atkinson-hyperlegible-latin-400-italic.woff2", "polices/atkinson-hyperlegible-latin-700-normal.woff2", "polices/jetbrains-mono-latin-400-normal.woff2", "polices/jetbrains-mono-latin-700-normal.woff2"];
const PY = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"].map(f => "/pyodide/" + f);
const remplir = (nom, liste) => caches.open(nom).then(c => Promise.all(liste.map(u => c.match(u).then(h => h || c.add(u).catch(() => {}))))).catch(() => {});
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(Promise.all([remplir(CACHE, BASE), remplir(CACHE_PY, PY)])); });
// On ne supprime que les anciens caches de ce site : ceux des autres sites et le cache partagé restent.
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith("mue-") && n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.includes("/pyodide/")) {
    e.respondWith(caches.open(CACHE_PY).then(c => c.match(r).then(h => h || fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }))));
  } else {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const copie = res.clone(); caches.open(CACHE).then(c => c.put(r, copie)); } return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(h => h || Response.error())));
  }
});
