-- Publicación instantánea + moderación reactiva (ejecutar en SQL Editor de Supabase)
-- 1) contador de reportes por comentario (el comentario queda visible igual)
alter table public.comments add column if not exists report_count integer not null default 0;
alter table public.comments add column if not exists reported_at timestamptz;

-- 2) tabla de usuarios bloqueados por el editor
create table if not exists public.banned_users (
  user_id uuid primary key,
  email text,
  reason text,
  created_at timestamptz default now()
);

alter table public.banned_users enable row level security;

-- nadie (ni anónimos ni logueados) puede leer ni escribir la lista de bloqueados:
-- solo el servidor la usa (la key service_role saltea RLS)
create policy "banned no se lee" on public.banned_users for select using (false);
create policy "banned no se escribe" on public.banned_users for insert with check (false);

-- 3) los comentarios que estén pendientes pasan a publicarse directamente
update public.comments set status = 'approved' where status = 'pending';