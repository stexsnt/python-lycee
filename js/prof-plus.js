"use strict";
/* Compléments de l'espace professeur, communs aux quatre sites. Se charge après prof.js.
   - QR code du lien de classe, à projeter : l'élève qui le scanne voit sa classe préremplie ;
   - impression du tableau de classe. */
(function () {
  const zone = document.getElementById("resultats");
  if (!zone) return;

  function svgQR(texte) {
    const q = qrcode(0, "M"); q.addData(texte); q.make();
    const n = q.getModuleCount(), marge = 4, t = n + 2 * marge;
    let d = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + marge} ${y + marge}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges" role="img" aria-label="QR code du lien de la classe"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  function projeter(url, classe) {
    const d = document.createElement("dialog");
    d.className = "projection";
    d.innerHTML = `<h2>Classe ${classe}</h2><div class="qr">${svgQR(url)}</div>
      <p>Scanne ce code : ta classe sera déjà inscrite dans ton profil.</p>
      <p class="adresse"></p><form method="dialog"><button class="btn">Fermer</button></form>`;
    d.querySelector(".adresse").textContent = url.replace(/^https?:\/\//, "");
    d.querySelector("h2").textContent = "Classe " + classe;
    d.addEventListener("close", () => d.remove());
    document.body.appendChild(d); d.showModal();
  }

  // Après un clic sur « Lien à donner aux élèves », prof.js affiche le lien : on y ajoute le QR code.
  document.addEventListener("click", ev => {
    if (!ev.target || ev.target.id !== "lien") return;
    setTimeout(ajouterQR, 0);                          // laisse prof.js écrire le lien d'abord
  });
  function ajouterQR() {
    const p = document.getElementById("lien-txt"), code = p && p.querySelector("code");
    if (!code || typeof qrcode !== "function" || p.querySelector(".qr-lien")) return;
    const url = code.textContent, classe = new URL(url).searchParams.get("classe") || "";
    const bloc = document.createElement("span");
    bloc.className = "qr-lien";
    bloc.innerHTML = `<span class="qr">${svgQR(url)}</span><span>Ou faites scanner ce QR code.<br><button type="button" class="btn secondaire petit">Afficher en grand pour le projeter</button></span>`;
    bloc.querySelector("button").onclick = () => projeter(url, classe);
    p.appendChild(bloc);
  }

  // Bouton d'impression, à côté de l'export CSV, remis à chaque fois que le tableau est redessiné.
  function boutonImprimer() {
    const csv = document.getElementById("csv");
    if (!csv || document.getElementById("imprimer")) return;
    const b = document.createElement("button");
    b.type = "button"; b.id = "imprimer"; b.className = "btn secondaire"; b.textContent = "Imprimer le tableau";
    b.onclick = () => window.print();
    csv.after(b);
  }
  new MutationObserver(boutonImprimer).observe(zone, { childList: true });
  boutonImprimer();
})();
