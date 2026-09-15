# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# TeamPulse

Outil d'évaluation santé d'équipe basé sur la méthodologie Lencioni (5 dysfonctionnements).

## Stack

- **Frontend** : HTML + CSS + ES Modules natifs (pas de build system, pas de bundler)
- **Backend** : Supabase (PostgreSQL + REST auto-généré + Auth)
- **Hosting** : Vercel (JAMstack, rewrites vers index.html)

## Commandes

```bash
# Serveur local (port 3333 car 8080 est occupé par Keycloak)
python3 -m http.server 3333

# Ou avec npx
npx serve -p 3333
```

Pas de build, pas de tests, pas de linter. On ouvre directement dans le navigateur.

## Structure des fichiers

```
index.html          # Shell HTML, <script type="module" src="js/app.js">
css/style.css       # Tous les styles (inclut classes print/no-print)
js/
  config.js         # Constantes : SB, KEY, Qs (37 questions), CAT, COL
  state.js          # État partagé mutable (teams, rounds, survey, résultats)
  api.js            # Appels REST Supabase (tables publiques, anon key)
  auth.js           # Authentification Supabase Auth (email/mdp, session)
  pin.js            # Stub vide - remplacé par auth.js
  admin.js          # Gestion équipes / rounds / questions
  survey.js         # Formulaire de réponse (accès via lien ?round=xxx)
  results.js        # Dashboard résultats + comparaison rounds + commentaires
  pyramid.js        # Données pyramide Lencioni (labels, couleurs, priorité) — fonction pure
  confetti.js       # Animation confetti au chargement
  app.js            # Point d'entrée : boot(), showPage(), showPageGuarded()
vercel.json         # Rewrites SPA
supabase/
  migrations/       # SQL à appliquer manuellement (Dashboard > SQL Editor ou `supabase db push`)
  functions/
    send-result-email/  # Edge Function : envoie le résultat individuel par email (Resend) — voir son README.md pour le déploiement
```

## Flux de démarrage (boot)

`boot()` dans `app.js` :
1. Restaure la session Supabase depuis localStorage (`initAuth`)
2. Charge équipes + rounds (`loadAll`)
3. Si `?round=xxx` dans l'URL → charge le round et affiche le survey
4. Sinon → tente d'afficher Results (avec guard d'auth)

## Authentification

- **Mécanisme** : Supabase Auth, email + mot de passe (`signInWithPassword`)
- **SDK** : chargé dynamiquement depuis CDN (`cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm`)
- **Session** : stockée en localStorage par le SDK, restaurée au boot via `initAuth()`
- **Protection** : `showPageGuarded(p)` vérifie la session avant d'afficher Admin ou Results
- **Survey** : accessible sans auth via `?round=xxx` dans l'URL

## Patterns importants

- **Fonctions appelées depuis innerHTML** : doivent être exposées sur `window`
  (ex: `window.addTeam = function() {...}`)
- **Navigation inter-modules sans import circulaire** : utiliser `window.showPage()`
  plutôt qu'importer depuis `app.js`
- **Deux formats de réponses en base** : ancien `{42: 3}` (nombre) et nouveau
  `{42: {score: 3, comment: "..."}}` — `calcScores()` gère les deux
- **Pyramide** : `PYRAMID_APEX_BOTTOM = 0.38` dans `results.js` contrôle la largeur
  de la base de l'apex — ne pas descendre sous 0.34 (contenu coupé)
- **Export PDF** : `window.exportPDF` appelle simplement `window.print()` ; le CSS gère
  la mise en page via la classe `no-print` et `@media print`

## Machine à états du survey

`state.sv.step` contrôle l'écran affiché dans `renderSurvey()` :
- `-1` → formulaire de saisie du prénom/nom
- `0..N-1` → question N du round (N = nombre de questions actives)
- `>= activeQs.length` → écran de remerciement (done)

## Calcul des scores

Scores sur une échelle 1–5 (1 = Never, 5 = Always). Seuils dans `pyramid.js` :
- **Sain** : score ≥ 3.5
- **Fragile** : 2.5 ≤ score < 3.5
- **Critique** : score < 2.5

`calcScores()` dans `pyramid.js` retourne la moyenne par catégorie Lencioni (fonction pure, réutilisée par `results.js` et `survey.js`).
`buildPyramidData()` dans `pyramid.js` est une fonction pure (scores → niveaux + levier prioritaire).

## Supabase

- URL : `https://ocqvjzsogumonagjltli.supabase.co`
- Tables : `teams`, `rounds`, `responses`, `settings`
- La clé API est publique (anon key) — pas de secret
- Auth : compte admin créé dans Supabase Dashboard > Authentication > Users
- Redirect URLs configurées : `http://localhost:3333`, `https://teampulse-eta.vercel.app`
- `responses` : colonnes `round_id`, `first_name`, `last_name`, `answers` (JSON), `email` (optionnel, rempli si le round demande l'envoi du résultat individuel)
- `rounds` : colonne `send_individual_result` (bool) — active le champ email + l'envoi auto sur le survey
- `rounds` : colonne `email_categories` (texte, JSON — même pattern que `questions`) — quelles catégories Lencioni sont révélées dans l'email (indépendant des questions posées), toutes par défaut
- Edge Function `send-result-email` (Deno, dossier `supabase/functions/`) : envoie le résultat individuel via Resend, appelée depuis `api.js` après soumission du survey — nécessite le secret `RESEND_API_KEY` (voir `supabase/functions/send-result-email/README.md`)

## Features implémentées

- [x] Survey Lencioni 37 questions avec commentaires par question
- [x] Gestion équipes / rounds / sélection de questions
- [x] Dashboard résultats avec comparaison entre rounds
- [x] Affichage commentaires participants dans la vue résultats
- [x] Authentification email/mdp via Supabase Auth
- [x] Lien de partage par round
- [x] Vue longitudinale par participant
- [x] Pyramide de Lencioni interactive (modale résultats)

## Features à venir

- [ ] Export PDF données brutes
- [ ] Export PDF avec analyse IA
- [ ] Envoi du résultat individuel par email : code front + Edge Function écrits,
      déploiement infra (migration SQL, compte Resend, `supabase functions deploy`)
      à faire manuellement — voir `supabase/functions/send-result-email/README.md`
