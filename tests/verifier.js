// Vérifie que chaque solution passe ses tests, que les départs ne les passent pas,
// et que les sorties attendues (predire / ordre) sont exactes.
const fs = require("fs"), path = require("path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const { PARCOURS, DEFIS, PY_HARNESS, memesSorties } = new Function(src("contenu.js") + src("moteur.js") + "; return {PARCOURS, DEFIS, PY_HARNESS, memesSorties};")();

(async () => {
  const { loadPyodide } = require("pyodide");
  const py = await loadPyodide();
  py.runPython(PY_HARNESS);
  const lancer = o => JSON.parse(py.globals.get("_lancer")(JSON.stringify(o)));
  const passe = (e, code) => e.tests.every(t => {
    const r = lancer({ code, entrees: t.entrees || [], test: true, appels: (t.appels || []).map(a => [a[0], a[1]]) });
    if (r.erreur || r.besoin != null) return false;
    if (t.sortie !== undefined && !memesSorties(r.sortie, t.sortie)) return false;
    return r.appels.every(a => a.ok);
  });
  let ko = 0, n = 0, nbCaches = 0;
  for (const c of [...PARCOURS.flatMap(p => p.chapitres), DEFIS]) {
    c.etapes.forEach((e, i) => {
      const nom = `${c.id}.${i} ${e.titre || e.t}`;
      n++;
      if (e.t === "code") {
        for (let k = 0; k < 3; k++) if (!passe(e, e.solution)) { ko++; console.log("ECHEC solution :", nom); break; }
        if (passe(e, e.depart)) { ko++; console.log("ECHEC départ déjà valide :", nom); }
        const st = lancer({ code: e.solution, regles: { requis: e.requis || [], interdit: e.interdit || [], depend: e.depend || {} } });
        if (st.manque.length || st.interdit.length || st.depend.length) { ko++; console.log("ECHEC structure :", nom, JSON.stringify(st)); }
        if (e.caches) {
          nbCaches += e.caches.length;
          const io = Array.isArray(e.caches[0]);
          const refs = io ? e.caches.map(en => lancer({ code: e.solution, entrees: en, test: true })) : [lancer({ code: e.solution, entrees: [], test: true, appels: e.caches.map(x => [x, "None"]) })];
          if (refs.some(r => r.erreur || r.besoin != null || r.appels.some(a => a.erreur))) { ko++; console.log("ECHEC tests cachés (référence) :", nom); }
          const dep = io ? e.caches.every(en => { const r = lancer({ code: e.depart, entrees: en, test: true }); return !r.erreur && r.besoin == null && memesSorties(r.sortie, lancer({ code: e.solution, entrees: en, test: true }).sortie); }) : false;
          if (dep) { ko++; console.log("ECHEC départ passe les tests cachés :", nom); }
        }
      } else if (e.t === "predire" || e.t === "ordre") {
        const r = lancer({ code: e.t === "ordre" ? e.lignes.join("\n") : e.code, entrees: [], test: true });
        if (r.erreur || !memesSorties(r.sortie, e.attendu)) { ko++; console.log("ECHEC attendu :", nom, JSON.stringify(r)); }
      } else if (e.t === "lecon" && e.code && !/input\(/.test(e.code)) {
        const r = lancer({ code: e.code, entrees: [], test: false });
        if (r.erreur) { ko++; console.log("ECHEC exemple :", nom, JSON.stringify(r.erreur)); }
      } else if (e.t === "qcm" && !(e.bon >= 0 && e.bon < e.choix.length)) { ko++; console.log("ECHEC qcm :", nom); }
    });
  }
  // Comportements du moteur
  const r1 = lancer({ code: "x = input('a ? ')\nprint(x)", entrees: [], test: false });
  const r2 = lancer({ code: "x = input('a ? ')\nprint(x)", entrees: ["5"], test: false });
  const r3 = lancer({ code: "def f():\n    return 1/0\nf()", entrees: [] });
  const r4 = lancer({ code: "if 3 > 2\n    print(1)", entrees: [] });
  console.log(JSON.stringify([r1, r2, r3.erreur, r4.erreur]));
  const t1 = lancer({ code: "def carre(x):\n    y = x * x\n    return y\n\ns = 0\nfor i in range(2):\n    s = s + carre(i + 1)\nprint(s)", entrees: [], trace: true });
  console.log("trace:", t1.pas.length, "pas ;", JSON.stringify(t1.pas.slice(4, 7)), JSON.stringify(t1.fin), t1.sortie);
  const t2 = lancer({ code: "x = 0\nwhile True:\n    x = x + 1", entrees: [], trace: true });
  const t3 = lancer({ code: "a = int(input('a ? '))\nprint(a / 0)", entrees: ["3"], trace: true });
  console.log("tronqué:", t2.tronque, t2.pas.length, "| erreur:", JSON.stringify(t3.erreur), t3.pas.length, JSON.stringify(t3.fin));
  if (t1.sortie.trim() !== "5" || !t2.tronque || !t3.erreur || t1.erreur) { ko++; console.log("ECHEC trace"); }
  const R = (code, regles) => JSON.stringify(lancer({ code, regles }));
  console.log("triches :", R("print(391)\nprint(1)", { requis: ["*", "%"] }), R("longueur = 8\nlargeur = 5\nperimetre = 26\naire = longueur * largeur", { depend: { perimetre: ["longueur", "largeur"], aire: ["longueur", "largeur"] } }),
    R("longueur = 8\nlargeur = 5\nd = longueur + largeur\nperimetre = 2 * d", { depend: { perimetre: ["longueur", "largeur"] } }), R("print('100 % sûr')\nL.sort()", { interdit: ["%", "sort", "sorted"] }));
  console.log(nbCaches, "tests cachés");
  console.log(`${n} étapes vérifiées, ${ko} échec(s)`);
  process.exit(ko ? 1 : 0);
})();
