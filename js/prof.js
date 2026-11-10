"use strict";
/* Tableau de classe : tout est calculé dans le navigateur à partir des codes collés. Rien n'est envoyé. */
const CLE_PROF = "mue.prof.v1";
const $ = (s, r = document) => r.querySelector(s);
const h = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CHAPS = [...PARCOURS.flatMap(p => p.chapitres.map((c, k) => ({ c, parc: p.id, nom: `${p.titre} ${k + 1}`, titre: c.titre }))), { c: DEFIS, parc: "defis", nom: "Défis", titre: "Défis" }];
const NOMS = { lecon: "Leçon", qcm: "Question", predire: "Prédiction", ordre: "Remise en ordre", code: "Exercice de code" };
let eleves = [], tri = { col: "nom", sens: 1 }, filtre = "tous";

function analyser(texte) {
  const codes = texte.match(RE_BILAN) || [], parNom = new Map(); let invalides = 0, doublons = 0;
  codes.forEach(code => {
    const o = decoderBilan(code); if (!o) { invalides++; return; }
    o.nom = String(o.p || "").trim() || "(sans prénom)";
    const cle = o.nom.toLowerCase(), a = parNom.get(cle);
    if (a) doublons++;
    if (!a || o.d > a.d || (o.d === a.d && o.x >= a.x)) parNom.set(cle, o);
  });
  return { liste: [...parNom.values()], invalides, doublons, lus: codes.length };
}
function mesure(o, c) {
  const s = (o.f[c.id] || "").padEnd(c.etapes.length, "0");
  let f = 0, et = 0, max = 0;
  c.etapes.forEach((e, i) => { const v = +s[i] || 0; if (v) f++; if (e.t !== "lecon") { max += 3; et += v; } });
  return { f, n: c.etapes.length, et, max };
}
const visibles = () => CHAPS.filter(x => filtre === "tous" || x.parc === filtre);

function dessiner() {
  const z = $("#resultats");
  if (!eleves.length) { z.innerHTML = ""; return; }
  const cols = visibles();
  const val = (o, col) => col === "nom" ? o.nom.toLowerCase() : col === "xp" ? o.x : col === "date" ? o.d : mesure(o, CHAPS[+col].c).f;
  const lignes = [...eleves].sort((a, b) => { const x = val(a, tri.col), y = val(b, tri.col); return (x < y ? -1 : x > y ? 1 : 0) * tri.sens || a.nom.localeCompare(b.nom); });
  const entete = (col, txt, extra = "") => `<th scope="col" ${tri.col === String(col) ? `aria-sort="${tri.sens > 0 ? "ascending" : "descending"}"` : ""}><button data-tri="${col}">${txt}${tri.col === String(col) ? (tri.sens > 0 ? " ▲" : " ▼") : ""}</button>${extra}</th>`;
  const moy = cols.map(x => Math.round(100 * eleves.reduce((a, o) => a + mesure(o, x.c).f / x.c.etapes.length, 0) / eleves.length));
  z.innerHTML = `
  <h2>${eleves.length} élève${eleves.length > 1 ? "s" : ""}</h2>
  <div class="actions">
    <label for="filtre" class="en-ligne">Afficher</label>
    <select id="filtre">${[["tous", "Tous les chapitres"], ...PARCOURS.map(p => [p.id, p.titre]), ["defis", "Défis"]].map(([v, t]) => `<option value="${v}" ${v === filtre ? "selected" : ""}>${t}</option>`).join("")}</select>
    <button class="btn secondaire" id="csv">Exporter pour le tableur (CSV)</button>
  </div>
  <div class="defile" tabindex="0" role="region" aria-label="Tableau de la classe">
  <table class="classe">
    <thead><tr>${entete("nom", "Élève")}${entete("xp", "XP")}${entete("date", "Code du")}${cols.map(x => entete(CHAPS.indexOf(x), h(x.nom), x.parc === "defis" ? "" : `<span class="sous">${h(x.titre)}</span>`)).join("")}</tr></thead>
    <tbody>${lignes.map(o => `<tr><th scope="row">${h(o.nom)}</th><td>${o.x}<span class="sous">${h(niveau(o.x).nom)}</span></td><td>${h(String(o.d).slice(8, 10) + "/" + String(o.d).slice(5, 7))}<span class="sous">série ${+o.s || 0} j</span></td>${cols.map(x => { const m = mesure(o, x.c); return `<td class="${m.f === m.n ? "plein" : m.f ? "partiel" : "vide"}">${m.f}/${m.n}<span class="sous">${m.f ? `★ ${m.et}/${m.max}` : "&nbsp;"}</span></td>`; }).join("")}</tr>`).join("")}</tbody>
    <tfoot><tr><th scope="row">Moyenne de la classe</th><td>${Math.round(eleves.reduce((a, o) => a + o.x, 0) / eleves.length)}</td><td></td>${moy.map(m => `<td>${m} %</td>`).join("")}</tr></tfoot>
  </table></div>
  <p class="muet">Chaque case indique les étapes validées sur le total du chapitre, puis les étoiles obtenues. Cliquez sur un en-tête pour trier.</p>
  <h2>Où la classe cale</h2>
  <div class="actions"><label for="chap" class="en-ligne">Chapitre</label><select id="chap">${CHAPS.map((x, k) => `<option value="${k}">${h(x.nom)}${x.parc === "defis" ? "" : " : " + h(x.titre)}</option>`).join("")}</select></div>
  <div id="detail"></div>`;
  const plusAvance = CHAPS.map((x, k) => [k, eleves.filter(o => mesure(o, x.c).f).length]).filter(a => a[1]).pop();
  $("#chap").value = window.chapChoisi !== undefined ? window.chapChoisi : plusAvance ? plusAvance[0] : 0;
  detail();
}
function detail() {
  const x = CHAPS[+$("#chap").value], N = eleves.length;
  $("#detail").innerHTML = `<table class="etapes"><thead><tr><th scope="col">Étape</th><th scope="col">Type</th><th scope="col">Réussie par</th><th scope="col">Étoiles moyennes</th></tr></thead><tbody>${x.c.etapes.map((e, i) => {
    const notes = eleves.map(o => +((o.f[x.c.id] || "")[i]) || 0).filter(v => v), k = notes.length, pc = Math.round(100 * k / N);
    return `<tr><th scope="row">${i + 1}. ${h(e.titre || NOMS[e.t])}</th><td>${NOMS[e.t]}</td><td><span class="barre"><i style="width:${pc}%"></i></span> ${k} / ${N}</td><td>${e.t === "lecon" || !k ? "" : (notes.reduce((a, v) => a + v, 0) / k).toFixed(1).replace(".", ",") + " / 3"}</td></tr>`; }).join("")}</tbody></table>
  <p class="muet">Une étape réussie par peu d'élèves alors que la suivante l'est davantage signale un exercice que les élèves ont sauté. Des étoiles moyennes basses signalent un exercice réussi avec indices ou solution.</p>`;
}
function csv() {
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const lignes = [["Élève", "Date du code", "XP", "Niveau", "Série (jours)", ...CHAPS.flatMap(x => [`${x.nom} ${x.parc === "defis" ? "" : x.titre} (étapes sur ${x.c.etapes.length})`, `${x.nom} (étoiles)`])].map(q).join(";"),
    ...[...eleves].sort((a, b) => a.nom.localeCompare(b.nom)).map(o => [q(o.nom), o.d, o.x, q(niveau(o.x).nom), +o.s || 0, ...CHAPS.flatMap(x => { const m = mesure(o, x.c); return [m.f, m.et]; })].join(";"))];
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + lignes.join("\r\n")], { type: "text/csv" })); a.download = "mue-classe.csv"; a.click();
}
function lire() {
  const texte = $("#codes").value; try { localStorage.setItem(CLE_PROF, texte); } catch (e) { /* stockage indisponible */ }
  const r = analyser(texte); eleves = r.liste;
  $("#etat").textContent = !texte.trim() ? "" : !r.lus ? "Aucun code reconnu dans ce texte. Un code commence par MUE1." :
    `${r.lus} code${r.lus > 1 ? "s" : ""} lu${r.lus > 1 ? "s" : ""}` + (r.invalides ? `, dont ${r.invalides} invalide${r.invalides > 1 ? "s" : ""} (incomplet ou modifié)` : "") + (r.doublons ? `. ${r.doublons} doublon${r.doublons > 1 ? "s" : ""} de prénom : seul le code le plus récent est gardé` : "") + ".";
  dessiner();
}
function exemple() {
  const prenoms = ["Adèle", "Bilal", "Chloé", "Driss", "Emma", "Farid", "Gabin", "Hana", "Inès", "Jules", "Kenza", "Léo"];
  const tous = [...PARCOURS.flatMap(p => p.chapitres), DEFIS];
  $("#codes").value = prenoms.map((p, k) => {
    const faits = {}; let xp = 0; const avance = 1.5 + (k * 7 % 11) / 2.2;
    tous.forEach((c, ci) => c.etapes.forEach((e, i) => { if (c.id !== "defis" && ci + i / c.etapes.length < avance && !(e.t === "code" && (k + ci + i) % 7 === 0)) { faits[c.id + "." + i] = { e: 3 - ((k + i) % 3 === 0 ? 1 : 0) - ((k * i) % 5 === 4 ? 1 : 0) }; xp += e.t === "code" ? 20 : 10; } }));
    return `${p} : ` + coderBilan({ pseudo: p, xp, serie: { n: k % 5 }, faits }, "2026-11-" + String(3 + k % 7).padStart(2, "0"));
  }).join("\n");
  lire();
}
document.addEventListener("DOMContentLoaded", () => {
  const sombre = matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.dataset.theme = sombre ? "sombre" : "clair";
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  try { $("#codes").value = localStorage.getItem(CLE_PROF) || ""; } catch (e) { /* rien */ }
  $("#codes").addEventListener("input", lire);
  $("#exemple").onclick = exemple;
  $("#vider").onclick = () => { $("#codes").value = ""; lire(); $("#codes").focus(); };
  $("#resultats").addEventListener("click", ev => {
    const b = ev.target.closest("[data-tri]");
    if (b) { const c = b.dataset.tri; tri = { col: c, sens: tri.col === c ? -tri.sens : c === "nom" ? 1 : -1 }; dessiner(); $(`[data-tri="${c}"]`).focus(); }
    else if (ev.target.id === "csv") csv();
  });
  $("#resultats").addEventListener("change", ev => {
    if (ev.target.id === "filtre") { filtre = ev.target.value; dessiner(); $("#filtre").focus(); }
    else if (ev.target.id === "chap") { window.chapChoisi = ev.target.value; detail(); }
  });
  lire();
});
