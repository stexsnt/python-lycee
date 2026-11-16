"use strict";
/* Confort d'usage, commun aux quatre sites (Mue, Synapse, Périple, Sésame).
   - état du chargement de Python : message plus clair, bouton pour réessayer ;
   - rappel de sauvegarde quand la progression a avancé sans être sauvegardée.
   Ce fichier se charge après app.js et n'utilise que ce qu'il expose : S, CLE, sauver,
   telecharger, toast, Moteur. */
(function () {
  const SEUIL = 8;               // étapes validées depuis la dernière sauvegarde avant de la rappeler
  const LENT = 12000, TRES_LENT = 45000;
  const nbFaits = () => Object.keys(S.faits || {}).length;

  /* ---------- Chargement de Python ---------- */
  let minuteurs = [];
  function etatPython(e) {
    const p = document.getElementById("etat-python");
    if (!p) return;
    minuteurs.forEach(clearTimeout); minuteurs = [];
    p.removeAttribute("title");
    if (e === "paquets") toast("Chargement de matplotlib… La première fois, cela prend quelques secondes.");
    if (e === "chargement") {
      minuteurs.push(setTimeout(() => {
        if (Moteur.etat() === "chargement") p.textContent = "Python se prépare… La première visite télécharge environ 13 Mo.";
      }, LENT));
      minuteurs.push(setTimeout(() => {
        if (Moteur.etat() === "chargement") p.textContent = "Python met du temps à arriver. Vérifie ta connexion ; les leçons et les questions restent utilisables.";
      }, TRES_LENT));
    } else if (e === "echec") {
      p.textContent = navigator.onLine === false
        ? "Python n'a pas pu se charger : tu es hors connexion. "
        : "Python n'a pas pu se charger. Vérifie ta connexion. ";
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn lien reessayer"; b.textContent = "Réessayer";
      b.onclick = () => Moteur.demarrer();
      p.appendChild(b);
    }
  }

  /* ---------- Rappel de sauvegarde ---------- */
  const reference = () => Math.max((S.sauv && S.sauv.n) || 0, S.sauvPlusTard || 0);
  function noterSauvegarde() { S.sauv = { n: nbFaits(), jour: new Date().toISOString().slice(0, 10) }; delete S.sauvPlusTard; sauver(); }
  function sauvegarder() {
    noterSauvegarde();
    telecharger(`${CLE.split(".")[0]}-${S.pseudo || "progression"}.json`, JSON.stringify(S), "application/json");
  }
  function rappel() {
    const app = document.getElementById("app");
    if (!app) return;
    const ancien = document.querySelector(".rappel-sauv"); if (ancien) ancien.remove();
    const bonMoment = app.querySelector(".bilan, .hero");      // accueil ou fin de chapitre, jamais au milieu d'un exercice
    const depuis = nbFaits() - reference();
    if (!bonMoment || depuis < SEUIL) return;
    const jamais = !(S.sauv && S.sauv.n);
    const div = document.createElement("aside");
    div.className = "rappel-sauv"; div.setAttribute("aria-label", "Rappel de sauvegarde");
    div.innerHTML = `<p><strong>${jamais ? "Tu n'as pas encore sauvegardé ta progression." : `${depuis} étapes validées depuis ta dernière sauvegarde.`}</strong>
      Elle n'existe que dans ce navigateur : sur un ordinateur partagé, elle peut disparaître.</p>
      <div class="actions"><button type="button" class="btn petit" data-r="oui">Sauvegarder maintenant</button><button type="button" class="btn petit lien" data-r="non">Plus tard</button></div>`;
    div.querySelector('[data-r="oui"]').onclick = () => { sauvegarder(); div.remove(); toast("Sauvegarde téléchargée : range le fichier dans ton ENT ou sur ta clé"); };
    div.querySelector('[data-r="non"]').onclick = () => { S.sauvPlusTard = nbFaits(); sauver(); div.remove(); };
    document.body.appendChild(div);
  }

  // Le bouton « Sauvegarder ma progression » du profil : on note la sauvegarde avant que le fichier soit produit.
  document.addEventListener("click", ev => { if (ev.target && ev.target.id === "exp") noterSauvegarde(); }, true);

  document.addEventListener("DOMContentLoaded", () => {
    Moteur.surEtat(etatPython); etatPython(Moteur.etat());
    rappel();
  });
  window.addEventListener("hashchange", () => setTimeout(rappel, 0));
})();

/* ---------- Profil : envoyer son code au professeur par le menu de partage ---------- */
(function () {
  if (!navigator.share) return;                       // ordinateurs sans partage : le bouton « Code pour mon professeur » copie déjà le code
  function bouton() {
    const origine = document.getElementById("codeprof");
    if (!origine || document.getElementById("partager-code")) return;
    const b = document.createElement("button");
    b.type = "button"; b.id = "partager-code"; b.className = "btn secondaire"; b.textContent = "Envoyer mon code";
    b.onclick = async () => {
      if (!S.pseudo) { toast("Indique d'abord ton prénom dans le champ ci-dessus.", "erreur"); const p = document.getElementById("pseudo"); if (p) p.focus(); return; }
      try { await navigator.share({ text: `${S.pseudo} : ${coderBilan(S, aujourdhui())}` }); } catch (e) { /* partage annulé */ }
    };
    origine.after(b);
  }
  document.addEventListener("DOMContentLoaded", () => {
    const app = document.getElementById("app");
    if (app) new MutationObserver(bouton).observe(app, { childList: true });
    bouton();
  });
})();

/* ---------- Accueil : lien vers le livret de l'élève (documents/livret-eleve.pdf) ---------- */
(function () {
  function lienLivret() {
    const hote = document.querySelector("#app .hero-texte");
    if (!hote || hote.querySelector(".livret-lien")) return;
    const p = document.createElement("p");
    p.className = "livret-lien";
    p.innerHTML = `<a href="documents/livret-eleve.pdf" target="_blank" rel="noopener">Le livret de l'élève (PDF à imprimer)</a> : mode d'emploi, carnet de route et activités sur papier.`;
    hote.appendChild(p);
  }
  document.addEventListener("DOMContentLoaded", lienLivret);
  window.addEventListener("hashchange", () => setTimeout(lienLivret, 0));
})();

/* ---------- Accessibilité : un bloc de code qui défile doit pouvoir recevoir le clavier ---------- */
(function () {
  function rendreDefilables() {
    document.querySelectorAll("#app pre:not([tabindex])").forEach(p => {
      if (p.closest("[aria-hidden]")) return;                // calque de coloration de l'éditeur
      if (p.scrollWidth > p.clientWidth + 1) { p.tabIndex = 0; p.setAttribute("role", "region"); p.setAttribute("aria-label", "Programme, défilement horizontal"); }
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    const app = document.getElementById("app");
    if (app) new MutationObserver(() => setTimeout(rendreDefilables, 0)).observe(app, { childList: true });
    rendreDefilables();
  });
  window.addEventListener("resize", rendreDefilables);
})();
