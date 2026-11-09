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
  let ko = 0, n = 0;
  for (const c of [...PARCOURS.flatMap(p => p.chapitres), DEFIS]) {
    c.etapes.forEach((e, i) => {
      const nom = `${c.id}.${i} ${e.titre || e.t}`;
      n++;
      if (e.t === "code") {
        for (let k = 0; k < 3; k++) if (!passe(e, e.solution)) { ko++; console.log("ECHEC solution :", nom); break; }
        if (passe(e, e.depart)) { ko++; console.log("ECHEC départ déjà valide :", nom); }
        const nu = e.solution.replace(/#.*/g, "");
        if ((e.requis || []).some(m => !nu.includes(m)) || (e.interdit || []).some(m => nu.includes(m))) { ko++; console.log("ECHEC requis/interdit :", nom); }
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
  console.log(`${n} étapes vérifiées, ${ko} échec(s)`);
  process.exit(ko ? 1 : 0);
})();
