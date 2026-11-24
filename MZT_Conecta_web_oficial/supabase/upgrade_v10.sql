-- MZT Conecta v1.0: migración acumulativa para el MISMO proyecto Supabase de v0.9.
-- Ejecútala en SQL Editor (rol administrador). No borra cuentas ni datos previos.
-- Antes, realiza una copia de seguridad. No publiques claves secret/service_role.
begin;

-- Información social: la tabla profiles existente se conserva.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists cover_url text;
update public.profiles set username = 'c_' || left(replace(id::text,'-',''),12)
 where username is null or btrim(username) = '';
alter table public.profiles alter column username set not null;
create unique index if not exists mzt_profiles_username_unique on public.profiles (lower(username));
-- Las comprobaciones se agregan solo una vez, sin alterar el histórico.
do $$ begin
  if not exists(select 1 from pg_constraint where conname='mzt_username_format') then
    alter table public.profiles add constraint mzt_username_format
      check(username ~ '^[a-z0-9._]{3,20}$');
  end if;
  if not exists(select 1 from pg_constraint where conname='mzt_bio_size') then
    alter table public.profiles add constraint mzt_bio_size check(char_length(bio) <= 160);
  end if;
end $$;

-- Consultar perfiles de la comunidad sin hacer públicos correos ni roles.
drop policy if exists "read own profile" on public.profiles;
drop policy if exists "mzt_profiles_read" on public.profiles;
create policy "mzt_profiles_read" on public.profiles for select to authenticated using(true);
grant select on public.profiles to authenticated;
grant update (display_name,username,bio,avatar_url,cover_url) on public.profiles to authenticated;
-- Ya existe política 'edit own display name': controla las nuevas columnas también.

-- El trigger original continúa creando cuentas Ciudadano, con un @usuario inicial único.
create or replace function public.handle_mzt_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.profiles(id,display_name,username)
 values(new.id, 'Ciudadano ' || left(replace(new.id::text,'-',''),8),
        'c_' || left(replace(new.id::text,'-',''),12));
 insert into public.app_roles(user_id,role) values(new.id,'ciudadano');
 return new;
end; $$;
revoke all on function public.handle_mzt_new_user() from public, anon, authenticated;

-- Comprobación de roles sin introducir dependencia recursiva en RLS.
create or replace function public.mzt_has_role(p_role text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.app_roles where user_id = (select auth.uid()) and role = p_role) $$;
revoke all on function public.mzt_has_role(text) from public, anon, authenticated;
grant execute on function public.mzt_has_role(text) to authenticated;

create table if not exists public.mzt_posts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 type text not null check(type in('citizen','infrastructure','news')),
 category text not null default 'Comunidad' check(char_length(category) between 1 and 100),
 title text not null check(char_length(btrim(title)) between 3 and 110),
 description text not null default '' check(char_length(description) <= 800),
 location text not null default 'Toda la ciudad' check(char_length(location) <= 160),
 longitude double precision,
 latitude double precision,
 photo_url text,
 source_name text,
 source_url text,
 review text not null default 'pending' check(review in('pending','reviewed','approved','rejected')),
 rejection_reason text,
 reviewed_at timestamptz,
 approved_at timestamptz,
 resolved_at date,
 created_at timestamptz not null default now(),
 constraint mzt_post_coords check ((longitude is null and latitude is null) or
   (longitude between -180 and 180 and latitude between -90 and 90))
);
create index if not exists mzt_posts_created_idx on public.mzt_posts(created_at desc);
create index if not exists mzt_posts_owner_idx on public.mzt_posts(user_id,created_at desc);
create index if not exists mzt_posts_review_idx on public.mzt_posts(review,created_at desc);
alter table public.mzt_posts enable row level security;
revoke all on public.mzt_posts from public, anon, authenticated;
grant select, insert on public.mzt_posts to authenticated;
drop policy if exists "mzt_posts_read" on public.mzt_posts;
create policy "mzt_posts_read" on public.mzt_posts for select to authenticated
 using(review='approved' or user_id=(select auth.uid()) or public.mzt_has_role('lector') or public.mzt_has_role('editor'));
drop policy if exists "mzt_posts_insert" on public.mzt_posts;
create policy "mzt_posts_insert" on public.mzt_posts for insert to authenticated
 with check(user_id=(select auth.uid()) and
   ((type in('citizen','infrastructure') and review='pending' and approved_at is null and reviewed_at is null and rejection_reason is null and resolved_at is null and source_name is null and source_url is null)
    or (type='news' and review='approved' and public.mzt_has_role('editor') and source_name is not null and source_url is not null)));
-- No UPDATE/DELETE directos: la moderación se controla con funciones de servidor.

create table if not exists public.mzt_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.mzt_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 500),
 created_at timestamptz not null default now()
);
create index if not exists mzt_comments_post_idx on public.mzt_comments(post_id,created_at);
alter table public.mzt_comments enable row level security;
revoke all on public.mzt_comments from public, anon, authenticated;
grant select,insert,delete on public.mzt_comments to authenticated;
drop policy if exists "mzt_comments_read" on public.mzt_comments;
create policy "mzt_comments_read" on public.mzt_comments for select to authenticated
 using(exists(select 1 from public.mzt_posts p where p.id=post_id and (p.review='approved' or p.user_id=(select auth.uid()) or public.mzt_has_role('editor'))));
drop policy if exists "mzt_comments_insert" on public.mzt_comments;
create policy "mzt_comments_insert" on public.mzt_comments for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(select 1 from public.mzt_posts p where p.id=post_id and p.review='approved'));
drop policy if exists "mzt_comments_delete" on public.mzt_comments;
create policy "mzt_comments_delete" on public.mzt_comments for delete to authenticated
 using(user_id=(select auth.uid()) or public.mzt_has_role('editor'));

create table if not exists public.mzt_follows (
 follower_id uuid not null references auth.users(id) on delete cascade,
 followed_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,followed_id),
 constraint mzt_no_self_follow check(follower_id<>followed_id)
);
create index if not exists mzt_follows_followed_idx on public.mzt_follows(followed_id);
alter table public.mzt_follows enable row level security;
revoke all on public.mzt_follows from public, anon, authenticated;
grant select,insert,delete on public.mzt_follows to authenticated;
drop policy if exists "mzt_follows_read" on public.mzt_follows;
create policy "mzt_follows_read" on public.mzt_follows for select to authenticated using(true);
drop policy if exists "mzt_follows_insert" on public.mzt_follows;
create policy "mzt_follows_insert" on public.mzt_follows for insert to authenticated with check(follower_id=(select auth.uid()) and followed_id<>(select auth.uid()));
drop policy if exists "mzt_follows_delete" on public.mzt_follows;
create policy "mzt_follows_delete" on public.mzt_follows for delete to authenticated using(follower_id=(select auth.uid()));

create table if not exists public.mzt_votes (
 post_id uuid not null references public.mzt_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create index if not exists mzt_votes_post_idx on public.mzt_votes(post_id);
alter table public.mzt_votes enable row level security;
revoke all on public.mzt_votes from public, anon, authenticated;
grant select,insert,delete on public.mzt_votes to authenticated;
drop policy if exists "mzt_votes_read" on public.mzt_votes;
create policy "mzt_votes_read" on public.mzt_votes for select to authenticated
 using(exists(select 1 from public.mzt_posts p where p.id=post_id and p.review='approved'));
drop policy if exists "mzt_votes_insert" on public.mzt_votes;
create policy "mzt_votes_insert" on public.mzt_votes for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(select 1 from public.mzt_posts p where p.id=post_id and p.review='approved'));
drop policy if exists "mzt_votes_delete" on public.mzt_votes;
create policy "mzt_votes_delete" on public.mzt_votes for delete to authenticated using(user_id=(select auth.uid()));

-- La función solo permite la transición de estado según rol y estado anterior.
create or replace function public.mzt_moderate_post(p_post uuid,p_decision text,p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_role text; v_post public.mzt_posts%rowtype;
begin
 select role into v_role from public.app_roles where user_id=auth.uid();
 if v_role <> 'editor' or v_role is null then raise exception 'Solo el Editor puede moderar'; end if;
 select * into v_post from public.mzt_posts where id=p_post for update;
 if not found or v_post.type='news' or v_post.review not in('pending','reviewed') then raise exception 'La publicación no admite esa decisión'; end if;
 if p_decision='reviewed' and v_post.review='pending' then
   update public.mzt_posts set review='reviewed',reviewed_at=now() where id=p_post;
 elsif p_decision='approved' and v_role='editor' then
   update public.mzt_posts set review='approved',approved_at=now() where id=p_post;
 elsif p_decision='rejected' and v_role='editor' and char_length(btrim(coalesce(p_reason,''))) between 8 and 300 then
   update public.mzt_posts set review='rejected',rejection_reason=btrim(p_reason) where id=p_post;
 else raise exception 'Decisión no autorizada'; end if;
end $$;
revoke all on function public.mzt_moderate_post(uuid,text,text) from public,anon,authenticated;
grant execute on function public.mzt_moderate_post(uuid,text,text) to authenticated;
create or replace function public.mzt_resolve_post(p_post uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.app_roles where user_id=auth.uid() and role='editor') then
   raise exception 'Solo un Editor puede marcar reportes atendidos'; end if;
 update public.mzt_posts set resolved_at=current_date
 where id=p_post and type='infrastructure' and review='approved' and resolved_at is null;
 if not found then raise exception 'Reporte no disponible para marcar atendido'; end if;
end $$;
revoke all on function public.mzt_resolve_post(uuid) from public,anon,authenticated;
grant execute on function public.mzt_resolve_post(uuid) to authenticated;

-- Almacenamiento público de las imágenes que los propios usuarios deciden compartir.
-- IMPORTANTE: los contenidos del bucket son visibles para quien tenga la URL.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('mzt-media','mzt-media',true,4194304,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=true,file_size_limit=4194304,
   allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "mzt_media_upload" on storage.objects;
create policy "mzt_media_upload" on storage.objects for insert to authenticated
 with check(bucket_id='mzt-media' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists "mzt_media_delete" on storage.objects;
create policy "mzt_media_delete" on storage.objects for delete to authenticated
 using(bucket_id='mzt-media' and (storage.foldername(name))[1]=(select auth.uid()::text));

commit;
