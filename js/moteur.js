/* Moteur d'exécution : Python (Pyodide) dans un Web Worker.
   Python n'est démarré qu'au moment où une page en a besoin (Moteur.preparer, appelé dès qu'un éditeur
   de code s'affiche, ou à la première exécution) : les leçons et les questions s'ouvrent sans lui.
   Le worker est coupé puis relancé si un programme tourne trop longtemps. */

/* Pyodide est d'abord cherché à la racine du domaine (dossier /pyodide/, partagé par Mue, Synapse, Périple
   et Sésame : un seul téléchargement pour les quatre sites), puis dans le dossier pyodide/ du site lui-même.
   Le CDN ne sert que de dernier secours. */
const PYODIDE_SOURCES = typeof location === "undefined" ? [] : [...new Set([
  (typeof window !== "undefined" && window.MUE_PYODIDE) || new URL("/pyodide/", location.href).href,
  new URL("pyodide/", location.href).href,
  "https://cdn.jsdelivr.net/npm/pyodide@314.0.7/",
])];
const DELAI_MAX = 8000, DELAI_PAQUETS = 120000;

const PY_HARNESS = String.raw`
import sys, io, json, random, traceback, ast

class _BesoinEntree(Exception):
    pass

class _TropDeSortie(Exception):
    pass

class _TropDePas(Exception):
    pass

def _court(v):
    r = repr(v)
    return r if len(r) <= 70 else r[:67] + "..."

def _visible(k, v):
    return not k.startswith("_") and k != "input" and not callable(v) and type(v).__name__ != "module"

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

# ----- Contrôle de la structure du programme, sur l'arbre syntaxique (pas sur le texte) -----
_MOTS = {"for": (ast.For,), "while": (ast.While,), "if": (ast.If, ast.IfExp), "def": (ast.FunctionDef,),
         "return": (ast.Return,), "import": (ast.Import, ast.ImportFrom)}
_OPS = {"+": ast.Add, "-": ast.Sub, "*": ast.Mult, "/": ast.Div, "//": ast.FloorDiv, "%": ast.Mod, "**": ast.Pow}

def _present(arbre, jeton):
    for n in ast.walk(arbre):
        if jeton in _MOTS:
            if isinstance(n, _MOTS[jeton]):
                return True
        elif jeton in _OPS:
            if isinstance(n, (ast.BinOp, ast.AugAssign)) and isinstance(n.op, _OPS[jeton]):
                return True
        elif jeton.replace(".", "", 1).isdigit():
            if isinstance(n, ast.Constant) and type(n.value) in (int, float) and n.value == float(jeton):
                return True
        elif (isinstance(n, ast.Name) and n.id == jeton) or (isinstance(n, ast.Attribute) and n.attr == jeton) \
                or (isinstance(n, ast.alias) and n.name == jeton):
            return True
    return False

def _dependances(arbre):
    dep = {}
    for n in ast.walk(arbre):
        cibles, valeur = [], None
        if isinstance(n, ast.Assign):
            cibles, valeur = n.targets, n.value
        elif isinstance(n, (ast.AugAssign, ast.AnnAssign)) and n.value is not None:
            cibles, valeur = [n.target], n.value
        for c in cibles:
            for t in ast.walk(c):
                if isinstance(t, ast.Name):
                    dep.setdefault(t.id, set()).update(x.id for x in ast.walk(valeur) if isinstance(x, ast.Name))
    return dep

def _atteint(dep, var):
    vus, pile = set(), [var]
    while pile:
        for x in dep.get(pile.pop(), ()):
            if x not in vus:
                vus.add(x)
                pile.append(x)
    return vus

def _structure(code, regles):
    res = {"manque": [], "interdit": [], "depend": []}
    try:
        arbre = ast.parse(code)
    except SyntaxError:
        return res
    res["manque"] = [j for j in regles.get("requis", []) if not _present(arbre, j)]
    res["interdit"] = [j for j in regles.get("interdit", []) if _present(arbre, j)]
    dep = _dependances(arbre)
    for var, noms in regles.get("depend", {}).items():
        absents = [x for x in noms if x not in _atteint(dep, var)]
        if absents:
            res["depend"].append([var, noms])
    return res

# Graphiques : matplotlib dessine hors écran ; chaque figure est rendue en image PNG et jointe au résultat.
_images = []

def _figures(*args, **kwargs):
    plt = sys.modules.get("matplotlib.pyplot")
    if plt is None:
        return
    import base64
    for n in plt.get_fignums():
        if len(_images) < 4:
            tampon = io.BytesIO()
            plt.figure(n).savefig(tampon, format="png", dpi=100, bbox_inches="tight")
            _images.append(base64.b64encode(tampon.getvalue()).decode())
    plt.close("all")

def _preparer_matplotlib():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.show = _figures          # plt.show() joint la figure au résultat au lieu d'ouvrir une fenêtre

def _lancer(arguments):
    a = json.loads(arguments)
    if "regles" in a:
        return json.dumps(_structure(a["code"], a["regles"]))
    _images.clear()
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
    pas = []
    etat = {"fin": None}

    def _instantane(frame):
        g = [[k, _court(v)] for k, v in frame.f_globals.items() if _visible(k, v)]
        loc = None
        if frame.f_code.co_name != "<module>":
            loc = {"nom": frame.f_code.co_name, "vars": [[k, _court(v)] for k, v in frame.f_locals.items() if _visible(k, v)]}
        return g, loc

    # Pas à pas : on note, avant chaque ligne, l'état des variables et la longueur de l'affichage.
    def _trace(frame, event, arg):
        c = frame.f_code
        if c.co_filename != "<programme>" or (c.co_name.startswith("<") and c.co_name != "<module>"):
            return None
        if event == "line":
            if len(pas) >= 400:
                raise _TropDePas()
            g, loc = _instantane(frame)
            pas.append({"ligne": frame.f_lineno, "g": g, "loc": loc, "n": sortie.tell()})
        elif event == "return":
            if c.co_name == "<module>":
                etat["fin"] = _instantane(frame)[0]
            elif arg is not None and len(pas) < 400:
                g, loc = _instantane(frame)
                pas.append({"ligne": frame.f_lineno, "g": g, "loc": loc, "n": sortie.tell(), "renvoie": _court(arg)})
        return _trace

    ancien = sys.stdout
    sys.stdout = sortie
    random.seed(a.get("graine"))
    try:
        programme = compile(a["code"], "<programme>", "exec")
        if a.get("trace"):
            sys.settrace(_trace)
        try:
            exec(programme, env)
        finally:
            sys.settrace(None)
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
    except _TropDePas:
        res["tronque"] = True
    except _TropDeSortie:
        res["erreur"] = {"type": "TropDeSortie", "msg": "", "ligne": None}
    except SyntaxError as e:
        res["erreur"] = {"type": type(e).__name__, "msg": e.msg or "", "ligne": e.lineno}
    except BaseException as e:
        res["erreur"] = {"type": type(e).__name__, "msg": str(e), "ligne": _ligne(e)}
    finally:
        sys.stdout = ancien
    try:
        _figures()
    except BaseException:
        pass
    if _images:
        res["images"] = list(_images)
    res["sortie"] = sortie.getvalue()
    if a.get("trace"):
        res["pas"] = pas
        res["fin"] = etat["fin"]
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
  let w, pret, attente = null, n = 0, file = Promise.resolve(), etat = "repos";
  const ecouteurs = [];
  const source = `const SOURCES = ${JSON.stringify(PYODIDE_SOURCES)};
let py = null;
(async () => {
  let erreur;
  for (const u of SOURCES) {
    try { const m = await import(u + "pyodide.mjs"); py = await m.loadPyodide({ indexURL: u }); break; }
    catch (e) { erreur = e; py = null; }
  }
  if (!py) return postMessage({ echec: String(erreur) });
  py.runPython(${JSON.stringify(PY_HARNESS)});
  postMessage({ pret: true });
})();
// matplotlib et numpy ne sont téléchargés que si le programme les importe (environ 13 Mo la première fois).
const charges = {};
async function paquets(code, id) {
  const noms = [];
  if (/^\\s*(?:import|from)\\s+matplotlib\\b/m.test(code)) noms.push("matplotlib");
  if (/^\\s*(?:import|from)\\s+numpy\\b/m.test(code)) noms.push("numpy");
  const manquants = noms.filter(n => !charges[n]);
  if (!manquants.length) return;
  postMessage({ id, charge: true });
  try {
    await py.loadPackage(manquants);
    if (manquants.includes("matplotlib")) py.runPython("_preparer_matplotlib()");
    manquants.forEach(n => charges[n] = true);
  } catch (e) { /* hors connexion : le programme signalera lui-même le module manquant */ }
  postMessage({ id, charge: false });
}
onmessage = async e => {
  if (typeof e.data.code === "string") await paquets(e.data.code, e.data.id);
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
        else if (attente && e.data.id === attente.id && "charge" in e.data) {
          // Téléchargement d'un module : il ne compte pas dans le temps accordé au programme.
          clearTimeout(attente.minuteur);
          attente.minuteur = setTimeout(attente.expire, e.data.charge ? DELAI_PAQUETS : DELAI_MAX);
          changer(e.data.charge ? "paquets" : "pret");
        }
        else if (attente && e.data.id === attente.id) {
          clearTimeout(attente.minuteur);
          const a = attente; attente = null; a.ok(e.data.res);
        }
      };
      w.onerror = e => { e.preventDefault && e.preventDefault(); if (etat !== "pret") { changer("echec"); ko(new Error("chargement")); } };
    });
    pret.catch(() => {});
  }

  // Démarre Python s'il ne tourne pas encore (ou relance après un échec).
  function preparer() { if (etat === "repos" || etat === "echec") demarrer(); }

  function executer(opts) {
    preparer();
    const tache = file.then(async () => {
      try { await pret; }
      catch (e) { return { sortie: "", erreur: { type: "Chargement", msg: "", ligne: null }, besoin: null, appels: [] }; }
      return new Promise(ok => {
        const id = ++n;
        const expire = () => {
          w.terminate(); attente = null; demarrer();
          ok({ sortie: "", erreur: { type: "Temps", msg: "", ligne: null }, besoin: null, appels: [] });
        };
        attente = { id, ok, expire, minuteur: setTimeout(expire, DELAI_MAX) };
        w.postMessage(Object.assign({ id, graine: Math.floor(Math.random() * 1e9) }, opts));
      });
    });
    file = tache.catch(() => {});
    return tache;
  }

  return {
    demarrer, preparer, executer,
    etat: () => etat,
    surEtat: f => ecouteurs.push(f),
  };
})();
