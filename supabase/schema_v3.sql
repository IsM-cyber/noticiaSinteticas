-- ============================================================
-- noticiaSinteticas — chat global
-- Pegar este SQL en Supabase: SQL Editor → New query → Run
-- ============================================================

-- 1) mensajes del chat (uno solo, global: no va por noticia)
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  author text not null,                 -- nombre visible elegido por el usuario
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

-- el índice es al revés porque siempre se lee "lo último primero"
create index if not exists chat_messages_created_idx
  on public.chat_messages (created_at desc);

-- 2) RLS: acá sí hace falta estar registrado (a diferencia de los comentarios,
--    que se pueden leer sin cuenta)
alter table public.chat_messages enable row level security;

create policy "leer chat" on public.chat_messages
  for select using (auth.uid() is not null);

create policy "enviar chat" on public.chat_messages
  for insert with check (auth.uid() = user_id);

create policy "borrar propio" on public.chat_messages
  for delete using (auth.uid() = user_id);

-- 3) tiempo real: sin esto la página no recibe los mensajes de los demás
--    (seSubscribe no escucha cambios si la tabla no está en la publicación)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
