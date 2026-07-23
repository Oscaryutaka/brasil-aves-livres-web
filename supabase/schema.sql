create extension if not exists pgcrypto;

create table if not exists public.aves (
  id uuid primary key default gen_random_uuid(),
  nome_popular text not null,
  nome_cientifico text,
  url_wikiaves text not null unique,
  slug text not null,
  fonte text not null default 'manual',
  validado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.buscas (
  id uuid primary key default gen_random_uuid(),
  termo text not null,
  encontrou boolean not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.pdfs_gerados (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  quantidade_itens integer not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists aves_nome_popular_idx on public.aves using gin (to_tsvector('portuguese', nome_popular));
create index if not exists aves_slug_idx on public.aves (slug);
create index if not exists buscas_termo_idx on public.buscas (termo);

alter table public.aves enable row level security;
alter table public.buscas enable row level security;
alter table public.pdfs_gerados enable row level security;

drop policy if exists "Aves public select" on public.aves;
create policy "Aves public select"
on public.aves for select
to anon
using (true);

drop policy if exists "Aves public insert" on public.aves;
create policy "Aves public insert"
on public.aves for insert
to anon
with check (true);

drop policy if exists "Aves public update by url" on public.aves;
create policy "Aves public update by url"
on public.aves for update
to anon
using (true)
with check (true);

drop policy if exists "Buscas public insert" on public.buscas;
create policy "Buscas public insert"
on public.buscas for insert
to anon
with check (true);

drop policy if exists "Pdfs public insert" on public.pdfs_gerados;
create policy "Pdfs public insert"
on public.pdfs_gerados for insert
to anon
with check (true);
