# Dette technique — Beach Paddle Admin

## Sécurité Supabase — RLS désactivée

**Constat établi le 2026-07-24.**

### État actuel

Row Level Security (RLS) désactivée sur toutes les tables Supabase :
`ca_entries`, `charges`, `employees`, `work_sessions`, `immobilisations`.

La clé `NEXT_PUBLIC_SUPABASE_ANON_KEY` est publique par nature (embarquée dans le
bundle JS, visible dans les DevTools). Quiconque la récupère peut lire et écrire
directement dans toutes ces tables via l'API REST Supabase, sans passer par l'app.

### Gravité

Modérée. L'outil est interne, non indexé, et personne ne le cible activement.
Mais les données réelles (CA, charges, employés) sont techniquement accessibles de
l'extérieur.

La table `devis` n'existe pas dans Supabase — les devis sont en localStorage, hors
de portée.

### Solution retenue : option (c)

Router toutes les **écritures** sensibles via des API routes server-side qui utilisent
le `SUPABASE_SERVICE_ROLE_KEY` (variable non exposée côté client). Les lectures
peuvent rester côté client avec la clé anon pour l'instant.

Concrètement :
1. Ajouter `SUPABASE_SERVICE_ROLE_KEY` dans les variables Vercel (ne jamais la préfixer `NEXT_PUBLIC_`)
2. Créer un second client Supabase dans `lib/supabase-admin.ts` (server-side only)
3. Migrer les mutations (`INSERT`, `UPDATE`, `DELETE`) vers des API routes utilisant ce client
4. Activer RLS + policies "SELECT public, INSERT/UPDATE/DELETE via service role"

Chantier estimé : 1-2 jours. À traiter hors saison.
