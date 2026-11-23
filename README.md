# Noël en famille 🎄

Première base du site familial : page d’accueil, compte à rebours, formulaire de connexion Supabase et demande de réinitialisation du mot de passe.

## Avant de commencer

- Node.js (version LTS) installé sur l'ordinateur.
- Le dépôt GitHub `noel-en-famille`.
- Le projet Supabase déjà créé.

## 1. Ajouter les fichiers au dépôt GitHub

1. Ouvre ton dépôt GitHub `noel-en-famille`.
2. Clique sur **Add file** puis **Upload files**.
3. Décompresse l’archive ZIP téléchargée.
4. Glisse le contenu du dossier `noel-en-famille` dans la page GitHub (pas le dossier ZIP lui-même).
5. Clique sur **Commit changes**.

## 2. Lancer le site sur ton ordinateur

1. Installe Node.js LTS depuis https://nodejs.org/ si ce n'est pas déjà fait.
2. Ouvre un terminal dans le dossier du projet.
3. Lance `npm install`.
4. Copie `.env.example` vers un nouveau fichier nommé `.env`.
5. Dans `.env`, remplace les deux valeurs par le **Project URL** et la **Publishable key** de ton projet Supabase.
6. Lance `npm run dev` et ouvre l'adresse locale affichée (souvent http://localhost:5173).

Ne mets jamais de clé `service_role` ou de secret dans le fichier `.env` du navigateur, dans GitHub ou dans le code du site. Seule la clé publishable/anon est prévue pour le navigateur.

## 3. Ce que cette première version fait

- Page d'accueil « Noël en famille » avec ambiance de Noël.
- Compte à rebours jusqu'au 24 décembre 2026 à 20 h (heure de Paris).
- Connexion avec adresse e-mail et mot de passe via Supabase.
- Demande de réinitialisation du mot de passe.

## 4. Ce qui reste à construire

Cette base n'est pas encore le site complet. Les prochaines étapes sont :
- connexion avec pseudo **ou** e-mail ;
- affichage des profils et des listes ;
- ajout/modification/suppression des cadeaux et photos ;
- favoris limités à trois ;
- réservations individuelles et en groupe, avec confidentialité du destinataire ;
- notifications et archivage par année ;
- espace administrateur pour créer les quatre comptes.

Avant d'ouvrir le site à la famille, il faudra terminer et tester les règles de sécurité Supabase, surtout les réservations : le destinataire ne doit jamais pouvoir lire leur statut ni l'identité des participants.

## Dépannage

- Si le formulaire est désactivé, vérifie que le fichier `.env` existe et contient les deux bonnes valeurs.
- Après une modification de `.env`, arrête puis relance `npm run dev`.
- Si la connexion échoue, vérifie que l'utilisateur existe dans **Authentication → Users** et que son adresse e-mail est confirmée.
