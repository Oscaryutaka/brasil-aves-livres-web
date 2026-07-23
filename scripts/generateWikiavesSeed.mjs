import fs from 'node:fs/promises';

const sourceUrl = 'https://www.wikiaves.com.br/especies.php?t=t';
const outputPath = new URL('../supabase/wikiaves_all_species_insert.sql', import.meta.url);

const response = await fetch(sourceUrl, {
  headers: {
    'user-agent': 'BrasilAvesLivres/0.1 seed generator',
  },
});

if (!response.ok) {
  throw new Error(`WikiAves request failed: ${response.status} ${response.statusText}`);
}

const html = await response.text();
const calls = [...html.matchAll(/lsp\(([^;\n]+)\);/g)]
  .map((match) => match[1])
  .filter((call) => call.includes("'"));

const rows = calls.map(parseLspCall).filter(Boolean);

if (rows.length === 0) {
  throw new Error('No species rows were found in the WikiAves page.');
}

function sql(value) {
  if (value === undefined || value === null || value === '') return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseLspCall(call) {
  const args = [];
  let current = '';
  let inString = false;
  let escaped = false;

  for (const char of call) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === "'") {
      inString = !inString;
      continue;
    }

    if (char === ',' && !inString) {
      args.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current) args.push(current.trim());
  if (args.length !== 7) return null;

  return {
    wikiavesId: args[0],
    familia: args[1],
    cientifico: args[2],
    popular: args[3],
    slug: args[4],
    sons: Number(args[5]),
    fotos: Number(args[6]),
  };
}

const values = rows
  .map((row) => {
    const url = `https://www.wikiaves.com.br/wiki/${row.slug}`;
    return `  (${sql(row.wikiavesId)}, ${sql(row.familia)}, ${sql(row.popular)}, ${sql(row.cientifico)}, ${sql(url)}, ${sql(row.slug)}, 'wikiaves', true, ${row.sons}, ${row.fotos})`;
  })
  .join(',\n');

const generatedAt = new Date().toISOString();
const sqlText = `-- Generated from ${sourceUrl}
-- Generated at ${generatedAt}
-- Rows: ${rows.length}

alter table public.aves add column if not exists wikiaves_id text;
alter table public.aves add column if not exists familia text;
alter table public.aves add column if not exists total_sons integer not null default 0;
alter table public.aves add column if not exists total_fotos integer not null default 0;

create unique index if not exists aves_wikiaves_id_idx
on public.aves (wikiaves_id)
where wikiaves_id is not null;

insert into public.aves (
  wikiaves_id,
  familia,
  nome_popular,
  nome_cientifico,
  url_wikiaves,
  slug,
  fonte,
  validado,
  total_sons,
  total_fotos
)
values
${values}
on conflict (url_wikiaves) do update
set
  wikiaves_id = excluded.wikiaves_id,
  familia = excluded.familia,
  nome_popular = excluded.nome_popular,
  nome_cientifico = excluded.nome_cientifico,
  slug = excluded.slug,
  fonte = excluded.fonte,
  validado = excluded.validado,
  total_sons = excluded.total_sons,
  total_fotos = excluded.total_fotos,
  atualizado_em = now();
`;

await fs.writeFile(outputPath, sqlText, 'utf8');
console.log(`Wrote ${rows.length} rows to ${outputPath.pathname}`);
