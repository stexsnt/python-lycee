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

## Ajouter ou modifier des exercices

Tout le contenu est dans `js/contenu.js` ; le format de chaque type d'étape est décrit
en tête de fichier. Ajoutez les nouvelles étapes à la fin d'un chapitre : la progression
des élèves est enregistrée par position.

Avant de publier, vérifiez que chaque solution passe bien ses tests :

    cd tests && npm install pyodide && node verifier.js

## Dépendances externes

- Pyodide (moteur Python), chargé depuis cdn.jsdelivr.net. Si le réseau du lycée bloque
  ce domaine, copiez la distribution Pyodide dans le dépôt et ajoutez dans `index.html`,
  avant les autres scripts : `<script>window.MUE_PYODIDE = "pyodide/";</script>`
- Polices chargées depuis fonts.bunny.net (service européen sans traceur). Sans elles,
  le site utilise les polices du système.
