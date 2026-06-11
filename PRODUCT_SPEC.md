# Spécification produit - TeamPulse Restitution

> Source : brief PO reçu le 2026-06-11. Référence pour prioriser les prochains développements.

---

## Statut d'avancement global

| Périmètre | État |
|---|---|
| MVP Page Résultats | ~55% implémenté |
| V2 Fonctionnalités avancées | ~10% implémenté |

---

## MVP - Page de restitution

### En-tête de session

| Élément | Statut | Note |
|---|---|---|
| Nom de l'équipe | ✅ Fait | Affiché dans le header résultats |
| Date / label du round | ✅ Fait | Via `round.label` |
| Nombre de répondants | ✅ Fait | `responseCount` affiché |
| Taux de participation | ❌ Manquant | Nécessite de stocker le nb attendu de participants |

### Pyramide Lencioni

| Élément | Statut | Note |
|---|---|---|
| 5 niveaux avec labels corrects | ✅ Fait | Labels dysfonctions en 2 lignes + couleurs CBTW |
| Score moyen par niveau | ✅ Fait | Affiché sur chaque bande |
| Code couleur santé (sain/fragile/critique) | ✅ Fait | 3 états avec couleurs |
| Levier prioritaire identifié | ✅ Fait | Caption + chip "Priorité" sur l'étage le plus fragile |
| Indice d'accord / dispersion par niveau | ✅ Fait | Badge Consensuel/Partagé/Divergent sur chaque barre (stddev) |

### Synthèse rapide (bloc narratif)

| Élément | Statut | Note |
|---|---|---|
| 1-2 forces (niveaux sains) | ✅ Fait | Bloc synthèse 3 colonnes, scores ≥ 3.5 |
| 1-2 fragilités (niveaux critiques) | ✅ Fait | Bloc synthèse 3 colonnes, scores < 3.0 |
| 1-2 divergences (fort écart entre participants) | ✅ Fait | Bloc synthèse 3 colonnes, stddev > 1.2 |

### Détail par niveau (section expandable)

| Élément | Statut | Note |
|---|---|---|
| Score moyen par catégorie | ✅ Fait | Barres dans la vue rounds |
| Indice d'accord par catégorie | ✅ Fait | Badge dispersion sur chaque barre |
| 2-3 questions avec scores les plus hauts | ✅ Fait | Section "Questions saillantes" - 2 hautes par dimension |
| 2-3 questions avec scores les plus bas | ✅ Fait | Section "Questions saillantes" - 2 basses par dimension |
| 2-3 questions avec le plus d'écart entre participants | ❌ Manquant | Calcul par question non encore fait (dispersion actuelle = par catégorie) |
| Thèmes récurrents dans les verbatims | ❌ Manquant | Nécessite regroupement sémantique (NLP ou manuel) |
| 2-3 citations anonymisées par thème | ❌ Manquant | Actuellement : verbatims listés par participant |

### Verbatims

| Élément | Statut | Note |
|---|---|---|
| Affichage des verbatims | ✅ Fait | Toggle par participant dans la vue résultats |
| Regroupement par thème (pas liste brute) | ❌ Manquant | Actuellement classés par participant, pas thème |
| Anonymisation (pas de nom visible) | ✅ Fait | Noms remplacés par "Participant A/B/C..." dans le tableau et la vue longitudinale |
| Wording en mode "perception" | ❌ Manquant | Aucun wording particulier, libellés génériques |

---

## V2 - Fonctionnalités avancées

| Fonctionnalité | Statut | Note |
|---|---|---|
| Bloc priorités (à traiter / à explorer / à capitaliser) | ⚠️ Partiel | On identifie 1 priorité mais pas les 3 familles |
| Matrice score/accord (carte de chaleur 5 niveaux × dispersion) | ❌ Manquant | |
| Répartition des notes par niveau (% bas/moyen/haut, stacked bar) | ❌ Manquant | |
| Navigation riche par niveau (sections repliables, ancres) | ❌ Manquant | Navigation actuelle = sélection équipe/round |
| Mode atelier / facilitation (questions de coaching par niveau) | ❌ Manquant | |
| Comparaison multi-vagues avec indicateurs d'évolution (↑↓) | ⚠️ Partiel | Comparaison rounds side-by-side présente, mais sans delta affiché |
| Vue simple / vue coach | ❌ Manquant | |

---

## Features actuelles hors brief PO

Ces fonctionnalités existent dans l'app mais ne sont pas mentionnées dans le brief :

| Fonctionnalité | Note |
|---|---|
| Vue longitudinale par participant | Compare les scores d'un même répondant sur plusieurs rounds |
| Comparaison rounds en onglets | Tab navigation Admin/résultats multi-rounds |

> A prioriser avec le PO : garder / supprimer / intégrer dans le brief ?

---

## Récapitulatif des lacunes MVP restantes

Par ordre de priorité pour atteindre le MVP :

1. **Verbatims groupés par thème** - regroupement sémantique (décision PO : manuel ou NLP ?)
2. **Taux de participation** - stocker le nb attendu de participants par round (champ admin)
3. **Dispersion par question** - actuellement calculée par catégorie, pas encore par question individuelle
4. **Wording en mode "perception"** - libellés à reformuler

---

## Questions ouvertes

- Le regroupement des verbatims par thème est-il manuel (admin saisit les thèmes) ou automatique (NLP) ?
- L'anonymisation est-elle totale (aucun nom visible côté résultats) ou partielle (visible pour l'admin) ?
- Le "taux de participation" est-il un champ à saisir dans l'admin au moment de la création du round ?
- Les "questions de coaching" de la V2 sont-elles des contenus statiques par niveau ou dynamiques selon les scores ?
