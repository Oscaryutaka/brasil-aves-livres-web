import fs from 'node:fs/promises';

const sourcePath = new URL('../supabase/wikiaves_all_species_insert.sql', import.meta.url);
const outputPath = new URL('../public/wikiaves-species.json', import.meta.url);
const sql = await fs.readFile(sourcePath, 'utf8');
const rowPattern = /^\s*\('((?:''|[^'])*)',\s*(?:null|'(?:''|[^'])*'),\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)',\s*'https:\/\/www\.wikiaves\.com\.br\/wiki\/((?:''|[^'])*)',\s*'((?:''|[^'])*)',/gm;
const species = [];

for (const match of sql.matchAll(rowPattern)) {
  species.push({
    n: unescapeSql(match[2]),
    s: unescapeSql(match[3]),
    w: unescapeSql(match[5] || match[4]),
  });
}

if (species.length < 1_900) {
  throw new Error(`Expected the complete WikiAves catalog, but found only ${species.length} species.`);
}

await fs.writeFile(outputPath, JSON.stringify(species), 'utf8');
console.log(`Wrote ${species.length} species to ${outputPath.pathname}`);

function unescapeSql(value) {
  return value.replaceAll("''", "'");
}
