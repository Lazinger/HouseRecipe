-- ===== recipes : livre de recettes partagé par tout le foyer =====
create table public.recipes (
  id text primary key,
  title text not null,
  category text not null,
  icon text not null,
  description text not null default '',
  time integer not null default 0,
  servings integer not null default 1,
  difficulty text not null default 'Facile',
  note text not null default '',
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  nutrition jsonb,
  allergens text,
  utensils jsonb,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

create policy "Household members can read recipes"
  on public.recipes for select
  using (auth.uid() is not null);

create policy "Household members can insert recipes"
  on public.recipes for insert
  with check (auth.uid() is not null);

create policy "Household members can update recipes"
  on public.recipes for update
  using (auth.uid() is not null);

create policy "Household members can delete recipes"
  on public.recipes for delete
  using (auth.uid() is not null);

-- ===== favorites : strictement personnels =====
create table public.favorites (
  user_id uuid not null references auth.users(id),
  recipe_id text not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

alter table public.favorites enable row level security;

create policy "Users manage their own favorites"
  on public.favorites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===== cart_state : panier strictement personnel, une ligne par compte =====
create table public.cart_state (
  user_id uuid primary key references auth.users(id),
  items jsonb not null default '[]',
  checked jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table public.cart_state enable row level security;

create policy "Users manage their own cart"
  on public.cart_state for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===== invite_codes : codes d'invitation à usage unique =====
-- Pas de policy publique : seule une Edge Function (clé service_role,
-- ajoutée dans un plan ultérieur) pourra lire/écrire cette table.
create table public.invite_codes (
  code text primary key,
  created_at timestamptz not null default now(),
  used_by uuid references auth.users(id),
  used_at timestamptz
);

alter table public.invite_codes enable row level security;

-- ===== Données de départ : les 8 recettes intégrées =====
insert into public.recipes (id, title, category, icon, description, time, servings, difficulty, note, ingredients, steps) values
('ratatouille', 'Ratatouille provençale', 'plat', 'pot', 'Légumes d''été mijotés doucement, à l''huile d''olive et au thym.', 55, 4, 'Facile', 'Encore meilleure réchauffée le lendemain : les saveurs ont le temps de se mêler.',
 '[["Aubergine","2 pièces"],["Courgette","3 pièces"],["Poivron rouge","2 pièces"],["Tomate","4 pièces"],["Oignon","2 pièces"],["Ail","3 gousses"],["Huile d''olive","6 c. à soupe"],["Thym frais","4 branches"],["Sel, poivre","au goût"]]'::jsonb,
 '["Coupez tous les légumes en dés réguliers d''environ 1,5 cm.","Faites revenir l''oignon et l''ail dans l''huile d''olive à feu moyen, 5 minutes.","Ajoutez le poivron, faites cuire 5 minutes, puis l''aubergine et la courgette.","Incorporez les tomates et le thym, salez, poivrez.","Laissez mijoter à couvert 35 minutes en remuant de temps en temps.","Retirez le couvercle 10 minutes en fin de cuisson pour réduire le jus."]'::jsonb
),
('quiche-lorraine', 'Quiche lorraine', 'plat', 'tart', 'Pâte brisée, lardons fumés et appareil crémeux, sans fromage à l''origine.', 50, 6, 'Facile', 'La vraie recette lorraine ne contient pas de gruyère — mais personne ne vous en voudra d''en ajouter.',
 '[["Pâte brisée","1 rouleau"],["Lardons fumés","200 g"],["Œufs","3 pièces"],["Crème fraîche épaisse","20 cl"],["Lait","10 cl"],["Noix de muscade","1 pincée"],["Sel, poivre","au goût"]]'::jsonb,
 '["Préchauffez le four à 200 °C. Étalez la pâte dans un moule à tarte.","Faites revenir les lardons à sec 3 minutes, puis répartissez-les sur la pâte.","Fouettez les œufs, la crème, le lait, la muscade, le sel et le poivre.","Versez l''appareil sur les lardons.","Enfournez 30 à 35 minutes, jusqu''à ce que la surface soit dorée."]'::jsonb
),
('tarte-tatin', 'Tarte Tatin', 'dessert', 'tart', 'Pommes caramélisées renversées sur une pâte feuilletée croustillante.', 65, 6, 'Intermédiaire', 'Démoulez tant que c''est encore chaud : le caramel fige vite et colle au moule en refroidissant.',
 '[["Pommes (Reinette)","8 pièces"],["Sucre","150 g"],["Beurre demi-sel","80 g"],["Pâte feuilletée","1 rouleau"]]'::jsonb,
 '["Épluchez et coupez les pommes en quartiers épais.","Dans un moule allant au four, faites un caramel à sec avec le sucre.","Ajoutez le beurre hors du feu, puis disposez les pommes serrées, côté bombé vers le bas.","Faites cuire 15 minutes à feu doux sur la plaque de cuisson.","Recouvrez de pâte feuilletée en rentrant les bords, puis enfournez 25 minutes à 200 °C.","Laissez tiédir 10 minutes avant de démouler d''un geste sûr sur un plat."]'::jsonb
),
('coq-au-vin', 'Coq au vin', 'plat', 'pot', 'Poulet mijoté au vin rouge, lardons, champignons et petits oignons.', 100, 4, 'Intermédiaire', 'Un vin qu''on accepterait de boire fera toujours une meilleure sauce.',
 '[["Cuisses de poulet","6 pièces"],["Vin rouge corsé","75 cl"],["Lardons","150 g"],["Champignons de Paris","250 g"],["Petits oignons grelots","12 pièces"],["Carotte","2 pièces"],["Ail","3 gousses"],["Bouquet garni","1"],["Farine","2 c. à soupe"]]'::jsonb,
 '["Faites dorer les morceaux de poulet dans une cocotte, puis réservez.","Faites revenir les lardons, les oignons et les carottes dans la même cocotte.","Saupoudrez de farine, mélangez 1 minute, puis remettez le poulet.","Versez le vin, ajoutez l''ail et le bouquet garni, salez, poivrez.","Laissez mijoter à couvert 1 h 15 à feu doux.","Ajoutez les champignons 15 minutes avant la fin de cuisson."]'::jsonb
),
('crepes', 'Crêpes fines', 'dessert', 'crepe', 'La pâte de base à garder sous la main, sucrée ou salée.', 30, 4, 'Facile', 'Une pâte reposée donne des crêpes plus souples : ne sautez pas cette étape si vous avez le temps.',
 '[["Farine","250 g"],["Œufs","3 pièces"],["Lait","50 cl"],["Beurre fondu","50 g"],["Sucre","2 c. à soupe"],["Sel","1 pincée"]]'::jsonb,
 '["Mélangez la farine, le sucre et le sel dans un saladier.","Creusez un puits, ajoutez les œufs et fouettez en incorporant peu à peu le lait.","Ajoutez le beurre fondu, puis laissez reposer la pâte 30 minutes.","Faites cuire chaque crêpe 1 à 2 minutes par face dans une poêle chaude et légèrement beurrée."]'::jsonb
),
('soupe-oignon', 'Soupe à l''oignon gratinée', 'entrée', 'bowl', 'Oignons longuement caramélisés, croûtons et gruyère fondu.', 75, 4, 'Facile', 'La patience sur les oignons fait toute la différence : ne pressez pas la caramélisation.',
 '[["Oignons jaunes","6 pièces"],["Beurre","40 g"],["Bouillon de bœuf","1,2 l"],["Vin blanc sec","10 cl"],["Pain de campagne","8 tranches"],["Gruyère râpé","150 g"]]'::jsonb,
 '["Émincez finement les oignons.","Faites-les fondre dans le beurre à feu doux 35 à 40 minutes, jusqu''à belle coloration.","Déglacez au vin blanc, puis ajoutez le bouillon et laissez mijoter 20 minutes.","Répartissez la soupe dans des bols, couvrez de pain et de gruyère.","Passez sous le grill quelques minutes jusqu''à ce que le fromage gratine."]'::jsonb
),
('tarte-citron', 'Tarte au citron meringuée', 'dessert', 'tart', 'Crème citron acidulée sur pâte sablée, meringue légèrement dorée.', 80, 8, 'Intermédiaire', 'Zestez les citrons avant de les presser — l''inverse est nettement plus périlleux.',
 '[["Pâte sablée","1 fond de tarte"],["Citrons","4 pièces"],["Œufs","4 pièces"],["Sucre","180 g"],["Beurre","100 g"],["Blancs d''œufs (meringue)","3 pièces"],["Sucre (meringue)","90 g"]]'::jsonb,
 '["Faites cuire le fond de tarte à blanc 15 minutes à 180 °C.","Fouettez les œufs et le sucre, ajoutez le jus et le zeste de citron.","Faites épaissir au bain-marie en remuant, puis incorporez le beurre hors du feu.","Versez la crème sur le fond de tarte cuit et laissez refroidir.","Montez les blancs en neige avec le sucre pour une meringue brillante.","Recouvrez la tarte de meringue et dorez au chalumeau ou sous le grill."]'::jsonb
),
('confit-oignons', 'Confit d''oignons maison', 'entrée', 'jar', 'Un condiment sucré-salé qui accompagne charcuteries et fromages.', 60, 1, 'Facile', 'Se conserve environ deux semaines au réfrigérateur dans un bocal propre.',
 '[["Oignons rouges","1 kg"],["Sucre roux","100 g"],["Vinaigre balsamique","8 cl"],["Beurre","30 g"],["Sel","1 pincée"]]'::jsonb,
 '["Émincez finement les oignons.","Faites-les suer dans le beurre à feu doux 10 minutes.","Ajoutez le sucre et laissez caraméliser légèrement 10 minutes.","Versez le vinaigre, salez, et laissez mijoter à découvert 30 minutes en remuant régulièrement.","Mettez en pot une fois la texture bien confite et laissez refroidir avant de fermer."]'::jsonb
);

-- ===== recipe-photos : photos de recettes (bucket Storage public) =====
insert into storage.buckets (id, name, public) values ('recipe-photos', 'recipe-photos', true);

create policy "Household members can read recipe photos"
  on storage.objects for select
  using (bucket_id = 'recipe-photos' and auth.uid() is not null);

create policy "Household members can upload recipe photos"
  on storage.objects for insert
  with check (bucket_id = 'recipe-photos' and auth.uid() is not null);

create policy "Household members can update recipe photos"
  on storage.objects for update
  using (bucket_id = 'recipe-photos' and auth.uid() is not null);

create policy "Household members can delete recipe photos"
  on storage.objects for delete
  using (bucket_id = 'recipe-photos' and auth.uid() is not null);

-- ===== Fonctions RPC pour l'inscription par code d'invitation =====
create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if auth.email() is distinct from 'jerem.r30@gmail.com' then
    raise exception 'not authorized';
  end if;
  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into public.invite_codes (code) values (new_code);
  return new_code;
end;
$$;

create or replace function public.check_invite_code(input_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists(select 1 from public.invite_codes where code = input_code and used_by is null);
end;
$$;

create or replace function public.redeem_invite_code(input_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  update public.invite_codes
    set used_by = auth.uid(), used_at = now()
    where code = input_code and used_by is null;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;
