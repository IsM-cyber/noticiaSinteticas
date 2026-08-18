-- ============================================================
-- noticiaSinteticas — comentarios
-- Pegar este SQL en Supabase: SQL Editor → New query → Run
-- ============================================================

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  story_key text not null,               -- identificador de la noticia (título normalizado)
  user_id uuid not null references auth.users (id) on delete cascade,
  author text not null,                  -- email o nick del autor
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'pending' -- pending | approved | rejected | reported
    check (status in ('pending', 'approved', 'rejected', 'reported')),
  created_at timestamptz not null default now()
);

create index if not exists comments_story_idx on public.comments (story_key);
create index if not exists comments_status_idx on public.comments (status);

-- RLS: activo
alter table public.comments enable row level security;

-- Cualquiera (logueado o no) puede LEER comentarios aprobados
create policy "leer aprobados" on public.comments
  for select using (status = 'approved');

-- Un usuario logueado puede CREAR comentarios (quedan en 'pending')
create policy "insertar logueados" on public.comments
  for insert with check (auth.uid() = user_id);

-- El autor puede actualizar solo su propio comentario (editarlo)
create policy "editar propio" on public.comments
  for update using (auth.uid() = user_id);

-- NOTA: la moderación (aprobar/rechazar) se hace desde la app con la
-- service_role key — no necesitamos política extra aquí.