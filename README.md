# TeamPulse

Outil d'évaluation de la santé d'équipe basé sur la méthodologie **Lencioni** (Les 5 dysfonctionnements d'une équipe).

Conçu pour les équipes CBTW - permet de mesurer, suivre et visualiser la maturité collective sur les 5 niveaux du modèle.

---

## Fonctionnalités

- **Survey** : questionnaire de 37 questions (échelle 1-5), accessible via un lien partagé
- **Dashboard résultats** : scores par catégorie, comparaison entre rounds, commentaires participants
- **Pyramide de Lencioni** : visualisation interactive des 5 dysfonctionnements avec code couleur santé
- **Vue longitudinale** : évolution des scores d'un même participant sur plusieurs rounds
- **Admin** : gestion des équipes, rounds et sélection de questions

---

## Stack technique

| Couche | Techno |
|---|---|
| Frontend | HTML + CSS + ES Modules natifs (pas de bundler) |
| Backend | Supabase (PostgreSQL + REST API auto-générée) |
| Auth | Supabase Auth (email + mot de passe) |
| Hosting | Vercel (JAMstack) |

---

## Démarrage local

```bash
# Cloner le repo
git clone https://github.com/h-j-vanleeuwen/teampulse.git
cd teampulse

# Lancer un serveur statique (port 3333)
python3 -m http.server 3333
# ou
npx serve -p 3333
```

Ouvrir `http://localhost:3333`.

> Pas de `npm install`, pas de build - les ES Modules sont chargés directement par le navigateur.

---

## Accès admin

L'accès aux pages **Results** et **Admin** nécessite une authentification.

- Cliquer sur **Results** ou **Admin** dans la navigation
- Saisir l'email et le mot de passe du compte admin
- Le compte est géré dans Supabase Dashboard > Authentication > Users

---

## Accès survey (participants)

Les participants accèdent au formulaire via un **lien partagé** généré dans l'admin :

```
https://teampulse-eta.vercel.app/?round=<round_id>&respondent=<nom>
```

Aucune authentification requise pour remplir un survey.

---

## Structure du projet

```
index.html          # Shell HTML unique
css/style.css       # Tous les styles
js/
  config.js         # Constantes globales (URL Supabase, questions, catégories)
  state.js          # État partagé entre modules
  api.js            # Appels REST Supabase
  auth.js           # Authentification Supabase Auth
  admin.js          # Logique page Admin
  survey.js         # Logique formulaire Survey
  results.js        # Logique dashboard Results + pyramide
  pyramid.js        # Données et calculs pyramide Lencioni
  app.js            # Point d'entrée, routing, boot
vercel.json         # Config Vercel (rewrites SPA)
```

---

## Modèle Lencioni

Les 5 dysfonctionnements, de la base au sommet :

| Niveau | Dysfonction | Indicateur |
|---|---|---|
| 01 | Manque de **Confiance** | Vulnérabilité, transparence |
| 02 | Peur de la **Confrontation** | Débat ouvert, désaccords sains |
| 03 | Absence d'**Engagement** | Adhésion aux décisions |
| 04 | Évitement de la **Responsabilisation** | Accountability collective |
| 05 | Inattention aux **Résultats** | Priorité au collectif sur l'ego |

Score sain ≥ 3.5 / 5 · Fragile : 2.5-3.5 · Critique < 2.5
