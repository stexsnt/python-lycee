/* Moteur d'exécution : Python (Pyodide) dans un Web Worker.
   Le worker est coupé puis relancé si un programme tourne trop longtemps. */

const PYODIDE_URL = (typeof window !== "undefined" && window.MUE_PYODIDE) || "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";
const DELAI_MAX = 8000;

const PY_HARNESS = String.raw`
import sys, io, json, random, traceback

class _BesoinEntree(Exception):
    pass

class _TropDeSortie(Exception):
    pass

class _Sortie(io.StringIO):
    def write(self, s):
        if self.tell() > 20000:
            raise _TropDeSortie()
        return super().write(s)

def _proche(a, b):
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) <= 1e-6 * max(1, abs(b))
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(_proche(x, y) for x, y in zip(a, b))
    return type(a) == type(b) and a == b

def _ligne(e):
    ligne = None
    for f in traceback.extract_tb(e.__traceback__):
        if f.filename == "<programme>":
            ligne = f.lineno
    return ligne

def _lancer(arguments):
    a = json.loads(arguments)
    sortie = _Sortie()
    attente = list(a.get("entrees") or [])
    test = a.get("test", False)

    def _input(invite=""):
        if not test:
            sortie.write(str(invite))
        if not attente:
            raise _BesoinEntree(str(invite))
        v = attente.pop(0)
        if not test:
            sortie.write(v + "\n")
        return v

    env = {"__name__": "__main__", "input": _input}
    res = {"sortie": "", "erreur": None, "besoin": None, "appels": []}
    ancien = sys.stdout
    sys.stdout = sortie
    random.seed(a.get("graine"))
    try:
        exec(compile(a["code"], "<programme>", "exec"), env)
        for expr, attendu in (a.get("appels") or []):
            try:
                v = eval(expr, env)
                att = eval(attendu, {})
                res["appels"].append({"ok": _proche(v, att), "obtenu": repr(v), "attendu": repr(att)})
            except _BesoinEntree:
                raise
            except BaseException as e:
                res["appels"].append({"ok": False, "attendu": attendu, "erreur": {"type": type(e).__name__, "msg": str(e), "ligne": _ligne(e)}})
    except _BesoinEntree as e:
        res["besoin"] = str(e)
    except _TropDeSortie:
        res["erreur"] = {"type": "TropDeSortie", "msg": "", "ligne": None}
    except SyntaxError as e:
        res["erreur"] = {"type": type(e).__name__, "msg": e.msg or "", "ligne": e.lineno}
    except BaseException as e:
        res["erreur"] = {"type": type(e).__name__, "msg": str(e), "ligne": _ligne(e)}
    finally:
        sys.stdout = ancien
    res["sortie"] = sortie.getvalue()
    return json.dumps(res)
`;

const NUM = /^-?\d+(\.\d+)?(e-?\d+)?$/i;
function normaliser(s) {
  return String(s).replace(/\r/g, "").split("\n").map(l => l.replace(/\s+$/, "")).join("\n").replace(/^\n+|\n+$/g, "");
}
/* Comparaison tolérante : espaces en trop ignorés, 12 et 12.0 équivalents. */
function memesSorties(a, b) {
  const A = normaliser(a).split("\n"), B = normaliser(b).split("\n");
  if (A.length !== B.length) return false;
  return A.every((l, k) => {
    const x = l.trim().split(/\s+/), y = B[k].trim().split(/\s+/);
    return x.length === y.length && x.every((t, j) => t === y[j] ||
      (NUM.test(t) && NUM.test(y[j]) && Math.abs(+t - +y[j]) <= 1e-6 * Math.max(1, Math.abs(+y[j]))));
  });
}

const Moteur = (() => {
  let w, pret, attente = null, n = 0, file = Promise.resolve(), etat = "chargement";
  const ecouteurs = [];
  const source = `import { loadPyodide } from ${JSON.stringify(PYODIDE_URL + "pyodide.mjs")};
let py;
(async () => {
  try {
    py = await loadPyodide({ indexURL: ${JSON.stringify(PYODIDE_URL)} });
    py.runPython(${JSON.stringify(PY_HARNESS)});
    postMessage({ pret: true });
  } catch (e) { postMessage({ echec: String(e) }); }
})();
onmessage = e => {
  const r = py.globals.get("_lancer")(JSON.stringify(e.data));
  postMessage({ id: e.data.id, res: JSON.parse(r) });
};`;

  function changer(e) { etat = e; ecouteurs.forEach(f => f(e)); }

  function demarrer() {
    changer("chargement");
    pret = new Promise((ok, ko) => {
      try {
        w = new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })), { type: "module" });
      } catch (e) { changer("echec"); return ko(e); }
      w.onmessage = e => {
        if (e.data.pret) { changer("pret"); ok(); }
        else if (e.data.echec) { changer("echec"); ko(new Error(e.data.echec)); }
        else if (attente && e.data.id === attente.id) {
          clearTimeout(attente.minuteur);
          const a = attente; attente = null; a.ok(e.data.res);
        }
      };
      w.onerror = e => { e.preventDefault && e.preventDefault(); if (etat !== "pret") { changer("echec"); ko(new Error("chargement")); } };
    });
    pret.catch(() => {});
  }

  function executer(opts) {
    const tache = file.then(async () => {
      try { await pret; }
      catch (e) { return { sortie: "", erreur: { type: "Chargement", msg: "", ligne: null }, besoin: null, appels: [] }; }
      return new Promise(ok => {
        const id = ++n;
        const minuteur = setTimeout(() => {
          w.terminate(); attente = null; demarrer();
          ok({ sortie: "", erreur: { type: "Temps", msg: "", ligne: null }, besoin: null, appels: [] });
        }, DELAI_MAX);
        attente = { id, ok, minuteur };
        w.postMessage(Object.assign({ id, graine: Math.floor(Math.random() * 1e9) }, opts));
      });
    });
    file = tache.catch(() => {});
    return tache;
  }

  return {
    demarrer, executer,
    etat: () => etat,
    surEtat: f => ecouteurs.push(f),
  };
})();
