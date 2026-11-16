# Mue — apprendre Python au lycée

Site statique : leçons courtes, exercices corrigés automatiquement (Python réel exécuté
dans le navigateur grâce à Pyodide), progression, étoiles, niveaux, badges et défis.
Aucun serveur, aucun compte, aucune donnée transmise : la progression de l'élève reste
dans son navigateur (avec sauvegarde / restauration par fichier depuis la page Profil).

## Mise en ligne sur GitHub Pages

1. Créez un dépôt public sur GitHub (par exemple `python-lycee`).
2. Déposez-y tout le contenu de ce dossier (`index.html`, `css/`, `js/`) : bouton
   « Add file » puis « Upload files ».
3. Dans « Settings » puis « Pages », choisissez la source « Deploy from a branch »,
   branche `main`, dossier `/ (root)`, puis enregistrez.
4. Après une minute, le site est en ligne à l'adresse `https://VOTRE-COMPTE.github.io/python-lycee/`.

## Suivi de classe

Dans sa page Profil, l'élève génère un « code pour mon professeur » et vous l'envoie. La page
`prof.html` (lien « Espace professeur » en bas du site) transforme les codes collés en tableau de
classe, avec export CSV. Tout est calculé dans le navigateur, rien n'est stocké en ligne.

## Ajouter ou modifier des exercices

Tout le contenu est dans `js/contenu.js` ; le format de chaque type d'étape est décrit
en tête de fichier. Une nouvelle étape s'ajoute à la fin, ou au milieu avec `numero: n` (règle décrite en tête de `js/contenu.js`).

Avant de publier, vérifiez que chaque solution passe bien ses tests :

    cd tests && npm install pyodide && node verifier.js

## Dépendances externes

- Aucune pour fonctionner : Pyodide (moteur Python, version 314.0.7) est dans le dossier
  `pyodide/` du dépôt. Le CDN jsdelivr ne sert que de secours si ce dossier est absent.
- Le fichier `sw.js` met le site en cache : après une première visite complète, il
  fonctionne hors connexion. Les mises à jour du contenu arrivent dès qu'il y a du réseau.

## Confort d'usage

- `js/confort.js` (identique sur Mue, Synapse, Périple et Sésame) : message plus clair pendant le chargement de Python,
  bouton « Réessayer » en cas d'échec, et rappel de sauvegarde quand huit étapes ont été validées depuis la dernière sauvegarde.
- `manifest.webmanifest` et `icones/` : le site peut être installé sur l'écran d'accueil d'un téléphone ou d'une tablette.
- Toutes les polices sont dans `polices/` : le site n'appelle aucun service externe.
- Le pied de page renvoie vers le portail https://stexsnt.github.io/ et les trois autres sites.
- `js/prof-plus.js` et `js/qrcode.min.js` (espace professeur) : QR code du lien de classe, à projeter, et impression du tableau de classe.
- Sur téléphone, le profil propose « Envoyer mon code » par le menu de partage.
- Python (Pyodide) est chargé en priorité depuis `https://stexsnt.github.io/pyodide/`, copie partagée par les quatre sites et rangée dans un cache commun : un élève ne le télécharge qu'une fois. Le dossier `pyodide/` du dépôt reste la copie de secours.
- Chaque étape a un numéro stable (voir `numeros` dans `js/bilan.js`) : on peut insérer une étape au milieu d'un chapitre sans décaler la progression des élèves ni les codes déjà reçus par le professeur.
