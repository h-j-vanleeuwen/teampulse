# Spécification produit - TeamPulse Restitution

> Source : brief PO reçu le 2026-06-11. Référence pour prioriser les prochains développements.

---

## Statut d'avancement global

| Périmètre | État |
|---|---|
| MVP Page Résultats | ~35% implémenté |
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
| Indice d'accord / dispersion par niveau | ❌ Manquant | Aucun calcul d'écart-type ou variance actuellement |

### Synthèse rapide (bloc narratif)

| Élément | Statut | Note |
|---|---|---|
| 1-2 forces (niveaux sains) | ❌ Manquant | Section absente |
| 1-2 fragilités (niveaux critiques) | ❌ Manquant | Section absente |
| 1-2 divergences (fort écart entre participants) | ❌ Manquant | Section absente |

### Détail par niveau (section expandable)

| Élément | Statut | Note |
|---|---|---|
| Score moyen par catégorie | ✅ Fait | Barres dans la vue rounds |
| Indice d'accord par catégorie | ❌ Manquant | |
| 2-3 questions avec scores les plus hauts | ❌ Manquant | On a accès aux scores bruts mais pas ce calcul |
| 2-3 questions avec scores les plus bas | ❌ Manquant | |
| 2-3 questions avec le plus d'écart entre participants | ❌ Manquant | |
| Thèmes récurrents dans les verbatims | ❌ Manquant | Nécessite regroupement sémantique (NLP ou manuel) |
| 2-3 citations anonymisées par thème | ❌ Manquant | Actuellement : verbatims listés par participant |

### Verbatims

| Élément | Statut | Note |
|---|---|---|
| Affichage des verbatims | ✅ Fait | Toggle par participant dans la vue résultats |
| Regroupement par thème (pas liste brute) | ❌ Manquant | Actuellement classés par participant, pas thème |
| Anonymisation (pas de nom visible) | ❌ Manquant | Le nom du répondant est actuellement visible |
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

## Récapitulatif des lacunes MVP critiques

Par ordre de priorité pour atteindre le MVP :

1. **Indice d'accord / dispersion** - calcul d'écart-type par niveau et par question (bloque synthèse + divergences + carte V2)
2. **Top/bottom questions par niveau** - identifier les 2-3 hautes et basses par catégorie
3. **Synthèse rapide** - bloc forces / fragilités / divergences (dépend de #1)
4. **Verbatims anonymisés et groupés par thème** - supprimer le nom, regrouper sémantiquement
5. **Taux de participation** - stocker le nombre attendu de participants par round

---

## Questions ouvertes

- Le regroupement des verbatims par thème est-il manuel (admin saisit les thèmes) ou automatique (NLP) ?
- L'anonymisation est-elle totale (aucun nom visible côté résultats) ou partielle (visible pour l'admin) ?
- Le "taux de participation" est-il un champ à saisir dans l'admin au moment de la création du round ?
- Les "questions de coaching" de la V2 sont-elles des contenus statiques par niveau ou dynamiques selon les scores ?
