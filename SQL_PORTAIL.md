# SQL du portail — à exécuter une fois

Supabase → **SQL Editor** → **New query** → coller → **Run**.
Les trois passes sont indépendantes, exécutez-les dans l'ordre.

---

## Passe 1 — Code PIN et table des projets

```sql
-- ═══ 1. Code PIN par étudiant ═══
-- Stocké en clair : ce n'est pas un secret fort, et vous devez pouvoir le
-- redonner à un étudiant qui l'a perdu. Il n'est jamais lisible par un élève
-- (aucune policy de lecture sur eleves pour anon).
alter table public.eleves add column if not exists pin text;

-- ═══ 2. Les projets visibles par classe ═══
create table if not exists public.projets (
  id          bigint generated always as identity primary key,
  classe_id   bigint not null references public.classes(id) on delete cascade,
  titre       text not null,
  description text,
  url         text not null,
  icone       text not null default '📘',
  ordre       int  not null default 0
);

alter table public.projets enable row level security;

-- Les liens de projets ne sont pas secrets : lecture publique.
drop policy if exists "projets lisibles" on public.projets;
create policy "projets lisibles" on public.projets
  for select to anon, authenticated using (true);

drop policy if exists "ens projets" on public.projets;
create policy "ens projets" on public.projets
  for all to authenticated
  using (public.est_enseignant()) with check (public.est_enseignant());
```

---

## Passe 2 — Identification avec PIN

> L'ancienne fonction est remplacée. Les deux sites existants continuent de
> fonctionner : ils appellent `rejoindre` sans PIN, et tant qu'un étudiant n'a
> pas de PIN, aucun n'est exigé.

```sql
drop function if exists public.rejoindre(text, text, text);

create or replace function public.rejoindre(
  p_classe_code text,
  p_numero      text,
  p_avatar      text default null,
  p_pin         text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_classe   public.classes;
  v_eleve    public.eleves;
begin
  if auth.uid() is null then
    raise exception 'Session non initialisee';
  end if;

  select * into v_classe from public.classes where code = p_classe_code;
  if v_classe.id is null then
    raise exception 'Classe inconnue';
  end if;

  select * into v_eleve from public.eleves
   where classe_id = v_classe.id and numero = p_numero;

  if v_eleve.id is null then
    raise exception 'Numero introuvable dans cette classe';
  end if;

  -- PIN exigé seulement s'il en existe un pour cet étudiant
  if v_eleve.pin is not null and btrim(coalesce(p_pin, '')) <> v_eleve.pin then
    raise exception 'Code PIN incorrect';
  end if;

  update public.eleves
     set auth_id = auth.uid(),
         avatar  = coalesce(p_avatar, avatar),
         vu_le   = now()
   where id = v_eleve.id
  returning * into v_eleve;

  return jsonb_build_object(
    'eleve_id',    v_eleve.id,
    'numero',      v_eleve.numero,
    'avatar',      v_eleve.avatar,
    'classe_code', v_classe.code,
    'classe_nom',  v_classe.nom
  );
exception when unique_violation then
  raise exception 'Cet avatar est deja pris';
end; $$;

grant execute on function public.rejoindre(text,text,text,text) to anon, authenticated;
```

### Qui suis-je — utilisé par le portail au rechargement

```sql
create or replace function public.qui_suis_je()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'eleve_id', e.id, 'numero', e.numero, 'avatar', e.avatar,
           'classe_id', c.id, 'classe_code', c.code, 'classe_nom', c.nom)
    from public.eleves e join public.classes c on c.id = e.classe_id
   where e.auth_id = auth.uid()
   limit 1;
$$;

grant execute on function public.qui_suis_je() to anon, authenticated;

-- Le portail appelle est_enseignant() pour savoir quel espace ouvrir.
grant execute on function public.est_enseignant() to anon, authenticated;
```

---

## Passe 3 — Générer les PIN et déclarer les projets

```sql
-- ═══ PIN aléatoires à 4 chiffres pour tous les étudiants ═══
update public.eleves
   set pin = lpad((floor(random() * 9000) + 1000)::int::text, 4, '0')
 where pin is null;

-- ═══ Les projets de chaque classe ═══
insert into public.projets (classe_id, titre, description, url, icone, ordre)
select c.id, v.titre, v.descr, v.url, v.icone, v.ordre
  from public.classes c,
       (values
         ('Bloc 1 DEV - Les 4 cultures Ops',
          'Les 14 seances du semestre : cours, questions et corrections.',
          'https://ggaillard.github.io/BTS1_S1_B1_DEV/', 'DEV', 1)
       ) as v(titre, descr, url, icone, ordre)
 where c.code = 'BTS1-DEV-2026';

insert into public.projets (classe_id, titre, description, url, icone, ordre)
select c.id, v.titre, v.descr, v.url, v.icone, v.ordre
  from public.classes c,
       (values
         ('PlaylistApp - C# et .NET 10',
          'Tableau de bord des 5 TP : missions, quiz et progression.',
          'https://ggaillard.github.io/playlist-csharp/', 'C#', 1),
         ('Depot du projet PlaylistApp',
          'Le code, les guides de TP et la page de depannage.',
          'https://github.com/ggaillard/playlist-csharp', 'GIT', 2)
       ) as v(titre, descr, url, icone, ordre)
 where c.code = 'BTS2-SLAM-2026';
```

---

## Récupérer la liste des PIN à distribuer

```sql
select c.code as classe, e.numero, e.pin
  from public.eleves e
  join public.classes c on c.id = e.classe_id
 order by c.code, e.numero;
```

Exportez en CSV depuis Supabase, puis reportez les PIN dans la colonne prévue
du tableau de bord enseignant. **Ne diffusez jamais cette liste entière** :
chaque étudiant ne reçoit que son numéro et son PIN.

## Réinitialiser le PIN d'un étudiant

```sql
update public.eleves e
   set pin = '1234'
  from public.classes c
 where c.id = e.classe_id and c.code = 'BTS1-DEV-2026' and e.numero = '07';
```

## Délier un étudiant qui a changé de poste

Normalement inutile : ressaisir numéro et PIN relie automatiquement le nouveau
navigateur. À n'utiliser que pour forcer une déconnexion.

```sql
update public.eleves e
   set auth_id = null
  from public.classes c
 where c.id = e.classe_id and c.code = 'BTS1-DEV-2026' and e.numero = '07';
```
