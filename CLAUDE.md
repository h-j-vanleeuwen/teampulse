# TeamPulse

Outil d'évaluation santé d'équipe basé sur la méthodologie Lencioni (5 dysfonctionnements).

## Stack

- **Frontend** : HTML + CSS + ES Modules natifs (pas de build system, pas de bundler)
- **Backend** : Supabase (PostgreSQL + REST auto-généré + Auth)
- **Hosting** : Vercel (JAMstack, rewrites vers index.html)

## Structure

```
index.html          # Shell HTML, <script type="module" src="js/app.js">
css/style.css       # Tous les styles
js/
  config.js         # Constantes : SB, KEY, Qs (37 questions), CAT, COL
  state.js          # État partagé mutable (teams, rounds, survey...)
  api.js            # Appels REST Supabase (tables publiques)
  auth.js           # Authentification Supabase Auth (email/mdp, session)
  pin.js            # Stub vide - remplacé par auth.js
  admin.js          # Gestion équipes / rounds / questions
  survey.js         # Formulaire de réponse (accès via lien ?round=xxx)
  results.js        # Dashboard résultats + comparaison rounds + commentaires
  pyramid.js        # Données pyramide Lencioni (labels, couleurs, priorité)
  app.js            # Point d'entrée : boot(), showPage(), showPageGuarded()
vercel.json         # Rewrites SPA
```

## Commandes

```bash
# Serveur local (port 3333 car 8080 est occupé par Keycloak)
python3 -m http.server 3333

# Ou avec npx
npx serve -p 3333
```

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
  `{42: {score: 3, comment: "..."}}` - `calcScores()` gère les deux
- **Pyramide** : `PYRAMID_APEX_BOTTOM = 0.38` dans `results.js` contrôle la largeur
  de la base de l'apex - ne pas descendre sous 0.34 (contenu coupé)

## Supabase

- URL : `https://ocqvjzsogumonagjltli.supabase.co`
- Tables : `teams`, `rounds`, `responses`, `settings`
- La clé API est publique (anon key) - pas de secret
- Auth : compte admin créé dans Supabase Dashboard > Authentication > Users
- Redirect URLs configurées : `http://localhost:3333`, `https://teampulse-eta.vercel.app`

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
