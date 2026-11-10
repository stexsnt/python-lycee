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
en tête de fichier. Ajoutez les nouvelles étapes à la fin d'un chapitre : la progression
des élèves est enregistrée par position.

Avant de publier, vérifiez que chaque solution passe bien ses tests :

    cd tests && npm install pyodide && node verifier.js

## Dépendances externes

- Aucune pour fonctionner : Pyodide (moteur Python, version 314.0.7) est dans le dossier
  `pyodide/` du dépôt. Le CDN jsdelivr ne sert que de secours si ce dossier est absent.
- Le fichier `sw.js` met le site en cache : après une première visite complète, il
  fonctionne hors connexion. Les mises à jour du contenu arrivent dès qu'il y a du réseau.
- Polices chargées depuis fonts.bunny.net (service européen sans traceur). Sans elles,
  le site utilise les polices du système.
