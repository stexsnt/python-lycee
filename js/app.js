"use strict";
/* Mue — interface, progression et ludification. Le contenu est dans contenu.js. */

const CLE = "mue.v1";
const XP_BASE = { lecon: 5, qcm: 10, predire: 10, ordre: 15 };
const TOUS = [...PARCOURS.flatMap(p => p.chapitres), DEFIS];
const BAC_DEPART = `# Bac à sable : écris ce que tu veux, rien n'est noté.\nprenom = input("Ton prénom ? ")\nfor i in range(3):\n    print("Bonjour", prenom, "!" * (i + 1))\n`;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const aujourdhui = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ---------- État enregistré dans le navigateur ---------- */
function etatVide() {
  return { pseudo: "", xp: 0, faits: {}, codes: {}, serie: { n: 0, jour: "" }, badges: {}, bac: { code: BAC_DEPART, runs: 0 }, theme: "", compteurs: { sansIndice: 0, tenace: 0 }, defiJour: "" };
}
function charger() {
  try { return Object.assign(etatVide(), JSON.parse(localStorage.getItem(CLE) || "{}")); } catch (e) { return etatVide(); }
}
function sauver() { try { localStorage.setItem(CLE, JSON.stringify(S)); } catch (e) { /* stockage indisponible : la progression reste en mémoire */ } }
let S = charger();

/* ---------- Outils de progression ---------- */
const chapParId = id => TOUS.find(c => c.id === id);
const idEtape = (c, i) => c.id + "." + i;
const xpEtape = (c, e) => c.id === "defis" ? 50 : e.t === "code" ? 10 + 10 * (e.d || 1) : XP_BASE[e.t];
const avancement = c => { const f = c.etapes.filter((e, i) => S.faits[idEtape(c, i)]).length; return { n: c.etapes.length, f, fini: f === c.etapes.length }; };
const premierAFaire = c => { const i = c.etapes.findIndex((e, k) => !S.faits[idEtape(c, k)]); return i < 0 ? 0 : i; };
const etoilesChap = c => c.etapes.reduce((a, e, i) => { if (e.t === "lecon") return a; a.max += 3; a.n += (S.faits[idEtape(c, i)] || { e: 0 }).e; return a; }, { n: 0, max: 0 });
const defiDuJour = () => Math.floor(new Date(aujourdhui()).getTime() / 864e5) % DEFIS.etapes.length;
function prochainChapitre() {
  for (const p of PARCOURS) for (const c of p.chapitres) if (!avancement(c).fini) return c;
  return null;
}

const parcoursFini = id => PARCOURS.find(p => p.id === id).chapitres.every(c => avancement(c).fini);
const BADGES = [
  { id: "premier", nom: "Premier programme", desc: "Réussir un exercice de code", si: () => TOUS.some(c => c.etapes.some((e, i) => e.t === "code" && S.faits[idEtape(c, i)])) },
  { id: "chapitre", nom: "Première mue", desc: "Terminer un chapitre", si: () => PARCOURS.some(p => p.chapitres.some(c => avancement(c).fini)) },
  { id: "parfait", nom: "Sans une rayure", desc: "Obtenir toutes les étoiles d'un chapitre", si: () => PARCOURS.some(p => p.chapitres.some(c => { const s = etoilesChap(c); return avancement(c).fini && s.n === s.max; })) },
  { id: "filet", nom: "Sans filet", desc: "Réussir 10 exercices de code sans indice", si: () => S.compteurs.sansIndice >= 10 },
  { id: "tenace", nom: "Tenace", desc: "Réussir un exercice après 5 essais ratés", si: () => S.compteurs.tenace >= 1 },
  { id: "serie3", nom: "Trois jours de suite", desc: "Coder 3 jours d'affilée", si: () => S.serie.n >= 3 },
  { id: "serie7", nom: "Semaine complète", desc: "Coder 7 jours d'affilée", si: () => S.serie.n >= 7 },
  { id: "bac", nom: "Explorateur", desc: "Lancer 10 programmes dans le bac à sable", si: () => S.bac.runs >= 10 },
  { id: "defi", nom: "Goût du risque", desc: "Réussir un défi", si: () => avancement(DEFIS).f >= 1 },
  { id: "defis", nom: "Dompteur", desc: "Réussir tous les défis", si: () => avancement(DEFIS).fini },
  { id: "seconde", nom: "Parcours Seconde", desc: "Terminer tous les chapitres de Seconde", si: () => parcoursFini("seconde") },
  { id: "snt", nom: "Parcours SNT", desc: "Terminer tous les chapitres de SNT", si: () => parcoursFini("snt") },
  { id: "premiere", nom: "Parcours Première", desc: "Terminer tous les chapitres de Première", si: () => parcoursFini("premiere") },
  { id: "terminale", nom: "Parcours Terminale", desc: "Terminer tous les chapitres de Terminale", si: () => parcoursFini("terminale") },
];

/* Enregistre une réussite, renvoie les points gagnés. */
function reussir(c, i, etoiles) {
  const id = idEtape(c, i), e = c.etapes[i], deja = S.faits[id];
  const jour = aujourdhui(), hier = aujourdhui(new Date(Date.now() - 864e5));
  let gain = 0, double = false, etat = "nouveau";
  if (!deja) {
    gain = Math.round(xpEtape(c, e) * (etoiles === 3 ? 1 : etoiles === 2 ? 0.8 : 0.5));
    if (c.id === "defis" && defiDuJour() === i && S.defiJour !== jour) { gain *= 2; double = true; S.defiJour = jour; }
    S.faits[id] = { e: etoiles, j: jour };
  } else if (etoiles > deja.e) {
    // Les étoiles ne s'améliorent qu'un autre jour : refaire tout de suite, c'est recopier, pas retenir.
    if (deja.j === jour) etat = "attendre"; else { S.faits[id] = { e: etoiles, j: jour }; etat = "ameliore"; }
  } else etat = "inchange";
  const avant = niveau(S.xp);
  S.xp += gain;
  if (S.serie.jour !== jour) { S.serie.n = S.serie.jour === hier ? S.serie.n + 1 : 1; S.serie.jour = jour; }
  const apres = niveau(S.xp);
  if (apres.i > avant.i) toast(`Nouvelle mue : tu deviens ${apres.nom}`, "niveau");
  verifierBadges();
  sauver(); majEntete();
  return { gain, double, etat, total: S.faits[id].e };
}
function verifierBadges() {
  BADGES.forEach(b => { if (!S.badges[b.id] && b.si()) { S.badges[b.id] = aujourdhui(); toast(`Badge obtenu : ${b.nom}`, "badge"); } });
}

/* ---------- Petits composants ---------- */
function toast(msg, type = "") {
  const t = document.createElement("div"); t.className = "toast " + type; t.textContent = msg;
  $("#toasts").appendChild(t); setTimeout(() => t.remove(), 4200);
}
function confettis() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const z = document.createElement("div"); z.className = "confettis"; z.setAttribute("aria-hidden", "true");
  const couleurs = ["var(--ecaille)", "var(--soleil)", "var(--corail)", "var(--ciel)"];
  for (let k = 0; k < 44; k++) {
    const p = document.createElement("i");
    p.style.cssText = `left:${Math.random() * 100}%;background:${couleurs[k % 4]};animation-delay:${Math.random() * 0.5}s;animation-duration:${1.6 + Math.random() * 1.4}s;transform:rotate(${Math.random() * 360}deg)`;
    z.appendChild(p);
  }
  document.body.appendChild(z); setTimeout(() => z.remove(), 3600);
}
const etoilesHtml = (n, max = 3) => `<span class="etoiles" aria-label="${n} étoile${n > 1 ? "s" : ""} sur ${max}">${"★".repeat(n)}<span class="vide">${"★".repeat(max - n)}</span></span>`;

const RE_PY = /(#.*)|((?:\b[fFrRbB]{1,2})?(?:"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?))|\b(def|return|if|elif|else|for|while|in|import|from|as|and|or|not|True|False|None|break|continue|pass|lambda|is)\b|\b(print|input|int|float|str|bool|len|range|list|abs|round|min|max|sum|sorted|randint|random|sqrt|ord|chr)\b|(\b\d+(?:\.\d+)?\b)/g;
function colorer(code) {
  let out = "", fin = 0, m; RE_PY.lastIndex = 0;
  while ((m = RE_PY.exec(code))) {
    out += h(code.slice(fin, m.index)) + `<span class="t-${m[1] ? "c" : m[2] ? "s" : m[3] ? "k" : m[4] ? "b" : "n"}">${h(m[0])}</span>`;
    fin = RE_PY.lastIndex;
  }
  return out + h(code.slice(fin));
}
const blocCode = code => `<pre class="code">${colorer(code)}</pre>`;

/* Éditeur léger : textarea transparent posé sur une couche colorée. */
function editeur(code, opts = {}) {
  const el = document.createElement("div"); el.className = "ed";
  el.innerHTML = `<div class="ed-num" aria-hidden="true"></div><div class="ed-zone"><pre class="ed-hl" aria-hidden="true"></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="${h(opts.label || "Éditeur de code Python")}"></textarea></div>`;
  const ta = $("textarea", el), hl = $(".ed-hl", el), num = $(".ed-num", el);
  const maj = (silence) => {
    const v = ta.value, n = v.split("\n").length;
    hl.innerHTML = colorer(v) + "\n";
    num.textContent = Array.from({ length: n }, (_, k) => k + 1).join("\n");
    ta.rows = Math.max(n, opts.min || 5);
    if (!silence && opts.onChange) opts.onChange(v);
  };
  const inserer = t => { ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, "end"); maj(); };
  ta.addEventListener("input", () => maj());
  ta.addEventListener("scroll", () => { hl.scrollLeft = ta.scrollLeft; });
  ta.addEventListener("keydown", ev => {
    const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
    const debut = v.lastIndexOf("\n", a - 1) + 1, avant = v.slice(debut, a);
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") { ev.preventDefault(); opts.onRun && opts.onRun(); }
    else if (ev.key === "Tab" && !ev.shiftKey) { ev.preventDefault(); inserer("    "); }
    else if (ev.key === "Enter") {
      ev.preventDefault();
      const indent = avant.match(/^ */)[0] + (/:\s*(#.*)?$/.test(avant) ? "    " : "");
      inserer("\n" + indent);
    } else if (ev.key === "Backspace" && a === b && avant.length >= 4 && /^ +$/.test(avant) && avant.length % 4 === 0) {
      ev.preventDefault(); ta.setRangeText("", a - 4, a, "end"); maj();
    }
  });
  ta.value = code; maj(true);
  return { el, valeur: () => ta.value, fixer: v => { ta.value = v; maj(); }, focus: () => ta.focus() };
}

/* ---------- Exécution et messages d'erreur ---------- */
const AIDE = {
  SyntaxError: "Python ne comprend pas cette ligne. Vérifie les parenthèses, les guillemets, et les deux-points à la fin des lignes if, else, for, while et def.",
  IndentationError: "Problème d'indentation. Les instructions d'un bloc (après une ligne finissant par deux-points) doivent être décalées de 4 espaces, toutes de la même façon.",
  TabError: "Le décalage mélange tabulations et espaces. Utilise uniquement des espaces.",
  NameError: "Ce nom n'existe pas. Soit il y a une faute de frappe, soit la variable est utilisée avant d'avoir reçu une valeur. Un texte doit être entre guillemets.",
  TypeError: "L'opération mélange des types incompatibles, par exemple un texte et un nombre. Pense à int(...) ou float(...) pour convertir, et vérifie le nombre d'arguments des fonctions.",
  ValueError: "La valeur ne convient pas. Souvent, c'est int(...) ou float(...) appliqué à un texte qui n'est pas un nombre.",
  ZeroDivisionError: "Division par zéro. Vérifie la valeur du diviseur au moment du calcul.",
  IndexError: "Indice hors de la liste. Pour une liste de longueur n, les indices vont de 0 à n − 1.",
  KeyError: "Cette clé n'existe pas dans le dictionnaire.",
  AttributeError: "Cet objet ne possède pas cette méthode. Vérifie son nom et le type de la variable.",
  RecursionError: "La fonction s'appelle elle-même sans jamais s'arrêter. Il manque un cas de base, ou l'appel ne s'en rapproche pas.",
  ModuleNotFoundError: "Ce module n'est pas disponible ici. Les modules math et random le sont.",
  ImportError: "Ce nom n'existe pas dans le module. Vérifie l'orthographe.",
  UnboundLocalError: "Dans une fonction, cette variable est utilisée avant d'avoir reçu une valeur.",
  Temps: "Le programme a été arrêté car il tournait depuis trop longtemps. C'est sans doute une boucle infinie : dans une boucle while, quelque chose doit finir par rendre la condition fausse.",
  TropDeSortie: "Le programme affiche beaucoup trop de lignes : il a été arrêté. Vérifie tes boucles.",
  Chargement: "Python n'a pas pu se charger. Vérifie la connexion à Internet puis recharge la page.",
};
const NOM_ERR = { Temps: "Temps dépassé", TropDeSortie: "Affichage trop long", Chargement: "Python indisponible" };
function blocErreur(er) {
  return `<div class="err"><strong>${er.ligne ? `Ligne ${er.ligne}, ` : ""}${h(NOM_ERR[er.type] || er.type)}</strong><p>${AIDE[er.type] || "Python a rencontré une erreur pendant l'exécution."}</p>${er.msg ? `<code>${h(er.msg)}</code>` : ""}</div>`;
}
function afficherRes(cons, res) {
  const rien = !res.sortie && !res.erreur && res.besoin == null;
  cons.innerHTML = (res.sortie ? `<pre>${h(res.sortie)}</pre>` : "") +
    (rien ? `<p class="muet">Le programme s'est terminé sans rien afficher. Utilise print(...) pour voir un résultat.</p>` : "") +
    (res.erreur ? blocErreur(res.erreur) : "");
}
function attendrePython(cons) {
  if (Moteur.etat() !== "pret") cons.innerHTML = `<p class="muet charge">Python se prépare. Au premier lancement, cela prend quelques secondes…</p>`;
}
function demanderEntree(cons) {
  return new Promise(ok => {
    const f = document.createElement("form"); f.className = "saisie";
    f.innerHTML = `<input type="text" aria-label="Valeur à saisir" autocomplete="off" autocapitalize="off"><button class="btn petit">Valider</button>`;
    f.addEventListener("submit", ev => { ev.preventDefault(); ok($("input", f).value); });
    cons.appendChild(f); $("input", f).focus();
  });
}
/* input() sans bloquer la page : on relance le programme avec les valeurs déjà saisies. */
async function executerInteractif(code, cons) {
  const entrees = [], graine = Math.floor(Math.random() * 1e9);
  for (;;) {
    attendrePython(cons);
    const res = await Moteur.executer({ code, entrees, graine, test: false });
    if (!cons.isConnected) return res;
    afficherRes(cons, res);
    if (res.besoin == null) return res;
    entrees.push(await demanderEntree(cons));
  }
}

/* Pas à pas : le programme est exécuté une fois en enregistrant l'état avant chaque ligne,
   puis l'élève parcourt cet enregistrement en avant et en arrière. */
async function pasAPas(code, cons) {
  const entrees = [], graine = Math.floor(Math.random() * 1e9); let res;
  for (;;) {
    attendrePython(cons);
    res = await Moteur.executer({ code, entrees, graine, test: false, trace: true });
    if (!cons.isConnected) return;
    if (res.besoin == null) break;
    afficherRes(cons, res); entrees.push(await demanderEntree(cons));
  }
  if (!res.pas || !res.pas.length) return afficherRes(cons, res);
  const lignes = code.replace(/\s+$/, "").split("\n"), dernier = res.pas[res.pas.length - 1];
  const etapes = [...res.pas, { fin: true, g: res.fin || dernier.g, loc: res.erreur ? dernier.loc : null, n: res.sortie.length }];
  let k = 0;
  cons.innerHTML = `<div class="pap"><p class="pap-titre" aria-live="polite"></p>
    <div class="pap-cmd"><button class="btn petit secondaire" data-d="-1">Précédent</button><button class="btn petit" data-d="1">Suivant</button><input type="range" min="0" max="${etapes.length - 1}" value="0" aria-label="Étape du pas à pas"><span class="pap-n muet"></span></div>
    <div class="pap-corps"><div class="pap-code"></div><div class="pap-etat"></div></div></div>`;
  const table = (vars, avant) => vars.length ? `<table>${vars.map(([n, v]) => { const a = avant && avant.find(x => x[0] === n); return `<tr class="${!avant || (a && a[1] === v) ? "" : "change"}"><th scope="row">${h(n)}</th><td>${h(v)}${avant && !(a && a[1] === v) ? `<span class="sr"> (vient de changer)</span>` : ""}</td></tr>`; }).join("")}</table>` : `<p class="muet">Aucune variable pour l'instant.</p>`;
  const maj = () => {
    const e = etapes[k], p = k ? etapes[k - 1] : null;
    $(".pap-titre", cons).textContent = e.fin ? (res.erreur ? "Le programme s'arrête sur une erreur." : res.tronque ? "Le pas à pas s'arrête ici : 400 étapes au maximum." : "Programme terminé.")
      : e.renvoie !== undefined ? `Ligne ${e.ligne} : la fonction ${e.loc.nom} renvoie ${e.renvoie}.` : `Python va exécuter la ligne ${e.ligne}.`;
    $(".pap-n", cons).textContent = `${k + 1} / ${etapes.length}`;
    $("input[type=range]", cons).value = k;
    $('[data-d="-1"]', cons).disabled = k === 0; $('[data-d="1"]', cons).disabled = k === etapes.length - 1;
    $(".pap-code", cons).innerHTML = lignes.map((l, i) => `<div class="${!e.fin && e.ligne === i + 1 ? "va" : p && p.ligne === i + 1 ? "vient" : ""}"><span class="fleche" aria-hidden="true">${!e.fin && e.ligne === i + 1 ? "▶" : ""}</span><span class="num">${i + 1}</span><code>${colorer(l) || " "}</code></div>`).join("");
    const actif = $(".pap-code .va", cons); if (actif && actif.scrollIntoView) actif.scrollIntoView({ block: "nearest", inline: "nearest" });
    const sortie = res.sortie.slice(0, e.n);
    $(".pap-etat", cons).innerHTML = `<p class="pap-sous">Variables</p>${table(e.g, p && p.g)}` +
      (e.loc ? `<p class="pap-sous">Dans la fonction ${h(e.loc.nom)}</p>${table(e.loc.vars, p && p.loc && p.loc.nom === e.loc.nom ? p.loc.vars : null)}` : "") +
      `<p class="pap-sous">Affichage</p>${sortie ? `<pre>${h(sortie)}</pre>` : `<p class="muet">Rien pour l'instant.</p>`}` + (e.fin && res.erreur ? blocErreur(res.erreur) : "");
  };
  cons.onclick = ev => { const b = ev.target.closest("[data-d]"); if (b && cons.contains(b)) { k = Math.max(0, Math.min(etapes.length - 1, k + +b.dataset.d)); maj(); } };
  $("input[type=range]", cons).oninput = ev => { k = +ev.target.value; maj(); };
  maj();
}

const VIDE = { sortie: "", erreur: null, besoin: null, appels: [] };
async function verifier(e, code, cons) {
  // 1. Structure : mots et opérateurs exigés ou interdits, variables réellement calculées.
  const regles = { requis: e.requis || [], interdit: e.interdit || [], depend: e.depend || {} };
  if (regles.requis.length || regles.interdit.length || Object.keys(regles.depend).length) {
    attendrePython(cons);
    const st = await Moteur.executer({ code, regles });
    if (st.erreur) return { ok: false, lignes: [{ ok: false, txt: "La vérification n'a pas pu se faire.", plus: blocErreur(st.erreur) }] };
    const pb = [...st.manque.map(m => `Ton programme doit utiliser <code>${h(m)}</code>.`),
      ...st.interdit.map(m => `Dans cet exercice, <code>${h(m)}</code> n'est pas autorisé.`),
      ...st.depend.map(([v, noms]) => `La variable <code>${h(v)}</code> doit être calculée à partir de ${noms.map(x => `<code>${h(x)}</code>`).join(" et ")}, pas écrite directement.`)];
    if (pb.length) return { ok: false, lignes: pb.map(txt => ({ ok: false, txt })) };
  }
  const lignes = []; let ok = true;
  for (const t of e.tests) {
    attendrePython(cons);
    const r = await Moteur.executer({ code, entrees: t.entrees || [], test: true, appels: (t.appels || []).map(a => [a[0], a[1]]) });
    const avec = t.entrees && t.entrees.length ? `Avec ${t.entrees.length > 1 ? "les saisies" : "la saisie"} ${t.entrees.map(x => `<code>${h(x)}</code>`).join(", ")} : ` : "";
    if (r.erreur) { ok = false; lignes.push({ ok: false, txt: avec + "le programme s'arrête sur une erreur.", plus: blocErreur(r.erreur) }); break; }
    if (r.besoin != null) { ok = false; lignes.push({ ok: false, txt: avec + "le programme demande plus de saisies que prévu par l'énoncé." }); continue; }
    if (t.sortie !== undefined) {
      const bon = memesSorties(r.sortie, t.sortie); ok = ok && bon;
      lignes.push({ ok: bon, txt: avec + (bon ? "affichage correct." : "l'affichage ne correspond pas."),
        plus: bon ? "" : `<div class="compare"><div><span>Attendu</span><pre>${h(t.sortie)}</pre></div><div><span>Obtenu</span><pre>${h(normaliser(r.sortie)) || "(rien)"}</pre></div></div>` });
    }
    r.appels.forEach((a, k) => {
      const [expr, , libelle] = t.appels[k]; ok = ok && a.ok;
      if (libelle) lignes.push({ ok: a.ok, txt: h(libelle) + (a.erreur ? " : erreur pendant le test." : ""), plus: a.erreur ? blocErreur(a.erreur) : "" });
      else if (a.erreur) lignes.push({ ok: false, txt: `<code>${h(expr)}</code> provoque une erreur.`, plus: blocErreur(a.erreur) });
      else lignes.push({ ok: a.ok, txt: `<code>${h(expr)}</code> doit valoir <code>${h(a.attendu)}</code>` + (a.ok ? "" : `, mais vaut <code>${h(a.obtenu)}</code>${a.obtenu === "None" ? " (as-tu oublié return ?)" : ""}`) });
    });
  }
  // 3. Tests supplémentaires : d'autres valeurs que celles de l'énoncé, comparées à la solution de référence.
  if (ok && e.caches && e.caches.length) {
    const lancer = o => Moteur.executer(Object.assign({ entrees: [], test: true }, o));
    let echec = null;
    if (Array.isArray(e.caches[0])) {
      for (const entrees of e.caches) {
        const ref = await lancer({ code: e.solution, entrees }), r = await lancer({ code, entrees });
        if (r.erreur || r.besoin != null || !memesSorties(r.sortie, ref.sortie)) {
          echec = { txt: `Les exemples de l'énoncé passent, mais pas avec ${entrees.length > 1 ? "les saisies" : "la saisie"} ${entrees.map(x => `<code>${h(x)}</code>`).join(", ")}.`,
            plus: r.erreur ? blocErreur(r.erreur) : `<div class="compare"><div><span>Ton programme affiche</span><pre>${h(normaliser(r.sortie)) || "(rien)"}</pre></div></div>` };
          break;
        }
      }
    } else {
      const ref = await lancer({ code: e.solution, appels: e.caches.map(x => [x, "None"]) });
      const r = ref.erreur ? VIDE : await lancer({ code, appels: e.caches.map((x, k) => [x, ref.appels[k].obtenu]) });
      const k = r.erreur ? 0 : r.appels.findIndex(a => !a.ok);
      if (r.erreur) echec = { txt: "Les exemples de l'énoncé passent, mais un test supplémentaire provoque une erreur.", plus: blocErreur(r.erreur) };
      else if (k >= 0) echec = { txt: `Les exemples de l'énoncé passent, mais <code>${h(e.caches[k])}</code> ne donne pas le bon résultat` + (r.appels[k].erreur ? "." : ` : ta fonction renvoie <code>${h(r.appels[k].obtenu)}</code>.`), plus: r.appels[k].erreur ? blocErreur(r.appels[k].erreur) : "" };
    }
    if (echec) { ok = false; lignes.push(Object.assign({ ok: false }, echec)); }
    else lignes.push({ ok: true, txt: "Tests supplémentaires avec d'autres valeurs : réussis." });
  }
  return { ok, lignes };
}
const listeTests = lignes => `<ul class="resultats">${lignes.map(l => `<li class="${l.ok ? "ok" : "ko"}"><span class="marque" aria-hidden="true">${l.ok ? "✓" : "✗"}</span><div><span class="sr">${l.ok ? "Réussi : " : "Raté : "}</span>${l.txt}${l.plus || ""}</div></li>`).join("")}</ul>`;

/* ---------- En-tête ---------- */
function majEntete() {
  const nv = niveau(S.xp), pc = nv.max ? Math.round(100 * (S.xp - nv.min) / (nv.max - nv.min)) : 100;
  $("#stat-niveau").textContent = nv.nom;
  $("#stat-xp").textContent = S.xp + " XP";
  $("#jauge-xp").style.width = pc + "%";
  $("#stat-serie").textContent = S.serie.jour === aujourdhui() || S.serie.jour === aujourdhui(new Date(Date.now() - 864e5)) ? S.serie.n : 0;
}
function appliquerTheme() {
  const sombre = S.theme ? S.theme === "sombre" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = sombre ? "sombre" : "clair";
  $("#btn-theme").setAttribute("aria-pressed", sombre);
}

/* ---------- Vues ---------- */
const app = () => $("#app");

function vueAccueil() {
  const suite = prochainChapitre(), commence = Object.keys(S.faits).length > 0;
  const lien = suite ? `#/c/${suite.id}/${premierAFaire(suite)}` : "#/defis";
  app().innerHTML = `
  <section class="hero">
    <div class="hero-texte">
      <h1>Python s'apprend en l'écrivant.</h1>
      <p>Des leçons de deux minutes, des exercices corrigés à l'instant, et un serpent qui s'allonge à chaque chapitre terminé. Tout se passe dans le navigateur, sans compte ni installation.</p>
      <a class="btn gros" href="${lien}">${!suite ? "Relever un défi" : commence ? `Reprendre : ${h(suite.titre)}` : "Commencer le premier chapitre"}</a>
    </div>
    <div class="hero-demo">
      <div class="ed-hote"></div>
      <div class="actions"><button class="btn" id="demo-run">Exécuter</button><span class="muet">Change le prénom, puis relance.</span></div>
      <div class="cons" aria-live="polite"></div>
    </div>
  </section>
  ${PARCOURS.map(p => {
    const tete = Math.min(p.chapitres.findIndex(c => !avancement(c).fini) < 0 ? p.chapitres.length - 1 : p.chapitres.findIndex(c => !avancement(c).fini), p.chapitres.length - 1);
    const tousFinis = p.chapitres.every(c => avancement(c).fini);
    return `<section class="parcours" aria-labelledby="t-${p.id}">
      <header><h2 id="t-${p.id}">${h(p.titre)}</h2><p>${h(p.sous)}</p></header>
      <ol class="serpent" data-tete="${tete}">
        <svg aria-hidden="true"></svg>
        ${p.chapitres.map((c, k) => {
          const a = avancement(c), s = etoilesChap(c), estTete = k === tete && !tousFinis;
          return `<li class="rang" style="--k:${[0, 1, 2, 1][k % 4]}">
            <a class="noeud ${a.fini ? "fait" : ""} ${estTete ? "tete" : ""}" href="#/c/${c.id}/${premierAFaire(c)}" aria-label="Chapitre ${k + 1}, ${h(c.titre)}, ${a.f} étapes sur ${a.n}">
              ${estTete ? `<span class="yeux"><i></i><i></i></span>` : a.fini ? "✓" : k + 1}
            </a>
            <div class="rang-texte">
              <a href="#/c/${c.id}/${premierAFaire(c)}"><strong>${h(c.titre)}</strong></a>
              <span>${h(c.resume)}</span>
              <span class="rang-etat">${a.f > 0 ? `${a.f} / ${a.n} étapes ${etoilesHtml(s.n ? Math.max(1, Math.round(3 * s.n / s.max)) : 0)}` : `${a.n} étapes`}</span>
            </div>
          </li>`; }).join("")}
      </ol>
    </section>`; }).join("")}
  <section class="parcours fin-parcours">
    <header><h2>Défis</h2><p>Six problèmes plus corsés, à tenter quand tu veux. Celui du jour rapporte le double.</p></header>
    <a class="btn secondaire" href="#/defis">Voir les défis</a>
  </section>`;
  const cons = $(".hero-demo .cons");
  const ed = editeur(`prenom = "Ada"\nfor i in range(1, 4):\n    print("Bravo", prenom, "!" * i)`, { min: 3, onRun: () => lancer() });
  $(".hero-demo .ed-hote").appendChild(ed.el);
  const lancer = () => executerInteractif(ed.valeur(), cons);
  $("#demo-run").onclick = lancer;
  requestAnimationFrame(dessinerSerpents);
}

function dessinerSerpents() {
  $$(".serpent").forEach(s => {
    const svg = $("svg", s), r = s.getBoundingClientRect();
    if (!r.width) return;
    const pts = $$(".noeud", s).map(n => { const b = n.getBoundingClientRect(); return [b.left - r.left + b.width / 2, b.top - r.top + b.height / 2]; });
    const chemin = p => p.map((q, k) => { if (!k) return `M${q[0]} ${q[1]}`; const o = p[k - 1], my = (o[1] + q[1]) / 2; return `C${o[0]} ${my} ${q[0]} ${my} ${q[0]} ${q[1]}`; }).join(" ");
    const tete = +s.dataset.tete;
    svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
    svg.innerHTML = `<path class="piste" d="${chemin(pts)}"/>` + (tete > 0 ? `<path class="corps" d="${chemin(pts.slice(0, tete + 1))}"/><path class="ecailles" d="${chemin(pts.slice(0, tete + 1))}"/>` : "");
  });
}

function vueChapitre(c, brut) {
  const parc = PARCOURS.find(p => p.chapitres.includes(c));
  const estDefi = c.id === "defis";
  if (brut === "fin") return vueFin(c, parc);
  const i = Math.max(0, Math.min(c.etapes.length - 1, parseInt(brut, 10) || 0)), e = c.etapes[i];
  const noms = { lecon: "Leçon", qcm: "Question", predire: "Prédiction", ordre: "Remise en ordre", code: "Exercice" };
  app().innerHTML = `
  <div class="fil">
    <a href="${estDefi ? "#/defis" : "#/"}" class="retour">${estDefi ? "Tous les défis" : "Parcours"}</a>
    <span class="fil-titre">${estDefi ? "Défi" : `${h(parc.titre)}, chapitre ${parc.chapitres.indexOf(c) + 1}`} : <strong>${h(estDefi ? e.titre : c.titre)}</strong></span>
    ${estDefi ? "" : `<ol class="pas" aria-label="Étapes du chapitre">${c.etapes.map((x, k) => `<li><a href="#/c/${c.id}/${k}" class="${S.faits[idEtape(c, k)] ? "fait" : ""} ${x.t === "lecon" ? "lecon" : ""}" ${k === i ? 'aria-current="step"' : ""} title="${noms[x.t]}${x.titre ? " : " + h(x.titre) : ""}"><span class="sr">Étape ${k + 1}, ${noms[x.t]}</span></a></li>`).join("")}</ol>`}
  </div>
  <article class="etape etape-${e.t}"></article>
  <nav class="etape-nav" aria-label="Navigation entre les étapes">
    ${!estDefi && i > 0 ? `<a href="#/c/${c.id}/${i - 1}">Étape précédente</a>` : "<span></span>"}
    ${!estDefi ? `<a href="#/c/${c.id}/${i + 1 < c.etapes.length ? i + 1 : "fin"}">${i + 1 < c.etapes.length ? "Passer à la suite" : "Bilan du chapitre"}</a>` : ""}
  </nav>`;
  ({ lecon: etapeLecon, qcm: etapeQcm, predire: etapePredire, ordre: etapeOrdre, code: etapeCode })[e.t]($(".etape"), c, i, e);
}

const suivant = (c, i) => c.id === "defis" ? "#/defis" : `#/c/${c.id}/${i + 1 < c.etapes.length ? i + 1 : "fin"}`;
function bandeauSucces(z, c, i, etoiles, expl) {
  const { gain, double, etat, total } = reussir(c, i, etoiles);
  const b = document.createElement("div"); b.className = "succes"; b.setAttribute("role", "status");
  const suite = { ameliore: `<span class="gain">Étoiles améliorées</span>`, inchange: `<span class="muet">Déjà validé auparavant</span>`,
    attendre: `<p>Tes étoiles ne changent pas aujourd'hui : refaire tout de suite, c'est recopier. Reviens un autre jour et réussis sans aide pour en gagner.</p>` }[etat];
  b.innerHTML = `<div><strong>Réussi ${etoilesHtml(total)}</strong>${gain ? `<span class="gain">+${gain} XP${double ? " (défi du jour, points doublés)" : ""}</span>` : suite}${expl ? `<p>${h(expl)}</p>` : ""}</div><a class="btn" href="${suivant(c, i)}">${c.id === "defis" ? "Retour aux défis" : "Continuer"}</a>`;
  z.appendChild(b); $("a", b).focus({ preventScroll: true }); b.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function etapeLecon(z, c, i, e) {
  z.innerHTML = `<h1>${h(e.titre)}</h1><div class="prose">${e.texte}</div>${e.code ? `<div class="essai"><p class="essai-titre">À toi d'essayer</p><div class="ed-hote"></div><div class="actions"><button class="btn secondaire" id="run">Exécuter</button><button class="btn secondaire" id="pap">Pas à pas</button></div><div class="cons"></div></div>` : ""}<div class="actions fin"><button class="btn" id="compris">${S.faits[idEtape(c, i)] ? "Continuer" : "J'ai compris, continuer"}</button></div>`;
  if (e.code) {
    const ed = editeur(e.code, { min: 3, onRun: () => go() }), cons = $(".cons", z);
    $(".ed-hote", z).appendChild(ed.el);
    const go = () => { cons.onclick = null; return executerInteractif(ed.valeur(), cons); };
    $("#run", z).onclick = go;
    $("#pap", z).onclick = () => pasAPas(ed.valeur(), cons);
  }
  $("#compris", z).onclick = () => { const { gain } = reussir(c, i, 3); if (gain) toast(`+${gain} XP`); location.hash = suivant(c, i); };
}

function etapeQcm(z, c, i, e) {
  let essais = 0, fini = false;
  z.innerHTML = `<h1>${h(e.q)}</h1>${e.code ? blocCode(e.code) : ""}<div class="choix">${e.choix.map((x, k) => `<button data-k="${k}">${h(x)}</button>`).join("")}</div><div class="retour-qcm" aria-live="polite"></div>`;
  $$(".choix button", z).forEach(b => b.onclick = () => {
    if (fini) return; essais++;
    if (+b.dataset.k === e.bon) {
      fini = true; b.classList.add("bon"); $$(".choix button", z).forEach(x => x.disabled = x !== b);
      $(".retour-qcm", z).textContent = "";
      bandeauSucces(z, c, i, Math.max(1, 4 - essais), e.expl);
    } else { b.classList.add("faux"); b.disabled = true; $(".retour-qcm", z).textContent = "Ce n'est pas ça. Relis le code ligne par ligne et réessaie."; }
  });
}

function etapePredire(z, c, i, e) {
  let essais = 0, vu = false, fini = false;
  z.innerHTML = `<h1>Qu'affiche ce programme ?</h1><p class="prose">Exécute-le dans ta tête, ligne après ligne, puis écris exactement ce qui s'affichera.</p>${blocCode(e.code)}
  <label for="rep">Ta prédiction (une ligne par affichage)</label><textarea id="rep" class="reponse" rows="${Math.max(2, e.attendu.split("\n").length)}" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
  <div class="actions"><button class="btn" id="ok">Vérifier</button><button class="btn lien" id="voir" hidden>Exécuter le programme pour voir</button></div><div class="cons" aria-live="polite" hidden></div><div class="retour-qcm" aria-live="polite"></div>`;
  $("#ok", z).onclick = () => {
    if (fini) return; essais++;
    if (memesSorties($("#rep", z).value, e.attendu)) { fini = true; $(".retour-qcm", z).textContent = ""; bandeauSucces(z, c, i, vu ? 1 : essais === 1 ? 3 : 2, e.expl); }
    else { $(".retour-qcm", z).textContent = "Pas tout à fait. Note la valeur de chaque variable après chaque ligne."; if (essais >= 2) $("#voir", z).hidden = false; }
  };
  $("#voir", z).onclick = async () => { vu = true; const cons = $(".cons", z); cons.hidden = false; await executerInteractif(e.code, cons); };
}

function melanger(lignes) {
  let g = lignes.join("").length * 7919 + 13; const alea = () => (g = (g * 1103515245 + 12345) % 2147483648) / 2147483648;
  const t = lignes.map((x, k) => k);
  for (let k = t.length - 1; k > 0; k--) { const j = Math.floor(alea() * (k + 1)); [t[k], t[j]] = [t[j], t[k]]; }
  if (t.every((x, k) => x === k)) t.reverse();
  return t.map(k => lignes[k]);
}
function etapeOrdre(z, c, i, e) {
  let ordre = melanger(e.lignes), essais = 0, fini = false;
  z.innerHTML = `<h1>Remets les lignes dans l'ordre</h1><p class="prose">${h(e.q)}</p><ol class="lignes"></ol><div class="actions"><button class="btn" id="ok">Vérifier</button></div><div class="cons" aria-live="polite" hidden></div><div class="retour-qcm" aria-live="polite"></div>`;
  const liste = $(".lignes", z);
  const dessiner = (focus) => {
    liste.innerHTML = ordre.map((l, k) => `<li><pre class="code">${colorer(l)}</pre><span class="fleches"><button data-d="-1" data-k="${k}" aria-label="Monter la ligne ${k + 1}" ${k === 0 ? "disabled" : ""}>↑</button><button data-d="1" data-k="${k}" aria-label="Descendre la ligne ${k + 1}" ${k === ordre.length - 1 ? "disabled" : ""}>↓</button></span></li>`).join("");
    if (focus) { const b = $(`button[data-k="${focus[0]}"][data-d="${focus[1]}"]`, liste); (b && !b.disabled ? b : $(`button[data-k="${focus[0]}"]:not(:disabled)`, liste)).focus(); }
  };
  liste.onclick = ev => {
    const b = ev.target.closest("button"); if (!b || fini) return;
    const k = +b.dataset.k, j = k + +b.dataset.d; [ordre[k], ordre[j]] = [ordre[j], ordre[k]]; dessiner([j, b.dataset.d]);
  };
  dessiner();
  $("#ok", z).onclick = async () => {
    if (fini) return; essais++;
    const cons = $(".cons", z); cons.hidden = false; attendrePython(cons);
    const r = await Moteur.executer({ code: ordre.join("\n"), entrees: [], test: true });
    afficherRes(cons, r);
    if (!r.erreur && memesSorties(r.sortie, e.attendu)) { fini = true; $(".retour-qcm", z).textContent = ""; bandeauSucces(z, c, i, essais === 1 ? 3 : 2, e.expl); }
    else $(".retour-qcm", z).textContent = r.erreur ? "Dans cet ordre, le programme provoque une erreur. Regarde bien l'indentation : elle indique quelles lignes vont ensemble." : `Le programme s'exécute, mais il devrait afficher ${e.attendu}.`;
  };
}

function etapeCode(z, c, i, e) {
  const id = idEtape(c, i); let essais = 0, indices = 0, sol = false, occupe = false, revu = false;
  // Exercice déjà validé sans toutes ses étoiles : un autre jour, on repart du code de départ.
  const deja0 = S.faits[id], ancien = S.codes[id], aRefaire = deja0 && deja0.e < 3, repart = aRefaire && deja0.j !== aujourdhui();
  z.innerHTML = `<div class="duo">
    <div class="enonce"><h1>${h(e.titre)}</h1><p class="difficulte">Difficulté ${"●".repeat(e.d || 1)}<span class="vide">${"●".repeat(3 - (e.d || 1))}</span><span class="sr"> ${e.d || 1} sur 3</span></p><div class="prose">${e.enonce}</div>${!aRefaire ? "" : `<div class="indice refaire"><strong>Déjà validé ${etoilesHtml(deja0.e)}</strong> ${repart ? `Pour gagner des étoiles, réécris ton programme de mémoire, sans indice, et réussis du premier coup.${ancien !== undefined ? ` <button class="btn lien" id="ancien">Revoir mon dernier programme</button>` : ""}` : "Tu pourras améliorer tes étoiles un autre jour, en réécrivant ton programme de mémoire."}</div>`}<div class="indices" aria-live="polite"></div></div>
    <div class="atelier">
      <div class="ed-hote"></div>
      <div class="actions"><button class="btn" id="verif">Vérifier</button><button class="btn secondaire" id="run">Exécuter</button><button class="btn secondaire" id="pap">Pas à pas</button><button class="btn lien" id="indice">${e.indices && e.indices.length ? "Un indice" : ""}</button><button class="btn lien" id="raz">Recommencer</button><button class="btn lien" id="sol" hidden>Voir une solution</button></div>
      <div class="cons"><p class="muet">Exécuter lance ton programme librement. Pas à pas le déroule ligne par ligne en montrant les variables. Vérifier le soumet aux tests.</p></div>
      <div class="tests" aria-live="polite"></div>
    </div></div>`;
  const cons = $(".cons", z), tests = $(".tests", z);
  const ed = editeur(S.codes[id] !== undefined && !repart ? S.codes[id] : e.depart, { min: 8, onChange: v => { S.codes[id] = v; sauver(); }, onRun: () => $("#run", z).click() });
  $(".ed-hote", z).appendChild(ed.el);
  if (!e.indices || !e.indices.length) $("#indice", z).hidden = true;
  $("#run", z).onclick = async () => { tests.innerHTML = ""; cons.onclick = null; await executerInteractif(ed.valeur(), cons); };
  $("#pap", z).onclick = async () => { tests.innerHTML = ""; await pasAPas(ed.valeur(), cons); };
  $("#indice", z).onclick = () => {
    if (indices >= e.indices.length) return;
    $(".indices", z).insertAdjacentHTML("beforeend", `<p class="indice"><strong>Indice ${indices + 1}.</strong> ${h(e.indices[indices])}</p>`); indices++;
    if (indices >= e.indices.length) $("#indice", z).hidden = true; else $("#indice", z).textContent = "Un autre indice";
  };
  $("#raz", z).onclick = () => { ed.fixer(e.depart); ed.focus(); };
  if ($("#ancien", z)) $("#ancien", z).onclick = ev => { revu = true; ed.fixer(ancien); ev.currentTarget.outerHTML = " Ton programme est rechargé : cette fois-ci, les étoiles ne changeront pas."; };
  $("#sol", z).onclick = () => { sol = true; $(".indices", z).insertAdjacentHTML("beforeend", `<div class="indice"><strong>Une solution possible.</strong> Lis-la, comprends-la, puis réécris-la sans la copier.${blocCode(e.solution)}</div>`); $("#sol", z).hidden = true; };
  $("#verif", z).onclick = async () => {
    if (occupe) return; occupe = true; essais++;
    tests.innerHTML = ""; cons.innerHTML = `<p class="muet charge">Vérification en cours…</p>`;
    const r = await verifier(e, ed.valeur(), cons); occupe = false;
    if (!z.isConnected) return;
    cons.innerHTML = ""; tests.innerHTML = listeTests(r.lignes);
    if (r.ok) {
      if (!S.faits[id]) { if (!indices && !sol) S.compteurs.sansIndice++; if (essais >= 6) S.compteurs.tenace++; }
      const dejaFini = S.faits[id];
      bandeauSucces(tests, c, i, revu ? 0 : sol ? 1 : essais === 1 && !indices ? 3 : 2);
      if (!dejaFini && PARCOURS.some(p => p.chapitres.includes(c)) && avancement(c).fini) confettis();
    } else {
      tests.insertAdjacentHTML("afterbegin", `<p class="echec-titre">Pas encore. ${essais >= 3 ? "Un indice peut débloquer la situation." : "Lis le détail ci-dessous, corrige, puis vérifie à nouveau."}</p>`);
      if (essais >= 3 && !sol) $("#sol", z).hidden = false;
    }
  };
}

function vueFin(c, parc) {
  const a = avancement(c), s = etoilesChap(c), k = parc.chapitres.indexOf(c);
  const tous = PARCOURS.flatMap(p => p.chapitres), suite = tous[tous.indexOf(c) + 1];
  app().innerHTML = `<div class="fil"><a href="#/" class="retour">Parcours</a><span class="fil-titre">${h(parc.titre)}, chapitre ${k + 1} : <strong>${h(c.titre)}</strong></span></div>
  <article class="etape bilan">
    ${a.fini ? `<h1>Chapitre terminé, le serpent s'allonge.</h1><p class="bilan-etoiles">${s.n} / ${s.max} <span class="etoiles">★</span></p><p class="prose">${s.n === s.max ? "Toutes les étoiles : rien à redire." : "Pour gagner les étoiles manquantes, refais les exercices concernés un autre jour, de mémoire, sans indice et du premier coup."}</p>`
      : `<h1>Il reste ${a.n - a.f} étape${a.n - a.f > 1 ? "s" : ""} dans ce chapitre.</h1>`}
    <ol class="recap">${c.etapes.map((e, i) => { const f = S.faits[idEtape(c, i)]; return `<li class="${f ? "fait" : ""}"><a href="#/c/${c.id}/${i}">${h(e.titre || { qcm: "Question", predire: "Prédiction", ordre: "Remise en ordre" }[e.t])}</a>${f ? (e.t === "lecon" ? `<span class="muet">lue</span>` : etoilesHtml(f.e)) : `<span class="muet">à faire</span>`}</li>`; }).join("")}</ol>
    <div class="actions fin">${a.fini && suite ? `<a class="btn" href="#/c/${suite.id}/0">Chapitre suivant : ${h(suite.titre)}</a>` : !a.fini ? `<a class="btn" href="#/c/${c.id}/${premierAFaire(c)}">Reprendre le chapitre</a>` : `<a class="btn" href="#/defis">Passer aux défis</a>`}<a class="btn secondaire" href="#/">Retour au parcours</a></div>
  </article>`;
}

function vueDefis() {
  const jour = defiDuJour();
  app().innerHTML = `<section class="page"><h1>Défis</h1><p class="prose">Des problèmes sans leçon ni filet. Chacun rapporte 50 XP, et le défi du jour compte double.</p>
  <ul class="defis">${DEFIS.etapes.map((e, i) => { const f = S.faits[idEtape(DEFIS, i)]; return `<li class="${f ? "fait" : ""} ${i === jour ? "du-jour" : ""}"><a href="#/c/defis/${i}"><strong>${h(e.titre)}</strong>${i === jour ? `<span class="pastille">Défi du jour${S.defiJour === aujourdhui() || f ? "" : ", points doublés"}</span>` : ""}<span class="muet">${f ? "Réussi " + etoilesHtml(f.e) : "Difficulté " + "●".repeat(e.d)}</span></a></li>`; }).join("")}</ul></section>`;
}

function vueBac() {
  app().innerHTML = `<section class="page bac"><h1>Bac à sable</h1><p class="prose">Un espace libre pour tester une idée, vérifier un calcul ou préparer un exercice de maths. Ton programme est conservé d'une visite à l'autre.</p>
  <div class="ed-hote"></div><div class="actions"><button class="btn" id="run">Exécuter</button><button class="btn secondaire" id="pap">Pas à pas</button><button class="btn secondaire" id="dl">Télécharger le fichier .py</button><button class="btn lien" id="vider">Tout effacer</button></div><div class="cons"><p class="muet">Le résultat s'affichera ici. Raccourci : Ctrl + Entrée.</p></div></section>`;
  const cons = $(".cons"), ed = editeur(S.bac.code, { min: 14, onChange: v => { S.bac.code = v; sauver(); }, onRun: () => go() });
  $(".ed-hote").appendChild(ed.el);
  const go = async () => { S.bac.runs++; verifierBadges(); sauver(); await executerInteractif(ed.valeur(), cons); };
  $("#run").onclick = go;
  $("#pap").onclick = () => { S.bac.runs++; verifierBadges(); sauver(); return pasAPas(ed.valeur(), cons); };
  $("#vider").onclick = () => { ed.fixer(""); ed.focus(); };
  $("#dl").onclick = () => telecharger("programme.py", ed.valeur(), "text/x-python");
}
function telecharger(nom, contenu, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([contenu], { type })); a.download = nom; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function bilanTexte() {
  const nv = niveau(S.xp);
  return [`Bilan Mue de ${S.pseudo || "(sans pseudo)"} au ${new Date().toLocaleDateString("fr-FR")}`, `Niveau ${nv.nom}, ${S.xp} XP, série de ${S.serie.n} jour(s)`,
    ...PARCOURS.flatMap(p => [`${p.titre}`, ...p.chapitres.map(c => { const a = avancement(c), s = etoilesChap(c); return `  ${c.titre} : ${a.f}/${a.n} étapes, ${s.n}/${s.max} étoiles`; })]),
    `Défis : ${avancement(DEFIS).f}/${DEFIS.etapes.length}`].join("\n");
}
function vueProfil() {
  const nv = niveau(S.xp), nbExos = Object.keys(S.faits).length, total = TOUS.reduce((a, c) => a + c.etapes.length, 0);
  app().innerHTML = `<section class="page profil"><h1>Profil</h1>
  <div class="profil-haut">
    <div class="mue"><p class="mue-nom">${h(nv.nom)}</p><p>${S.xp} XP${nv.max ? `, prochaine mue à ${nv.max} XP (${h(NIVEAUX[nv.i + 1][1])})` : ", niveau maximal atteint"}</p><div class="jauge grand"><i style="width:${nv.max ? Math.round(100 * (S.xp - nv.min) / (nv.max - nv.min)) : 100}%"></i></div>
    <ol class="mues">${NIVEAUX.map((n, k) => `<li class="${k <= nv.i ? "fait" : ""}">${h(n[1])}</li>`).join("")}</ol></div>
    <dl class="chiffres"><div><dt>Étapes validées</dt><dd>${nbExos} / ${total}</dd></div><div><dt>Jours d'affilée</dt><dd>${S.serie.n}</dd></div><div><dt>Badges</dt><dd>${Object.keys(S.badges).length} / ${BADGES.length}</dd></div></dl>
  </div>
  <h2>Badges</h2>
  <ul class="badges">${BADGES.map(b => `<li class="${S.badges[b.id] ? "obtenu" : ""}"><span class="ecusson" aria-hidden="true"></span><div><strong>${h(b.nom)}</strong><span>${h(b.desc)}</span>${S.badges[b.id] ? "" : `<span class="sr">(pas encore obtenu)</span>`}</div></li>`).join("")}</ul>
  <h2>Mes informations</h2>
  <p class="prose">Ta progression est enregistrée uniquement dans ce navigateur. Rien n'est envoyé sur Internet. Pour changer d'appareil ou la montrer à ton professeur, utilise les boutons ci-dessous.</p>
  <label for="pseudo">Prénom et initiale du nom (nécessaire pour le code destiné au professeur)</label><input id="pseudo" type="text" maxlength="30" value="${h(S.pseudo)}" autocomplete="off">
  <div class="actions"><button class="btn" id="codeprof">Code pour mon professeur</button><button class="btn secondaire" id="bilan">Copier mon bilan</button><button class="btn secondaire" id="exp">Sauvegarder ma progression</button><label class="btn secondaire" for="imp">Restaurer une sauvegarde</label><input type="file" id="imp" accept="application/json,.json" class="sr"><button class="btn lien danger" id="raz">Tout effacer</button></div>
  <textarea id="bilan-txt" class="reponse large" rows="8" readonly hidden aria-label="Texte à copier"></textarea></section>`;
  $("#pseudo").oninput = ev => { S.pseudo = ev.target.value.trim(); sauver(); };
  $("#codeprof").onclick = async () => {
    if (!S.pseudo) { toast("Indique d'abord ton prénom dans le champ ci-dessus.", "erreur"); return $("#pseudo").focus(); }
    const t = $("#bilan-txt"); t.hidden = false; t.value = `${S.pseudo} : ${coderBilan(S, aujourdhui())}`;
    try { await navigator.clipboard.writeText(t.value); toast("Code copié : colle-le dans ton message au professeur"); } catch (e) { t.select(); }
  };
  $("#bilan").onclick = async () => { const t = $("#bilan-txt"); t.hidden = false; t.value = bilanTexte(); try { await navigator.clipboard.writeText(t.value); toast("Bilan copié"); } catch (e) { t.select(); } };
  $("#exp").onclick = () => telecharger(`mue-${S.pseudo || "progression"}.json`, JSON.stringify(S), "application/json");
  $("#imp").onchange = async ev => {
    try { const d = JSON.parse(await ev.target.files[0].text()); if (typeof d.xp !== "number" || !d.faits) throw 0; S = Object.assign(etatVide(), d); sauver(); majEntete(); appliquerTheme(); vueProfil(); toast("Progression restaurée"); }
    catch (e) { toast("Ce fichier n'est pas une sauvegarde Mue valide.", "erreur"); }
  };
  $("#raz").onclick = ev => {
    const b = ev.currentTarget;
    if (b.dataset.sur) { S = etatVide(); sauver(); majEntete(); vueProfil(); toast("Progression effacée"); }
    else { b.dataset.sur = 1; b.textContent = "Confirmer l'effacement définitif"; }
  };
}

/* ---------- Routage ---------- */
function route() {
  const m = location.hash.replace(/^#\/?/, "").split("/");
  $$("nav.principal a").forEach(a => a.removeAttribute("aria-current"));
  const onglet = m[0] === "c" ? (m[1] === "defis" ? "defis" : "") : m[0];
  const actif = $(`nav.principal a[data-onglet="${onglet}"]`); if (actif) actif.setAttribute("aria-current", "page");
  if (m[0] === "c" && chapParId(m[1])) vueChapitre(chapParId(m[1]), m[2]);
  else if (m[0] === "defis") vueDefis();
  else if (m[0] === "bac") vueBac();
  else if (m[0] === "profil") vueProfil();
  else vueAccueil();
  window.scrollTo(0, 0);
  const t = $("#app h1"); if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); }
}

window.addEventListener("hashchange", route);
window.addEventListener("resize", () => requestAnimationFrame(dessinerSerpents));
document.addEventListener("DOMContentLoaded", () => {
  appliquerTheme(); majEntete();
  $("#btn-theme").onclick = () => { S.theme = document.documentElement.dataset.theme === "sombre" ? "clair" : "sombre"; sauver(); appliquerTheme(); };
  Moteur.surEtat(e => { const p = $("#etat-python"); p.dataset.etat = e; p.textContent = { chargement: "Python se prépare…", pret: "Python est prêt", echec: "Python indisponible" }[e]; });
  Moteur.demarrer();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  route();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(dessinerSerpents);
});
