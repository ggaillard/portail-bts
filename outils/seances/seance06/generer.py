# ─── Séance 6 du BTS1 — « Rouge, puis vert » : migrations depuis donnees.py ─
#
#   cd portail-bts
#   python3 outils/seances/seance06/generer.py
#
# Écrit quatre migrations (titre + corrigés + contrôle d'entrée + créneau ;
# concepts ; points de passage ; questions au fil) depuis les listes de
# donnees.py, après avoir vérifié que la trace (docs/seances/seance-06.md, à
# côté de portail-bts) porte EXACTEMENT les mêmes énoncés et options — quiz et
# questions au fil, lettre pour lettre — et des actes datés, un par passage.
# Même structure que les migrations de la séance 5 (03/11).
import os, re, sys
from collections import Counter

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from donnees import N, Q, PRE, CONCEPTS, ACCUEIL_MIN, PASSAGES, FIL

RACINE = os.path.normpath(os.path.join(ICI, '..', '..', '..'))
# 14/11 : séance REPORTÉE au semestre 2 (SLAM). Les migrations s'écrivent
# hors de la chaîne, dans en-attente-S2/ ; à déplacer dans supabase/migrations
# (avec un nouvel horodatage, la classe et le numéro du S2) le moment venu.
MIG = os.path.join(ICI, 'en-attente-S2')
PREFIXE = '20261114110'
SORTIES = (PREFIXE + '000_bts1_seance6.sql', PREFIXE + '100_bts1_seance6_debriefing.sql',
           PREFIXE + '200_bts1_seance6_passages.sql', PREFIXE + '300_bts1_seance6_fil.sql')
TITRE = 'Séance 6 - Rouge, puis vert : votre premier pipeline'
CRENEAU = ('2026-11-25 12:00:00', '2026-11-25 13:00:00')   # heure de Paris

def trace():
    for nom in ('BTS1 S1 B1 DEV', 'BTS1_S1_B1_DEV', 'b1', 'sup'):
        for sous in (('reserve', 'seance-06-atelier-pipeline.md'),
                     ('docs', 'seances', 'seance-%02d.md' % N)):
            p = os.path.join(RACINE, '..', nom, *sous)
            if os.path.exists(p):
                return p
    sys.exit('trace de la séance %d introuvable à côté de portail-bts' % N)

def s(x): return "'" + x.replace("'", "''") + "'"
def arr(o): return "array[" + ", ".join(s(x) for x in o) + "]"

# ── Vérifications ──────────────────────────────────────────────────────────
t = open(trace(), encoding='utf-8').read().replace('\r\n', '\n')
c = Counter(b for _, b, *_ in Q)
assert len(Q) == 10 and [n for n, *_ in Q] == list(range(1, 11))
assert max(c.values()) <= 3, c
assert max(Counter(b for _, b, *_ in FIL).values()) <= 2
for liste in (Q, ):
    for n, b, i, o, e in liste:
        assert len(o) == 4 and '`' not in i and not any('·' in x or '`' in x for x in o), n

page = {}
for num, enonce, ligne in re.findall(r'^\*\*(\d+)\.\*\* (.+?)\n(`.+)$', t, re.M):
    page[int(num)] = (enonce.strip(), [x.strip() for x in re.findall(r'`[A-D]`\s*([^·`]+)', ligne)])
for n, b, i, o, e in Q:
    assert page.get(n) == (i, o), ('quiz q%d différent de la page' % n, page.get(n), (i, o))

blocs = re.findall(r'^!!! fil "Au fil de l\'heure — question (\d+)"\n    \*\*(.+?)\*\*\n\n    (`.+)$', t, re.M)
assert len(blocs) == len(FIL), ('blocs fil dans la trace', len(blocs))
for (rang, enonce, ligne), (k, b, e, o, x, _) in zip(blocs, FIL):
    opts = [y.strip() for y in re.findall(r'`[A-D]`\s*([^·`]+)', ligne)]
    assert (enonce, opts) == (e, o), ('question au fil', k, enonce, opts)

actes = [(m.group(1).strip(), int(m.group(2))) for m in
         re.finditer(r'^##\s+\S+\s+ACTE\s+[IVX]+\s+—\s+(.*?)\s+\*\(≈\s*(\d+)\s*min\)\*', t, re.M)]
assert len(actes) == len(PASSAGES), actes

def entete(sujet, texte):
    return ("-- " + "═" * 75 + "\n--  SÉANCE %d DU BTS1 — %s\n--\n" % (N, sujet) +
            "\n".join("--  " + l if l else "--" for l in texte.split("\n")) +
            "\n--\n--  Rejouable sans risque.\n-- " + "═" * 75 + "\n\n")

SEANCE = "  join public.classes c on c.code = 'BTS1-DEV-2026'\n  join public.seances s on s.classe_id = c.id and s.numero = %d\n" % N

# ── 1. Titre, corrigés, contrôle d'entrée, créneau ────────────────────────
lettres = ' '.join(b for _, b, *_ in Q)
repart = ', '.join('%d %s' % (c[l], l) for l in 'ABCD')
ins = ",\n\n".join("  (%d, %s, %s,\n   %s,\n   %s,\n   %s)" % (N, s('q%d' % n), s(b), s(i), arr(o), s(e)) for n, b, i, o, e in Q)
rat = ",\n".join("    (%s, %s, %s, %s, %s)" % (s('q%d' % n), s(b), s(i), arr(o), s(e)) for n, b, i, o, e in Q)
pre = ",\n\n".join("    (%s, %s,\n     %s,\n     %s,\n     %s)" % (s(k), s(b), s(i), arr(o), s(e)) for k, b, i, o, e in PRE)

A = entete("« Rouge, puis vert »", """Produit par outils/seances/seance06/generer.py depuis donnees.py (14/11).
Titre de récit, dix corrigés (q1…q10), le contrôle d'entrée (cinq notions
de la séance 5, chacune doublée de sa certitude), et le créneau : mercredi
25/11, 12 h – 13 h, ouverture et clôture automatiques.

Bonnes réponses : %s — %s.

Les corrigés ne sont réécrits que si personne n'y a répondu ; le contrôle
d'entrée n'est jamais réécrit après une première réponse.""" % (lettres, repart)) + """
-- ─── 1. Le titre de récit ──────────────────────────────────────────────────
update public.seances s
   set titre = %(titre)s
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS1-DEV-2026' and s.numero = %(n)d
   and s.titre is distinct from %(titre)s;

-- ─── 2. Les dix corrigés ───────────────────────────────────────────────────
with q (numero, cle, bonne, intitule, options, explication) as (values
%(ins)s
)
insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
select s.id, q.cle, q.bonne, q.intitule, q.options, q.explication
  from q
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = q.numero
 where not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = q.cle);

with q (cle, bonne, intitule, options, explication) as (values
%(rat)s
)
update public.corriges co
   set intitule = q.intitule, options = q.options,
       explication = q.explication, bonne_reponse = q.bonne
  from q, public.classes c, public.seances s
 where c.code = 'BTS1-DEV-2026' and s.classe_id = c.id and s.numero = %(n)d
   and co.seance_id = s.id and co.question = q.cle
   and not exists (select 1 from public.reponses r
                    where r.seance_id = s.id and r.question = q.cle);

-- ─── 3. Le contrôle d'entrée — ce qu'il reste de la séance 5 ───────────────
--  Écrit par insert et non par creer_controle(), qui exige est_enseignant().
--  Créé FERMÉ : on l'ouvre depuis le portail le jour J.
do $$
declare v_seance bigint; v_deja int;
begin
  select s.id into v_seance
    from public.seances s join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = %(n)d;
  if v_seance is null then
    raise exception 'BTS1-DEV-2026 : pas de séance %(n)d en base';
  end if;

  select count(*) into v_deja from public.reponses r
   where r.seance_id = v_seance and r.question like 'pre-%%';
  if v_deja > 0 then
    raise notice 'Contrôle de la séance %(n)d : %% réponse(s) déjà données, rien n''est réécrit.', v_deja;
    return;
  end if;

  delete from public.corriges where seance_id = v_seance and question like 'pre-%%';

  insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
  select v_seance, q.cle, q.bonne, q.intitule, q.options, q.explication
    from (values

%(pre)s

    ) as q(cle, bonne, intitule, options, explication);

  insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
  select v_seance, 'pre-' || lpad(i::text, 2, '0') || '-c', 'Z',
         'Sur cette notion, vous diriez :',
         array['Je saurais l''expliquer', 'Je crois avoir compris',
               'J''ai un doute', 'Je ne sais plus'],
         null
    from generate_series(1, %(npre)d) as i;
end $$;

-- ─── 4. Le créneau : mercredi 25/11, 12 h – 13 h ───────────────────────────
--  L'automate (seances_a_l_heure) ouvre la séance à 12 h et la referme à
--  13 h 15. Seulement si elle n'a jamais été démarrée : une reprogrammation
--  faite depuis le portail n'est pas écrasée au rejeu.
update public.seances s
   set prevue_le   = timestamptz %(deb)s,
       fin_prevue  = timestamptz %(fin)s,
       auto_ouvrir = true,
       auto_clore  = true
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS1-DEV-2026' and s.numero = %(n)d
   and s.demarree_le is null
   and (s.prevue_le is null or s.prevue_le < timestamptz '2026-11-19 00:00:00 Europe/Paris');

-- ─── 5. Contrôle ───────────────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = %(n)d and co.question ~ '^q[0-9]+$'
     and co.intitule is not null and array_length(co.options, 1) = 4;
  if n <> 10 then raise exception 'séance %(n)d : %% corrigés de quiz complets, 10 attendus', n; end if;

  select max(k) into n from (
    select count(*) as k from public.corriges co
      join public.seances s on s.id = co.seance_id
      join public.classes c on c.id = s.classe_id
     where c.code = 'BTS1-DEV-2026' and s.numero = %(n)d and co.question ~ '^q[0-9]+$'
     group by co.bonne_reponse) t;
  if n > 3 then raise exception 'une même lettre est bonne %% fois sur 10 : motif repérable', n; end if;
end $$;
""" % dict(titre=s(TITRE), n=N, ins=ins, rat=rat, seance=SEANCE, pre=pre, npre=len(PRE),
           deb=s(CRENEAU[0] + ' Europe/Paris'), fin=s(CRENEAU[1] + ' Europe/Paris'))

# ── 2. Concepts ────────────────────────────────────────────────────────────
B = entete("les cinq concepts, projetés en fin d'heure", """Produit par outils/seances/seance06/generer.py. Écrits par
migration_definir_concepts() (20260924061000), réponse LUE : un refus fait
échouer la migration au lieu de passer au vert sans rien écrire.""") + """do $$
declare v_id bigint; v_r jsonb;
begin
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = %d;
  if v_id is null then
    raise exception 'BTS1-DEV-2026 : pas de séance %d en base';
  end if;
  v_r := public.migration_definir_concepts(v_id, concat_ws(E'\\n',
%s));
  if not coalesce((v_r->>'ok')::boolean, false) then
    raise exception 'concepts de la séance %d non écrits : %%', v_r;
  end if;
end $$;
""" % (N, N, ",\n".join("      " + s(x) for x in CONCEPTS), N)

# ── 3. Points de passage ───────────────────────────────────────────────────
pl, fin_min = [], ACCUEIL_MIN
for i, (titre, duree) in enumerate(actes, 1):
    fin_min += duree
    titre = titre[0].upper() + titre[1:].lower()
    p = PASSAGES[i]
    if p:
        b, it, o, e = p
        pl.append("    (%d, %s, %d, %s, %s, %s, %s)" % (i, s(titre), fin_min, s(it), arr(o), s(b), s(e)))
    else:
        pl.append("    (%d, %s, %d, null::text, null::text[], null::text, null::text)" % (i, s(titre), fin_min))
C = entete("les points de passage, un par acte", """Produit par outils/seances/seance06/generer.py. Un ATELIER : chaque point
porte sur le dépôt de l'étudiant, on n'y répond qu'en ayant fait l'étape.
Fin d'acte = %d min d'accueil + les durées de la trace (dernier acte à la
%de minute). Après un premier passage, seule l'explication change, jamais
la bonne lettre — la règle du 16/09.""" % (ACCUEIL_MIN, fin_min)) + """with p (acte, titre, fin_min, intitule, options, bonne, explication) as (values
%s
)
insert into public.points_passage (seance_id, acte, titre, fin_min, intitule, options, bonne, explication)
select s.id, p.acte, p.titre, p.fin_min, p.intitule, p.options, p.bonne, p.explication
  from p
%son conflict (seance_id, acte) do update
   set titre       = excluded.titre,
       fin_min     = excluded.fin_min,
       intitule    = excluded.intitule,
       options     = excluded.options,
       explication = excluded.explication,
       bonne       = case when exists (select 1 from public.passages pa
                                        where pa.seance_id = points_passage.seance_id
                                          and pa.acte = points_passage.acte)
                          then points_passage.bonne else excluded.bonne end;

do $$
declare n int;
begin
  select count(*) into n from public.points_passage pp
    join public.seances s on s.id = pp.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = %d;
  if n < %d then raise exception 'séance %d : %% point(s) de passage, %d attendus', n; end if;
end $$;
""" % (",\n".join(pl), SEANCE, N, len(actes), N, len(actes))

# ── 4. Questions au fil ────────────────────────────────────────────────────
vals = ",\n".join("    (%s, %s, %s, %s, %s)" % (s(k), s(b), s(e), arr(o), s(x)) for k, b, e, o, x, _ in FIL)
D = entete("les questions au fil de l'heure", """Produit par outils/seances/seance06/generer.py. Sept questions placées dans
les actes (blocs `!!! fil` de la trace), sur ce que l'étudiant a SOUS LES
YEUX dans son dépôt. Chacune suivie d'une certitude fNN-c, sans corrigé.
fil_seance() existe déjà (20261103210000) : rien à redéfinir.
Les corrigés ne sont réécrits que si personne n'y a répondu.""") + """with q (cle, bonne, intitule, options, explication) as (values
%(v)s
)
insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
select s.id, q.cle, q.bonne, q.intitule, q.options, q.explication
  from q
%(seance)s where not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = q.cle);

with q (cle, bonne, intitule, options, explication) as (values
%(v)s
)
update public.corriges co
   set intitule = q.intitule, options = q.options,
       explication = q.explication, bonne_reponse = q.bonne
  from q, public.classes c, public.seances s
 where c.code = 'BTS1-DEV-2026' and s.classe_id = c.id and s.numero = %(n)d
   and co.seance_id = s.id and co.question = q.cle
   and not exists (select 1 from public.reponses r
                    where r.seance_id = s.id and r.question = q.cle);

do $$
declare n int;
begin
  select count(*) into n from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = %(n)d and co.question ~ '^f[0-9]+$';
  if n <> %(nf)d then raise exception 'séance %(n)d : %% question(s) au fil, %(nf)d attendues', n; end if;
end $$;
""" % dict(v=vals, seance=SEANCE, n=N, nf=len(FIL))

for nom, texte in zip(SORTIES, (A, B, C, D)):
    open(os.path.join(MIG, nom), 'w', encoding='utf-8', newline='\r\n').write(texte)
print('ok —', lettres, dict(c), '·', len(FIL), 'au fil ·', len(actes), 'actes, fin à', fin_min, 'min')
