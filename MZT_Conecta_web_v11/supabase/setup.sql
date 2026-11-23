-- MZT Conecta: cuentas y roles reales. Ejecutar UNA VEZ en el SQL Editor del proyecto Supabase.
-- Auth administra el correo, las contraseñas y las sesiones. Aquí NO se guardan contraseñas.
-- Este esquema no publica reportes: las publicaciones de v0.7 todavía son datos locales.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 3 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.app_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'ciudadano' check (role in ('ciudadano', 'lector', 'editor')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.app_roles enable row level security;

-- Evitar permisos amplios predeterminados en tablas del esquema public.
revoke all on public.profiles from public, anon, authenticated;
revoke all on public.app_roles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.app_roles to authenticated;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "edit own display name" on public.profiles;
create policy "edit own display name" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "read own role" on public.app_roles;
create policy "read own role" on public.app_roles for select to authenticated
  using ((select auth.uid()) = user_id);

-- La persona que se registra SIEMPRE comienza como Ciudadano.
-- No se aceptan roles procedentes de datos del navegador/metadata de Auth.
create or replace function public.handle_mzt_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'Ciudadano ' || left(replace(new.id::text, '-', ''), 8));
  insert into public.app_roles (user_id, role)
  values (new.id, 'ciudadano');
  return new;
end;
$$;

revoke all on function public.handle_mzt_new_user() from public, anon, authenticated;
drop trigger if exists on_mzt_auth_user_created on auth.users;
create trigger on_mzt_auth_user_created
  after insert on auth.users for each row execute function public.handle_mzt_new_user();

-- EJEMPLO para el administrador, ejecutado SOLO en SQL Editor:
-- update public.app_roles set role = 'editor'
-- where user_id = (select id from auth.users where email = 'CORREO_DEL_EDITOR');
-- Nunca concedas permiso UPDATE de app_roles a usuarios normales.
