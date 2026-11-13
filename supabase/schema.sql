-- Jogaço — tabelas do xadrez online.
-- Cole este arquivo inteiro no Supabase: SQL Editor → New query → Run.

create table if not exists public.chess_games (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  status      text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  fen         text not null,
  pgn         text not null default '',
  last_move   jsonb,
  result      text check (result in ('1-0', '0-1', '1/2-1/2')),
  reason      text,
  white_name  text,
  black_name  text
);

-- Tokens secretos de cada jogador. Sem políticas de RLS = ninguém lê pelo navegador;
-- só o servidor (chave secreta) acessa.
create table if not exists public.chess_seats (
  game_id  uuid not null references public.chess_games(id) on delete cascade,
  color    text not null check (color in ('w', 'b')),
  token    text not null,
  primary key (game_id, color)
);

create index if not exists chess_games_status_idx on public.chess_games (status, created_at desc);

alter table public.chess_games enable row level security;
alter table public.chess_seats enable row level security;

-- Qualquer um pode ASSISTIR (ler) partidas. Gravar, só pelo servidor.
drop policy if exists "partidas visiveis" on public.chess_games;
create policy "partidas visiveis" on public.chess_games for select using (true);

-- Liga as atualizações em tempo real dessa tabela.
do $$
begin
  alter publication supabase_realtime add table public.chess_games;
exception when duplicate_object then null;
end $$;
