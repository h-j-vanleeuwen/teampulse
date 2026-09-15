# send-result-email — déploiement

Cette Edge Function envoie par email le résultat individuel d'un participant
juste après qu'il a soumis le questionnaire (si l'option est activée sur le
round). Elle utilise [Resend](https://resend.com) pour l'envoi réel.

Le code front (checkbox admin, champ email, calcul du score, appel de la
fonction) est déjà en place. Il reste 4 étapes côté infra, à faire une seule
fois — je ne peux pas les exécuter moi-même car elles demandent tes
identifiants (login Supabase, clé API Resend).

## 1. Appliquer les migrations SQL

Dans le [Dashboard Supabase](https://supabase.com/dashboard/project/ocqvjzsogumonagjltli)
→ SQL Editor, colle et exécute, dans l'ordre :
1. `supabase/migrations/20260914000000_round_send_individual_result.sql`
2. `supabase/migrations/20260915000000_round_email_categories.sql`

Ça ajoute :
- `rounds.send_individual_result` (bool, défaut `false`)
- `rounds.email_categories` (texte JSON, défaut les 5 catégories) — quelles
  catégories Lencioni sont révélées dans l'email, indépendamment des
  questions réellement posées dans le round
- `responses.email` (texte, nullable) — garde une trace de l'email utilisé

Si tu avais déjà appliqué la migration 1 précédemment, il suffit d'appliquer
la migration 2 (elle est `if not exists`, donc sans risque de la rejouer).

## 2. Créer un compte Resend + clé API

1. Crée un compte sur https://resend.com (gratuit jusqu'à 3000 emails/mois).
2. Dashboard Resend → **API Keys** → crée une clé (garde-la, elle ne
   s'affiche qu'une fois).
3. Par défaut la fonction utilise l'expéditeur sandbox `onboarding@resend.dev`.
   **Attention : en mode sandbox, Resend n'autorise l'envoi qu'à l'adresse
   email de ton propre compte Resend** — tester avec l'email d'un vrai
   participant échouera (`403 validation_error`). Ça permet de vérifier la
   chaîne technique, pas d'envoyer à de vrais participants.

   Pour envoyer à n'importe quel destinataire (obligatoire avant d'ouvrir la
   feature à de vrais participants) : vérifie un domaine dans Resend →
   **Domains** (ajoute les enregistrements DNS SPF/DKIM fournis), puis
   configure le secret `RESEND_FROM` avec une adresse sur ce domaine
   (étape 4).

## 3. Installer le CLI Supabase et te connecter

```bash
npx supabase login
npx supabase link --project-ref ocqvjzsogumonagjltli
```

`login` ouvre ton navigateur pour l'auth Supabase — je ne peux pas le faire
à ta place.

## 4. Configurer le secret et déployer

```bash
npx supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
# optionnel, une fois un domaine vérifié dans Resend :
# npx supabase secrets set RESEND_FROM="TeamPulse <resultats@tondomaine.com>"

npx supabase functions deploy send-result-email --no-verify-jwt
```

`--no-verify-jwt` est nécessaire car les participants ne sont pas
authentifiés (accès via `?round=xxx`).

**Important** : à chaque fois que `index.ts` est modifié (comme maintenant —
il envoie désormais les réponses question par question, groupées par
catégorie, plutôt que juste les moyennes), il faut redéployer avec la même
commande `supabase functions deploy send-result-email --no-verify-jwt`. Si
tu es déjà loggé/linké (étapes 1-3 déjà faites), c'est la seule commande à
relancer.

## Vérifier que ça marche

Une fois déployé, crée un round de test avec la case "Envoyer le résultat
individuel par email" cochée, remplis le questionnaire avec l'adresse email
de ton compte Resend (tant qu'aucun domaine n'est vérifié — voir ci-dessus),
et vérifie la réception. Les erreurs éventuelles apparaissent dans Supabase
Dashboard → Edge Functions → send-result-email → Logs.
