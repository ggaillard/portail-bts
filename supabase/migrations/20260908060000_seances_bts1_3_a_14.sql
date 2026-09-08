-- ═══════════════════════════════════════════════════════════════════════════
--  MIGRATION DE L'ANCIENNE BASE D1 VERS SUPABASE
--
--  Avant de supprimer le Worker « suivi » et la base D1 « tour-de-controle »,
--  inventaire de ce qu'elles contenaient encore. Relevé du 07/09/2026 :
--
--    progression   14 lignes   les 14 séances du semestre 1  ← LA SEULE CHOSE
--                                                              À MIGRER
--    eleves        30 lignes   prénoms seuls (18 BTS1 + 12 BTS2).
--                              Colonnes email et mdp présentes mais VIDES.
--                              Numérotation de l'export d'août, incomplet à
--                              18 : elle ne correspond pas à celle des 31
--                              étudiants d'aujourd'hui. Inutilisable, et de
--                              toute façon la table eleves de Supabase ne
--                              porte ni nom ni prénom.
--    reponses       1 ligne    « ESSAI Alice », la ligne de test. Rien.
--    jetons         0
--    pl_eleves      0          tables PlaylistApp jamais alimentées :
--    pl_jalons      0          le BTS2 est passé directement à Supabase.
--    pl_tp / pl_accueil / pl_jetons
--
--  Aucun travail d'étudiant n'existe dans D1. La migration se réduit donc aux
--  quatorze séances, ce que fait ce script.
--
--  Effet : le sélecteur de séance du portail montre tout le semestre, et
--  chaque semaine il ne reste qu'à ajouter les corrigés de la séance du jour.
--
--  Les séances 1 et 2 existent déjà (BTS1_SEANCES.sql) avec leurs titres de
--  récit : elles ne sont pas touchées.
--
--  Rejouable sans risque. À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Les séances 3 à 14 ─────────────────────────────────────────────────
--  Créées FERMÉES et sans corrigé : ce sont des repères de calendrier, pas
--  des séances prêtes. Une séance fermée n'accepte aucune réponse, donc rien
--  ne peut être enregistré par erreur d'ici à ce qu'elle soit écrite.
--
--  Le titre porte l'acte du fil rouge : le sélecteur devient lisible d'un
--  coup d'œil (« 07 — DevSecOps - Securite applicative … »).
insert into public.seances (classe_id, numero, titre, notee, ouverte, duree_min, nature)
select c.id, v.numero, v.titre, v.notee, false, 55, 'cours'
  from public.classes c
  cross join (values
      ( 3, 'Cadrage - Donnees & ecosystemes : SQL, NoSQL, Data Lake/Warehouse', false),
      ( 4, 'DevOps - Culture DevOps, cycle de vie & versioning Git',            false),
      ( 5, 'DevOps - Integration continue & conteneurisation (CI/CD, Docker)',  false),
      ( 6, 'DevOps - Atelier : mini-pipeline sur le projet fil rouge',          true),
      ( 7, 'DevSecOps - Securite applicative : OWASP Top 10 & analyse de risque', false),
      ( 8, 'DevSecOps - Mission audit DevSecure : cartographie des vulnerabilites', false),
      ( 9, 'DevSecOps - Remediation & conformite : auth, RGPD, AI Act, NIS2',   false),
      (10, 'Bilan - Evaluation sommative mi-semestre',                          true),
      (11, 'DataOps - Industrialiser la donnee : pipelines, ETL/ELT, qualite',  false),
      (12, 'DataOps - Mission Data « Sauver Doctolib »',                        false),
      (13, 'MLOps - Mettre l''IA en production & IA responsable (AI Act)',      false),
      (14, 'Synthese - Les 4 Ops en miroir + orientation metiers',              true)
    ) as v(numero, titre, notee)
 where c.code = 'BTS1-DEV-2026'                    -- <<< À MODIFIER
   and not exists (select 1 from public.seances s
                    where s.classe_id = c.id and s.numero = v.numero);

--  Les trois séances notées du semestre — S6 atelier, S10 bilan, S14 synthèse
--  — sont marquées « notee ». Le portail s'en sert pour ne pas mélanger un
--  entraînement et une évaluation dans les mêmes moyennes.

-- ─── 2. Contrôle : le semestre au complet ──────────────────────────────────
select s.numero,
       left(s.titre, 58) as titre,
       s.nature,
       case when s.notee then 'notee' else '' end as notee,
       case when s.ouverte then 'ouverte' else 'fermee' end as etat,
       count(co.*) as corriges
  from public.seances s
  join public.classes c on c.id = s.classe_id
  left join public.corriges co on co.seance_id = s.id
 where c.code = 'BTS1-DEV-2026' and s.numero <= 14
 group by s.numero, s.titre, s.nature, s.notee, s.ouverte
 order by s.numero;

-- ═══════════════════════════════════════════════════════════════════════════
--  CE QUI N'EST PAS MIGRÉ, ET POURQUOI
--
--  · Les prénoms de l'ancienne table eleves. La règle absolue tient : la
--    table eleves de Supabase ne contient ni nom, ni prenom, ni adresse.
--    Numéro et avatar, rien d'autre. La correspondance numéro → nom dont
--    vous avez besoin pour l'appel vit dans le navigateur de l'enseignant
--    (panneau « Noms des étudiants… » du portail), jamais en base.
--
--  · Et surtout : la numérotation de D1 n'est PAS celle d'aujourd'hui.
--    D1 n° 3 = Aboubakar ; sur la liste actuelle de 31, le n° 3 est quelqu'un
--    d'autre. L'ancien export s'arrêtait à 18. Réutiliser ces numéros ferait
--    un appel faux. Ne pas s'en servir.
--
--  · La ligne « ESSAI Alice » : une ligne de test, sans intérêt.
--
--  Une fois ce script joué, D1 ne contient plus rien qui n'existe ailleurs.
-- ═══════════════════════════════════════════════════════════════════════════
