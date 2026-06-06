# TeamPulse

Outil d'évaluation santé d'équipe basé sur la méthodologie Lencioni (5 dysfonctionnements).

## Stack

- **Frontend** : HTML + CSS + ES Modules natifs (pas de build system, pas de bundler)
- **Backend** : Supabase (PostgreSQL + REST auto-généré)
- **Hosting** : Vercel (JAMstack, rewrites vers index.html)

## Structure

```
index.html          # Shell HTML, <script type="module" src="js/app.js">
css/style.css       # Tous les styles
js/
  config.js         # Constantes : SB, KEY, Qs (37 questions), CAT, COL
  state.js          # État partagé mutable (teams, rounds, survey, pin...)
  api.js            # Appels REST Supabase
  pin.js            # Logique PIN admin (hash, overlay, lockAdmin, savePin)
  admin.js          # Gestion équipes / rounds / questions
  survey.js         # Formulaire de réponse
  results.js        # Dashboard résultats + comparaison rounds + commentaires
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

## Patterns importants

- **Fonctions appelées depuis innerHTML** : doivent être exposées sur `window`
  (ex: `window.addTeam = function() {...}`)
- **Navigation inter-modules sans import circulaire** : `pin.js` appelle
  `window.showPage()` plutôt qu'importer depuis `app.js`
- **Deux formats de réponses en base** : ancien `{42: 3}` (nombre) et nouveau
  `{42: {score: 3, comment: "..."}}` - `calcScores()` gère les deux
- **PIN localhost** : bypass automatique en dev (`location.hostname === 'localhost'`)

## Supabase

- URL : `https://ocqvjzsogumonagjltli.supabase.co`
- Tables : `teams`, `rounds`, `responses`, `settings` (PIN)
- La clé API est publique (anon key) - pas de secret

## Features implémentées

- [x] Survey Lencioni 37 questions avec commentaires par question
- [x] Gestion équipes / rounds / sélection de questions
- [x] Dashboard résultats avec comparaison entre rounds
- [x] Affichage commentaires participants dans la vue résultats
- [x] PIN admin avec bypass localhost
- [x] Lien de partage par round

## Features à venir

- [ ] Vue longitudinale par personne (comparer les scores d'un même participant sur plusieurs rounds)
- [ ] Export PDF données brutes
- [ ] Export PDF avec analyse IA
