-- ═══════════════════════════════════════════════════════════════════════════
--  APPEL AUTOMATIQUE — pour que le pointage ne dépende plus d'un oubli
--
--  Constat du 07/09 : la question d'appel n'existait que pour le BTS1, et
--  seulement pour la date du jour où le script a été joué. Résultat, les
--  étudiants du BTS2 ne voyaient rien, et le BTS1 n'aurait plus rien vu dès
--  le lendemain. Un appel qui disparaît en silence est pire que pas d'appel.
--
--  Correctif : appel_du_jour() CRÉE la question du jour si elle manque.
--   • une question de la banque si l'enseignant en a posé une (rien ne change) ;
--   • sinon une question de présence simple, pour que le pointage ait lieu.
--
--  À coller dans Supabase → SQL Editor → Run. Après APPEL.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. La question de secours, une par classe ─────────────────────────────
--  Stockée comme un corrigé « modèle » sur la séance 99, sans date. Elle sert
--  de repli et n'est jamais proposée telle quelle si une question datée existe.
insert into public.corriges (seance_id, question, bonne_reponse, explication, intitule, options)
select s.id, 'appel-modele', 'A',
       'Merci, votre présence est enregistrée.',
       'Vous êtes là ? Choisissez « Présent » pour signaler votre arrivée.',
       array['Présent', 'Présent, en retard', 'Présent, à distance', 'Présent, sur un autre poste']
  from public.seances s
 where s.numero = 99
   and not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = 'appel-modele');

-- ─── 2. appel_du_jour() sait maintenant se débrouiller seule ───────────────
--  volatile et non plus stable : elle peut écrire. C'est ce qui garantit
--  qu'un étudiant qui se connecte trouve toujours une question à laquelle
--  répondre, donc que l'appel existe toujours.
create or replace function public.appel_du_jour()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_eleve  public.eleves;
  v_seance public.seances;
  v_cor    public.corriges;
  v_rep    public.reponses;
  v_modele public.corriges;
  v_q      text := 'appel-' || to_char(current_date, 'YYYY-MM-DD');
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return null; end if;

  select * into v_seance from public.seances
   where classe_id = v_eleve.classe_id and numero = 99;
  if not found then return null; end if;

  select * into v_cor from public.corriges
   where seance_id = v_seance.id and question = v_q;

  -- Pas de question posée aujourd'hui : on en crée une depuis le modèle.
  if not found then
    select * into v_modele from public.corriges
     where seance_id = v_seance.id and question = 'appel-modele';
    if not found then return null; end if;

    insert into public.corriges (seance_id, question, bonne_reponse, explication, intitule, options)
    values (v_seance.id, v_q, v_modele.bonne_reponse, v_modele.explication,
            v_modele.intitule, v_modele.options)
    on conflict do nothing;

    select * into v_cor from public.corriges
     where seance_id = v_seance.id and question = v_q;
    if not found then return null; end if;
  end if;

  select * into v_rep from public.reponses
   where eleve_id = v_eleve.id and seance_id = v_seance.id and question = v_q;

  return jsonb_build_object(
    'seance_id',  v_seance.id,
    'question',   v_q,
    'intitule',   coalesce(v_cor.intitule, 'Question du jour'),
    'options',    to_jsonb(v_cor.options),
    'repondu',    found,
    'ma_reponse', v_rep.reponse
  );
end; $$;

grant execute on function public.appel_du_jour() to anon, authenticated;

-- ─── 3. La question du jour pour le BTS2, tout de suite ────────────────────
--  Le TP0 commence : on pose la question de mise en route correspondante.
insert into public.corriges (seance_id, question, bonne_reponse, explication, intitule, options)
select s.id, 'appel-' || to_char(current_date, 'YYYY-MM-DD'), 'B',
       'run compile si besoin puis exécute ; build se contente de compiler.',
       'Quelle commande lance une application .NET en console ?',
       array['dotnet build', 'dotnet run', 'dotnet new', 'dotnet test']
  from public.seances s
  join public.classes c on c.id = s.classe_id
 where c.code = 'BTS2-SLAM-2026' and s.numero = 99
   and not exists (select 1 from public.corriges co
                    where co.seance_id = s.id
                      and co.question = 'appel-' || to_char(current_date, 'YYYY-MM-DD'));

-- ─── 4. Contrôle ───────────────────────────────────────────────────────────
select c.code, co.question, co.intitule
  from public.corriges co
  join public.seances s on s.id = co.seance_id
  join public.classes c on c.id = s.classe_id
 where s.numero = 99
 order by c.code, co.question;
