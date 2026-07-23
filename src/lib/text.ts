export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function wikiSlug(value: string) {
  return normalizeSearch(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function likelyWikiAvesUrl(value: string) {
  const slug = wikiSlug(value);
  return slug ? `https://www.wikiaves.com.br/wiki/${slug}` : 'https://www.wikiaves.com.br/';
}

export function formatPopularName(value: string) {
  const normalized = value.trim().replace(/\s+/g, '-').toLocaleLowerCase('pt-BR');
  if (!normalized) return '';
  return normalized.charAt(0).toLocaleUpperCase('pt-BR') + normalized.slice(1);
}
