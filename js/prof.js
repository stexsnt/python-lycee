"use strict";
/* Espace professeur : plusieurs classes, tout est calculé et conservé dans ce navigateur. Rien n'est envoyé.
   Fichier identique sur Mue et Synapse : le site est reconnu au préfixe des codes. */
const PREFIXE = RE_BILAN.source.slice(0, 4);
const SITE = PREFIXE === "SYN1" ? "synapse" : "mue";
const CLE_V1 = SITE + ".prof.v1", CLE = SITE + ".prof.v2", SANS = "";
const $ = (s, r = document) => r.querySelector(s);
const h = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CHAPS = [...PARCOURS.flatMap(p => p.chapitres.map((c, k) => ({ c, parc: p.id, nom: c.num ? `Chapitre ${c.num}` : `${p.titre} ${k + 1}`, titre: c.titre })).filter(x => x.c.etapes.length)),
  ...(DEFIS.etapes.length ? [{ c: DEFIS, parc: "defis", nom: "Défis", titre: "" }] : [])];
const NOMS = { lecon: "Leçon", qcm: "Question", predire: "Prédiction", ordre: "Remise en ordre", code: "Exercice de code", tri: "Classement", quiz: "Questions", atelier: "Atelier" };
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const jour = d => String(d).slice(8, 10) + "/" + String(d).slice(5, 7);
const nomClasse = cl => cl === SANS ? "Sans classe" : cl;
const simple = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

let B = { classes: {} };                 // classes[nom] = { attendus: [noms], eleves: { clé: { c: code, a: code précédent } } }
let onglet = "*", tri = { col: "nom", sens: 1 }, filtre = "tous", edition = false, chapChoisi;

/* ---------- Conservation ---------- */
function sauver() { try { localStorage.setItem(CLE, JSON.stringify({ v: 2, classes: B.classes })); } catch (e) { /* stockage indisponible */ } }
function charger() {
  try {
    const o = JSON.parse(localStorage.getItem(CLE) || "null");
    if (o && o.classes) { B.classes = o.classes; return; }
    const ancien = localStorage.getItem(CLE_V1); if (ancien) ajouter(ancien, SANS);
  } catch (e) { /* rien */ }
}
const classe = cl => B.classes[cl] || (B.classes[cl] = { attendus: [], eleves: {} });
const nomsClasses = () => Object.keys(B.classes).sort((a, b) => (a === SANS) - (b === SANS) || a.localeCompare(b, "fr", { numeric: true }));
function menage() { const s = B.classes[SANS]; if (s && !Object.keys(s.eleves).length && !s.attendus.length) delete B.classes[SANS]; if (onglet !== "*" && !B.classes[onglet]) onglet = "*"; }

/* ---------- Réception des codes ---------- */
function integrer(cl, code, bilan) {
  const o = decoderBilan(code); if (!o) return "invalide";
  const cle = (String(o.p || "").trim() || "(sans prénom)").toLowerCase(), K = classe(cl), sans = B.classes[SANS];
  if (cl !== SANS && sans && sans.eleves[cle]) { if (!K.eleves[cle]) K.eleves[cle] = sans.eleves[cle]; delete sans.eleves[cle]; }
  const e = K.eleves[cle]; if (bilan) bilan[cl] = (bilan[cl] || 0) + 1;
  if (!e) { K.eleves[cle] = { c: code }; return "nouveau"; }
  if (e.c === code) return "connu";
  const a = decoderBilan(e.c);
  if (!a || o.d > a.d) { K.eleves[cle] = { c: code, a: a ? e.c : undefined }; return "maj"; }
  if (o.d === a.d && o.x >= a.x) { e.c = code; return "maj"; }
  return "connu";
}
function ajouter(texte, defaut) {
  const codes = texte.match(RE_BILAN) || [], r = { lus: codes.length, invalide: 0, nouveau: 0, maj: 0, connu: 0, par: {} };
  codes.forEach(code => { const o = decoderBilan(code); r[o ? integrer(normClasse(o.c) || defaut, code, r.par) : "invalide"]++; });
  menage(); sauver(); return r;
}
function eleves(cl) {
  if (cl === "*") return nomsClasses().flatMap(eleves);
  return Object.entries(B.classes[cl].eleves).map(([cle, e]) => {
    const o = decoderBilan(e.c); if (!o) return null;
    o.nom = String(o.p || "").trim() || "(sans prénom)"; o.cle = cle; o.cl = cl; o.prec = e.a ? decoderBilan(e.a) : null;
    o.delta = o.prec ? faites(o) - faites(o.prec) : null; return o;
  }).filter(Boolean);
}
function mesure(o, c) {
  const s = (o.f[c.id] || "").padEnd(c.etapes.length, "0");
  let f = 0, et = 0, max = 0;
  c.etapes.forEach((e, i) => { const v = +s[i] || 0; if (v) f++; if (e.t !== "lecon") { max += 3; et += v; } });
  return { f, n: c.etapes.length, et, max };
}
const faites = o => CHAPS.reduce((a, x) => a + mesure(o, x.c).f, 0);
const visibles = () => CHAPS.filter(x => filtre === "tous" || x.parc === filtre);
const moyenne = (liste, x) => liste.length ? Math.round(100 * liste.reduce((a, o) => a + mesure(o, x.c).f / x.c.etapes.length, 0) / liste.length) : 0;
function manquants(cl) {
  const K = B.classes[cl], noms = Object.values(K.eleves).map(e => { const o = decoderBilan(e.c); return simple(o ? o.p : ""); });
  return K.attendus.filter(a => { const s = simple(a); return s && !noms.some(n => n === s || (n.length > 2 && s.startsWith(n)) || (s.length > 2 && n.startsWith(s))); });
}

/* ---------- Affichage ---------- */
const selFiltre = () => `<label for="filtre" class="en-ligne">Afficher</label>
  <select id="filtre">${[["tous", "Tous les chapitres"], ...PARCOURS.filter(p => CHAPS.some(x => x.parc === p.id)).map(p => [p.id, p.titre]), ...(DEFIS.etapes.length ? [["defis", "Défis"]] : [])].map(([v, t]) => `<option value="${v}" ${v === filtre ? "selected" : ""}>${h(t)}</option>`).join("")}</select>`;
const selChap = () => `<div class="actions"><label for="chap" class="en-ligne">Chapitre</label><select id="chap">${CHAPS.map((x, k) => `<option value="${k}">${h(x.nom)}${x.titre ? " : " + h(x.titre) : ""}</option>`).join("")}</select></div><div id="detail"></div>`;
const caseChap = pc => `<td class="${pc >= 80 ? "plein" : pc >= 30 ? "partiel" : "vide"}">${pc} %</td>`;

function onglets() {
  const noms = nomsClasses(), z = $("#onglets");
  if (!noms.length) { z.innerHTML = ""; return; }
  const b = (id, txt, n) => `<button role="tab" data-onglet="${h(id)}" aria-selected="${onglet === id}">${h(txt)} <span class="nb">${n}</span></button>`;
  z.innerHTML = (noms.length > 1 ? b("*", "Toutes les classes", eleves("*").length) : "") + noms.map(cl => b(cl, nomClasse(cl), Object.keys(B.classes[cl].eleves).length)).join("") + `<button data-onglet="+" aria-selected="false">+ Classe</button>`;
  const s = $("#defaut"), v = s.value;
  s.innerHTML = `<option value="">Sans classe</option>` + noms.filter(cl => cl !== SANS).map(cl => `<option value="${h(cl)}">${h(cl)}</option>`).join("");
  s.value = noms.includes(v) ? v : "";
}
function dessiner() {
  menage(); const noms = nomsClasses(), z = $("#resultats");
  if (onglet === "*" && noms.length === 1) onglet = noms[0];
  onglets();
  if (!noms.length) { z.innerHTML = ""; return; }
  if (onglet === "*") vueToutes(z); else vueClasse(z, onglet);
  const liste = eleves(onglet), plusAvance = CHAPS.map((x, k) => [k, liste.filter(o => mesure(o, x.c).f).length]).filter(a => a[1]).pop();
  if ($("#chap")) { $("#chap").value = chapChoisi !== undefined ? chapChoisi : plusAvance ? plusAvance[0] : 0; detail(); }
}
function vueToutes(z) {
  const noms = nomsClasses(), cols = visibles(), tous = eleves("*");
  z.innerHTML = `
  <h2>Toutes les classes : ${pluriel(tous.length, "élève")}</h2>
  <div class="actions">${selFiltre()}<button class="btn secondaire" id="csv">Exporter pour le tableur (CSV)</button></div>
  <div class="defile" tabindex="0" role="region" aria-label="Comparaison des classes">
  <table class="classe">
    <thead><tr><th scope="col">Classe</th><th scope="col">Élèves</th><th scope="col">Sans code</th><th scope="col">XP moyen</th><th scope="col">Dernier code</th>${cols.map(x => `<th scope="col">${h(x.nom)}${x.titre ? `<span class="sous">${h(x.titre)}</span>` : ""}</th>`).join("")}</tr></thead>
    <tbody>${noms.map(cl => { const l = eleves(cl), m = manquants(cl).length, att = B.classes[cl].attendus.length;
      return `<tr><th scope="row"><button class="btn lien" data-onglet="${h(cl)}">${h(nomClasse(cl))}</button></th><td>${l.length}</td><td>${att ? m : "—"}</td><td>${l.length ? Math.round(l.reduce((a, o) => a + o.x, 0) / l.length) : "—"}</td><td>${l.length ? jour(l.map(o => o.d).sort().pop()) : "—"}</td>${cols.map(x => l.length ? caseChap(moyenne(l, x)) : `<td class="vide">—</td>`).join("")}</tr>`; }).join("")}</tbody>
  </table></div>
  <p class="muet">Chaque case donne l'avancement moyen de la classe dans le chapitre. « Sans code » compte les élèves attendus qui n'ont pas encore envoyé de code. Cliquez sur une classe pour l'ouvrir.</p>
  <h2>Où les classes calent</h2>${selChap()}`;
}
function vueClasse(z, cl) {
  const K = B.classes[cl], liste = eleves(cl), cols = visibles(), N = liste.length, manq = manquants(cl), autres = nomsClasses().filter(c => c !== cl);
  const val = (o, col) => col === "nom" ? o.nom.toLowerCase() : col === "xp" ? o.x : col === "date" ? o.d : col === "delta" ? (o.delta === null ? -1 : o.delta) : mesure(o, CHAPS[+col].c).f;
  const lignes = [...liste].sort((a, b) => { const x = val(a, tri.col), y = val(b, tri.col); return (x < y ? -1 : x > y ? 1 : 0) * tri.sens || a.nom.localeCompare(b.nom); });
  const entete = (col, txt, extra = "") => `<th scope="col" ${tri.col === String(col) ? `aria-sort="${tri.sens > 0 ? "ascending" : "descending"}"` : ""}><button data-tri="${col}">${txt}${tri.col === String(col) ? (tri.sens > 0 ? " ▲" : " ▼") : ""}</button>${extra}</th>`;
  const outils = o => edition ? `<span class="ligne-outils">${autres.length ? `<select class="mini" data-deplacer="${h(o.cle)}" aria-label="Déplacer ${h(o.nom)}"><option value="">Déplacer vers…</option>${autres.map(c => `<option value="${h(c)}">${h(nomClasse(c))}</option>`).join("")}</select>` : ""}<button class="mini" data-retirer="${h(o.cle)}">Retirer</button></span>` : "";
  z.innerHTML = `
  <h2>${h(nomClasse(cl))} : ${pluriel(N, "élève")}</h2>
  <div class="gestion">
    ${cl !== SANS ? `<button class="btn secondaire" id="lien">Lien à donner aux élèves</button>` : ""}
    <button class="btn secondaire" id="editer" aria-pressed="${edition}">${edition ? "Terminer les modifications" : "Modifier la classe"}</button>
    ${edition && cl !== SANS ? `<label for="nouveau-nom" class="en-ligne">Nom</label><input id="nouveau-nom" class="court" type="text" maxlength="12" value="${h(cl)}"><button class="btn secondaire" id="renommer">Renommer</button>` : ""}
    ${edition ? `<button class="btn lien danger" id="supprimer">Supprimer la classe</button>` : ""}
  </div>
  <p id="lien-txt" class="muet" hidden></p>
  ${cl === SANS ? `<p class="muet">Ces codes ne portent pas de classe : l'élève n'a pas rempli le champ « Classe » de son profil. « Modifier la classe » permet de les déplacer.</p>` : ""}
  ${manq.length ? `<p class="manquants"><strong>Pas encore de code (${manq.length}) :</strong> ${manq.map(h).join(", ")}</p>` : ""}
  <details ${edition && !K.attendus.length ? "open" : ""}><summary>Élèves attendus${K.attendus.length ? ` (${K.attendus.length})` : ""}</summary>
    <label for="attendus">Un élève par ligne, comme il l'écrit dans son profil (prénom et initiale). Sert à repérer ceux qui n'ont pas envoyé de code.</label>
    <textarea id="attendus" class="reponse large" rows="6" spellcheck="false">${h(K.attendus.join("\n"))}</textarea>
    <div class="actions"><button class="btn secondaire" id="ok-attendus">Enregistrer la liste</button></div></details>
  ${N ? `<div class="actions">${selFiltre()}<button class="btn secondaire" id="csv">Exporter pour le tableur (CSV)</button></div>
  <div class="defile" tabindex="0" role="region" aria-label="Tableau de la classe">
  <table class="classe">
    <thead><tr>${entete("nom", "Élève")}${entete("xp", "XP")}${entete("date", "Code du")}${entete("delta", "Progrès")}${cols.map(x => entete(CHAPS.indexOf(x), h(x.nom), x.titre ? `<span class="sous">${h(x.titre)}</span>` : "")).join("")}</tr></thead>
    <tbody>${lignes.map(o => `<tr><th scope="row">${h(o.nom)}${outils(o)}</th><td>${o.x}<span class="sous">${h(niveau(o.x).nom)}</span></td><td>${jour(o.d)}<span class="sous">série ${+o.s || 0} j</span></td><td class="delta">${o.delta === null ? "—" : (o.delta > 0 ? "+" : "") + o.delta}<span class="sous">${o.prec ? "depuis le " + jour(o.prec.d) : "premier code"}</span></td>${cols.map(x => { const m = mesure(o, x.c); return `<td class="${m.f === m.n ? "plein" : m.f ? "partiel" : "vide"}">${m.f}/${m.n}<span class="sous">${m.f ? `★ ${m.et}/${m.max}` : "&nbsp;"}</span></td>`; }).join("")}</tr>`).join("")}</tbody>
    <tfoot><tr><th scope="row">Moyenne de la classe</th><td>${Math.round(liste.reduce((a, o) => a + o.x, 0) / N)}</td><td></td><td></td>${cols.map(x => `<td>${moyenne(liste, x)} %</td>`).join("")}</tr></tfoot>
  </table></div>
  <p class="muet">Chaque case indique les étapes validées sur le total du chapitre, puis les étoiles obtenues. « Progrès » compte les étapes validées depuis le code précédent du même élève. Cliquez sur un en-tête pour trier.</p>
  <h2>Où la classe cale</h2>${selChap()}` : `<p class="muet">Aucun code reçu pour cette classe pour le moment.</p>`}`;
}
function detail() {
  const x = CHAPS[+$("#chap").value], groupes = onglet === "*" ? nomsClasses().map(cl => [nomClasse(cl), eleves(cl)]).filter(g => g[1].length) : [[nomClasse(onglet), eleves(onglet)]];
  const notes = (liste, i) => liste.map(o => +((o.f[x.c.id] || "")[i]) || 0).filter(v => v);
  const corps = x.c.etapes.map((e, i) => `<tr><th scope="row">${i + 1}. ${h(e.titre || NOMS[e.t])}</th><td>${NOMS[e.t]}</td>` + (groupes.length === 1
    ? (() => { const l = groupes[0][1], n = notes(l, i), k = n.length; return `<td><span class="barre"><i style="width:${Math.round(100 * k / l.length)}%"></i></span> ${k} / ${l.length}</td><td>${e.t === "lecon" || !k ? "" : (n.reduce((a, v) => a + v, 0) / k).toFixed(1).replace(".", ",") + " / 3"}</td>`; })()
    : groupes.map(g => caseChap(Math.round(100 * notes(g[1], i).length / g[1].length))).join("")) + "</tr>").join("");
  $("#detail").innerHTML = `<div class="defile"><table class="etapes${groupes.length > 1 ? " classe" : ""}"><thead><tr><th scope="col">Étape</th><th scope="col">Type</th>${groupes.length === 1 ? `<th scope="col">Réussie par</th><th scope="col">Étoiles moyennes</th>` : groupes.map(g => `<th scope="col">${h(g[0])}</th>`).join("")}</tr></thead><tbody>${corps}</tbody></table></div>
  <p class="muet">${groupes.length === 1 ? "Une étape réussie par peu d'élèves alors que la suivante l'est davantage signale un exercice que les élèves ont sauté. Des étoiles moyennes basses signalent un exercice réussi avec indices ou solution." : "Part des élèves de chaque classe qui ont réussi l'étape."}</p>`;
}
function csv() {
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const lignes = [["Classe", "Élève", "Date du code", "XP", "Niveau", "Série (jours)", "Étapes depuis le code précédent", ...CHAPS.flatMap(x => [`${x.nom} ${x.titre} (étapes sur ${x.c.etapes.length})`, `${x.nom} (étoiles)`])].map(q).join(";"),
    ...eleves(onglet).sort((a, b) => a.cl.localeCompare(b.cl) || a.nom.localeCompare(b.nom)).map(o => [q(nomClasse(o.cl)), q(o.nom), o.d, o.x, q(niveau(o.x).nom), +o.s || 0, o.delta === null ? "" : o.delta, ...CHAPS.flatMap(x => { const m = mesure(o, x.c); return [m.f, m.et]; })].join(";"))];
  telecharger(`${SITE}-${onglet === "*" ? "toutes-classes" : (onglet || "sans-classe").toLowerCase()}.csv`, "﻿" + lignes.join("\r\n"), "text/csv");
}
function telecharger(nom, contenu, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([contenu], { type })); a.download = nom; a.click(); }
const dire = t => { $("#etat").textContent = t; };

/* ---------- Actions ---------- */
function recevoir() {
  const texte = $("#codes").value; if (!texte.trim()) return;
  const r = ajouter(texte, $("#defaut").value);
  if (!r.lus) return dire(`Aucun code reconnu dans ce texte. Un code commence par ${PREFIXE}.`);
  const detail = Object.entries(r.par).map(([cl, n]) => `${nomClasse(cl)} : ${n}`).join(", ");
  dire(`${pluriel(r.lus, "code")} lu${r.lus > 1 ? "s" : ""} (${detail}). ${r.nouveau} ${r.nouveau > 1 ? "nouveaux élèves" : "nouvel élève"}, ${pluriel(r.maj, "mise")} à jour${r.connu ? `, ${r.connu} déjà connu${r.connu > 1 ? "s" : ""} ou plus ancien${r.connu > 1 ? "s" : ""}` : ""}${r.invalide ? `, ${pluriel(r.invalide, "invalide")} (incomplet ou modifié)` : ""}.`);
  $("#codes").value = "";
  const cls = Object.keys(r.par); if (cls.length === 1) onglet = cls[0]; else if (cls.length > 1) onglet = "*";
  dessiner();
}
function exemple() {
  const tous = CHAPS.map(x => x.c), total = tous.reduce((a, c) => a + c.etapes.length, 0);
  const fabrique = (p, k, cl, part, date) => {
    const faits = {}; let xp = 0, rang = 0;
    tous.forEach(c => c.etapes.forEach((e, i) => { if (rang++ < part * total && !(e.t === "code" && (k + rang) % 7 === 0)) { faits[c.id + "." + i] = { e: 3 - ((k + i) % 3 === 0 ? 1 : 0) - ((k * i) % 5 === 4 ? 1 : 0) }; xp += e.t === "code" ? 25 : 10; } }));
    return `${p} : ` + coderBilan({ pseudo: p, classe: cl, xp, serie: { n: k % 5 }, faits }, date);
  };
  const A = ["Adèle M.", "Bilal K.", "Chloé D.", "Driss A.", "Emma L.", "Farid B.", "Gabin R.", "Hana S.", "Inès T.", "Jules P.", "Kenza O.", "Léo V."], Bn = ["Maya C.", "Nolan F.", "Oriane G.", "Paul H.", "Qays J.", "Rose N.", "Sacha U.", "Thaïs W.", "Ugo Y.", "Zoé E."];
  const texte = [...A.map((p, k) => fabrique(p, k, "DEMO-A", .08 + (k * 7 % 11) / 60, "2026-11-03")), ...A.slice(0, 9).map((p, k) => fabrique(p, k, "DEMO-A", .14 + (k * 7 % 11) / 40, "2026-11-10")),
    ...Bn.map((p, k) => fabrique(p, k + 3, "DEMO-B", .05 + (k * 5 % 9) / 70, "2026-11-09"))].join("\n");
  ajouter(texte, SANS);
  classe("DEMO-A").attendus = [...A, "Mathis Z.", "Nour I."]; classe("DEMO-B").attendus = Bn;
  sauver(); onglet = "*"; dire("Deux classes fictives ajoutées : DEMO-A et DEMO-B. « Modifier la classe » permet de les supprimer."); dessiner();
}
function restaurer(fichier) {
  const l = new FileReader();
  l.onload = () => {
    try {
      const o = JSON.parse(l.result); if (!o || o.site !== SITE || !o.classes) throw 0;
      let n = 0;
      Object.entries(o.classes).forEach(([cl, K]) => {
        const c = classe(cl); c.attendus = [...new Set([...c.attendus, ...(K.attendus || [])])];
        Object.values(K.eleves || {}).forEach(e => { [e.a, e.c].forEach(code => { if (code && integrer(cl, code) !== "invalide") n++; }); });
      });
      menage(); sauver(); onglet = "*"; dire(`Sauvegarde fusionnée : ${pluriel(Object.keys(o.classes).length, "classe")}. Pour chaque élève, le code le plus récent est gardé.`); dessiner();
    } catch (e) { dire(`Ce fichier n'est pas une sauvegarde de l'espace professeur de ${SITE === "mue" ? "Mue" : "Synapse"}.`); }
  };
  l.readAsText(fichier);
}
function confirmer(b, texte, action) {
  if (b.dataset.sur) return action();
  b.dataset.sur = "1"; const avant = b.textContent; b.textContent = texte;
  setTimeout(() => { if (b.isConnected) { delete b.dataset.sur; b.textContent = avant; } }, 4000);
}

document.addEventListener("DOMContentLoaded", () => {
  const sombre = matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.dataset.theme = sombre ? "sombre" : "clair";
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  charger();
  $("#ajouter").onclick = recevoir;
  $("#codes").addEventListener("paste", () => setTimeout(recevoir, 0));
  $("#exemple").onclick = exemple;
  $("#exp").onclick = () => telecharger(`${SITE}-espace-professeur-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ site: SITE, v: 2, date: new Date().toISOString(), classes: B.classes }), "application/json");
  $("#imp").onchange = ev => { if (ev.target.files[0]) restaurer(ev.target.files[0]); ev.target.value = ""; };
  $("#vider").onclick = ev => confirmer(ev.target, "Confirmer : effacer toutes les classes", () => { B.classes = {}; onglet = "*"; sauver(); dire("Toutes les classes ont été effacées de ce navigateur."); dessiner(); });
  document.addEventListener("click", ev => {
    const t = ev.target, o = t.closest("[data-onglet]"), b = t.closest("[data-tri]");
    if (o) {
      if (o.dataset.onglet === "+") { const z = $("#nouvelle"); z.hidden = !z.hidden; if (!z.hidden) $("#nom-classe").focus(); return; }
      onglet = o.dataset.onglet; edition = false; chapChoisi = undefined; tri = { col: "nom", sens: 1 }; dessiner(); const s = $(`#onglets [aria-selected="true"]`); if (s) s.focus();
    } else if (b) { const c = b.dataset.tri; tri = { col: c, sens: tri.col === c ? -tri.sens : c === "nom" ? 1 : -1 }; dessiner(); $(`[data-tri="${c}"]`).focus(); }
    else if (t.id === "csv") csv();
    else if (t.id === "creer") { const n = normClasse($("#nom-classe").value); if (!n) return $("#nom-classe").focus(); classe(n); sauver(); onglet = n; edition = true; $("#nom-classe").value = ""; $("#nouvelle").hidden = true; dire(`Classe ${n} créée.`); dessiner(); }
    else if (t.id === "editer") { edition = !edition; dessiner(); $("#editer").focus(); }
    else if (t.id === "lien") {
      const url = new URL("index.html?classe=" + encodeURIComponent(onglet), location.href).href, p = $("#lien-txt");
      p.hidden = false; p.innerHTML = `Lien copié. Un élève qui ouvre ce lien voit sa classe (${h(onglet)}) préremplie dans son profil :<br><code>${h(url)}</code>`;
      if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    }
    else if (t.id === "ok-attendus") { B.classes[onglet].attendus = [...new Set($("#attendus").value.split("\n").map(s => s.trim()).filter(Boolean))]; sauver(); dire(`Liste enregistrée : ${pluriel(B.classes[onglet].attendus.length, "élève")} attendu${B.classes[onglet].attendus.length > 1 ? "s" : ""}.`); dessiner(); }
    else if (t.id === "renommer") {
      const n = normClasse($("#nouveau-nom").value); if (!n || n === onglet) return;
      if (B.classes[n]) return dire(`La classe ${n} existe déjà : déplacez plutôt les élèves un par un.`);
      B.classes[n] = B.classes[onglet]; delete B.classes[onglet]; onglet = n; sauver(); dire(`Classe renommée en ${n}. Les élèves doivent écrire ce nom dans leur profil.`); dessiner();
    }
    else if (t.id === "supprimer") confirmer(t, "Confirmer la suppression", () => { const n = nomClasse(onglet); delete B.classes[onglet]; onglet = "*"; edition = false; sauver(); dire(`Classe ${n} supprimée.`); dessiner(); });
    else if (t.dataset.retirer) { delete B.classes[onglet].eleves[t.dataset.retirer]; sauver(); dessiner(); }
  });
  document.addEventListener("change", ev => {
    const t = ev.target;
    if (t.id === "filtre") { filtre = t.value; dessiner(); $("#filtre").focus(); }
    else if (t.id === "chap") { chapChoisi = t.value; detail(); }
    else if (t.dataset.deplacer && t.value !== undefined && t.selectedIndex > 0) {
      const cle = t.dataset.deplacer, e = B.classes[onglet].eleves[cle], cible = classe(t.value);
      delete B.classes[onglet].eleves[cle]; [e.a, e.c].forEach(code => { if (code) integrer(t.value, code); });
      if (!cible.eleves[cle]) cible.eleves[cle] = e;
      sauver(); dire(`Élève déplacé vers ${nomClasse(t.value)}.`); dessiner();
    }
  });
  $("#nom-classe").addEventListener("keydown", ev => { if (ev.key === "Enter") $("#creer").click(); });
  dessiner();
});
