/* Niveaux et « code pour le professeur » : partagé par le site élève et le tableau de classe. */
const NIVEAUX = [[0, "Œuf"], [80, "Orvet"], [220, "Couleuvre"], [450, "Vipère"], [750, "Cobra"], [1100, "Boa"], [1550, "Anaconda"], [2000, "Python royal"]];
function niveau(xp) {
  let i = 0; while (i + 1 < NIVEAUX.length && NIVEAUX[i + 1][0] <= xp) i++;
  return { i, nom: NIVEAUX[i][1], min: NIVEAUX[i][0], max: i + 1 < NIVEAUX.length ? NIVEAUX[i + 1][0] : null };
}

const SEL_BILAN = "mue-2026-ecailles";
const RE_BILAN = /MUE1\.[A-Za-z0-9_-]+\.[a-z0-9]+/g;
function hacher(s) {
  let h = 0x811c9dc5;
  for (const c of unescape(encodeURIComponent(s))) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
const versB64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const depuisB64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

/* Nom de classe : majuscules, sans espace, 12 caractères au plus (« 2de 4 » devient « 2DE4 »). */
const normClasse = s => String(s || "").toUpperCase().replace(/[^A-Z0-9À-Ý-]/g, "").slice(0, 12);

/* Un caractère par étape et par chapitre : 0 = pas faite, 1 à 3 = nombre d'étoiles. */
function coderBilan(etat, date) {
  const f = {};
  [...PARCOURS.flatMap(p => p.chapitres), DEFIS].forEach(c => {
    const s = c.etapes.map((e, i) => { const r = etat.faits[c.id + "." + i]; return r ? String(Math.min(3, Math.max(1, r.e || 1))) : "0"; }).join("");
    if (/[1-3]/.test(s)) f[c.id] = s;
  });
  const corps = versB64(JSON.stringify({ p: etat.pseudo, c: normClasse(etat.classe) || undefined, d: date, x: etat.xp, s: etat.serie.n, f }));
  return `MUE1.${corps}.${hacher(corps + SEL_BILAN)}`;
}
function decoderBilan(code) {
  const m = String(code).match(/^MUE1\.([A-Za-z0-9_-]+)\.([a-z0-9]+)$/);
  if (!m || hacher(m[1] + SEL_BILAN) !== m[2]) return null;
  try { const o = JSON.parse(depuisB64(m[1])); return o && typeof o.f === "object" && typeof o.x === "number" ? o : null; } catch (e) { return null; }
}
