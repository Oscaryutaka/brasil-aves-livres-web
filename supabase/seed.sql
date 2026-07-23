insert into public.aves (nome_popular, nome_cientifico, url_wikiaves, slug, fonte, validado)
values
  ('Curicaca', 'Theristicus caudatus', 'https://www.wikiaves.com.br/wiki/curicaca', 'curicaca', 'seed', true),
  ('João-de-barro', 'Furnarius rufus', 'https://www.wikiaves.com.br/wiki/joao-de-barro', 'joao-de-barro', 'seed', true),
  ('Bem-te-vi', 'Pitangus sulphuratus', 'https://www.wikiaves.com.br/wiki/bem-te-vi', 'bem-te-vi', 'seed', true),
  ('Tucano-toco', 'Ramphastos toco', 'https://www.wikiaves.com.br/wiki/tucano-toco', 'tucano-toco', 'seed', true),
  ('Arara-canindé', 'Ara ararauna', 'https://www.wikiaves.com.br/wiki/arara-caninde', 'arara-caninde', 'seed', true),
  ('Sabiá-laranjeira', 'Turdus rufiventris', 'https://www.wikiaves.com.br/wiki/sabia-laranjeira', 'sabia-laranjeira', 'seed', true)
on conflict (url_wikiaves) do update
set
  nome_popular = excluded.nome_popular,
  nome_cientifico = excluded.nome_cientifico,
  slug = excluded.slug,
  fonte = excluded.fonte,
  validado = excluded.validado,
  atualizado_em = now();
