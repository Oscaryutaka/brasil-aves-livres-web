import type { WikiAvesValidationResult } from './wikiAvesValidation';
import { formatPopularName, normalizeSearch, wikiSlug } from './text';

type WikiAvesApiResponse = WikiAvesValidationResult & {
  message?: string;
};

type WikiAvesSpeciesLookup = {
  n: string;
  s: string;
  w: string;
};

let bundledSpecies: WikiAvesSpeciesLookup[] | null = null;

export async function checkWikiAvesBird(name: string, signal?: AbortSignal) {
  let apiError: Error | null = null;

  try {
    const response = await fetch(`/api/check-wikiaves?name=${encodeURIComponent(name)}`, {
      headers: { Accept: 'application/json' },
      signal,
    });
    const contentType = response.headers.get('content-type') ?? '';
    const result = contentType.includes('application/json')
      ? ((await response.json()) as WikiAvesApiResponse)
      : null;

    if (response.ok && result) return result;

    apiError = new Error(
      result?.message || 'A verificacao online do WikiAves nao esta disponivel neste ambiente.',
    );

    if (response.status < 500) throw apiError;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    apiError = error instanceof Error ? error : new Error('Nao foi possivel consultar o WikiAves agora.');
  }

  try {
    return await checkBundledWikiAvesCatalog(name, signal);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw apiError || error;
  }
}

async function checkBundledWikiAvesCatalog(
  name: string,
  signal?: AbortSignal,
): Promise<WikiAvesValidationResult> {
  if (!bundledSpecies) {
    const response = await fetch('/wikiaves-species.json', { signal });
    if (!response.ok) throw new Error('A lista local do WikiAves nao esta disponivel.');
    bundledSpecies = (await response.json()) as WikiAvesSpeciesLookup[];
  }

  const requestedSlug = wikiSlug(name);
  const requestedName = normalizeSearch(name);
  const match = bundledSpecies.find(
    (species) =>
      wikiSlug(species.w) === requestedSlug ||
      wikiSlug(species.n) === requestedSlug ||
      normalizeSearch(species.s) === requestedName,
  );

  return {
    found: Boolean(match),
    url: `https://www.wikiaves.com.br/wiki/${match?.w || requestedSlug}`,
    canonicalName: match ? formatPopularName(match.n) : undefined,
  };
}
