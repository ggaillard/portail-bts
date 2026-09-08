-- ═══════════════════════════════════════════════════════════════════════════
--  BTS2 : 26 comptes pour 13 étudiants
--
--  Le pré-vol annonce « 26 étudiants, tous avec un code PIN (13 déjà
--  connectés) » alors que la promotion en compte 13. Il y a donc treize
--  lignes en trop dans « eleves » — vraisemblablement un import joué deux
--  fois, ou des comptes d'essai.
--
--  Ce fichier NE SUPPRIME RIEN tout seul. On regarde d'abord (section 1),
--  on décide, et on ne lance la section 3 qu'après.
--
--  Ne jamais supprimer un élève qui a des réponses : on effacerait son
--  travail. La section 3 refuse de le faire.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Regarder : qui sont ces 26 ? ───────────────────────────────────────
--  Trois colonnes suffisent à trancher. Un compte « jamais connecté, aucune
--  réponse » est un compte fantôme ; un compte avec des réponses est réel.
select e.numero,
       e.avatar,
       (e.auth_id is not null)                                  as deja_connecte,
       (select count(*) from public.reponses r where r.eleve_id = e.id) as reponses,
       e.vu_le
  from public.eleves e
  join public.classes c on c.id = e.classe_id
 where c.code = 'BTS2-SLAM-2026'
 order by e.numero, e.id;

-- ─── 2. Les doublons de numéro ─────────────────────────────────────────────
--  Si l'import a été joué deux fois, chaque numéro apparaît deux fois. Cette
--  requête le dit d'un coup d'œil : s'il n'y a aucune ligne, les treize en
--  trop portent des numéros distincts (14 à 26 par exemple) et c'est la
--  section 1 qui tranche.
select e.numero, count(*) as combien, array_agg(e.id order by e.id) as ids
  from public.eleves e
  join public.classes c on c.id = e.classe_id
 where c.code = 'BTS2-SLAM-2026'
 group by e.numero
having count(*) > 1
 order by e.numero;

-- ─── 3. Nettoyer — À LANCER SEULEMENT APRÈS AVOIR LU LA SECTION 1 ──────────
--  Supprime uniquement les comptes fantômes : jamais connectés, aucune
--  réponse, et qui font doublon avec un compte du même numéro. Le plus
--  ancien (plus petit id) est conservé.
--
--  Décommentez le bloc pour l'exécuter.
/*
begin;

with garde as (
  select min(e.id) as id
    from public.eleves e
    join public.classes c on c.id = e.classe_id
   where c.code = 'BTS2-SLAM-2026'
   group by e.numero
)
delete from public.eleves e
 using public.classes c
 where c.id = e.classe_id
   and c.code = 'BTS2-SLAM-2026'
   and e.id not in (select id from garde)
   and e.auth_id is null
   and not exists (select 1 from public.reponses r where r.eleve_id = e.id);

-- Compter avant de valider : on doit retomber sur 13.
select count(*) as restants
  from public.eleves e join public.classes c on c.id = e.classe_id
 where c.code = 'BTS2-SLAM-2026';

-- Si le compte est bon :   commit;
-- Sinon :                  rollback;
rollback;
*/

-- ─── 4. Si les surnuméraires ne sont pas des doublons ──────────────────────
--  Cas de comptes numérotés au-delà de la promotion (14, 15, 16…), jamais
--  utilisés. Ajuster le seuil, décommenter, vérifier, valider.
/*
begin;

delete from public.eleves e
 using public.classes c
 where c.id = e.classe_id
   and c.code = 'BTS2-SLAM-2026'
   and e.numero::int > 13                 -- <<< la taille réelle de la promo
   and e.auth_id is null
   and not exists (select 1 from public.reponses r where r.eleve_id = e.id);

select count(*) as restants
  from public.eleves e join public.classes c on c.id = e.classe_id
 where c.code = 'BTS2-SLAM-2026';

rollback;   -- remplacer par commit; si le compte est bon
*/
