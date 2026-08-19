import { formatPopularName, likelyWikiAvesUrl, normalizeSearch, wikiSlug } from './text';

export type WikiAvesValidationResult = {
  found: boolean;
  url: string;
  canonicalName?: string;
};

type WikiAvesTaxon = {
  wid?: string;
  label?: string;
  nome?: string;
  sp?: number | string;
};

export async function validateWikiAvesName(name: string): Promise<WikiAvesValidationResult> {
  const normalizedName = name.trim();
  const url = likelyWikiAvesUrl(normalizedName);

  if (!normalizedName || url === 'https://www.wikiaves.com.br/') {
    throw new Error('Informe um nome de ave valido.');
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), 10_000);

  try {
    const searchUrl = new URL('https://www.wikiaves.com.br/getTaxonsJSON.php');
    searchUrl.searchParams.set('term', normalizedName);
    const response = await fetch(searchUrl, {
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        Referer: 'https://www.wikiaves.com.br/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
      },
      redirect: 'follow',
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      throw new Error(`O WikiAves respondeu com o status ${response.status}.`);
    }

    const taxons = JSON.parse(await response.text()) as WikiAvesTaxon[];
    const match = findExactSpecies(taxons, normalizedName);

    return {
      found: Boolean(match),
      url: match?.wid ? `https://www.wikiaves.com.br/wiki/${match.wid}` : url,
      canonicalName: match?.nome ? formatPopularName(match.nome) : undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('O WikiAves demorou demais para responder.');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function findExactSpecies(taxons: WikiAvesTaxon[], name: string) {
  const requestedSlug = wikiSlug(name);
  const requestedName = normalizeSearch(name);

  return taxons.find((taxon) => {
    const isSpecies = taxon.sp === 1 || taxon.sp === '1';
    if (!isSpecies || !taxon.wid) return false;

    return (
      wikiSlug(taxon.wid) === requestedSlug ||
      Boolean(taxon.nome && wikiSlug(taxon.nome) === requestedSlug) ||
      Boolean(taxon.label && normalizeSearch(taxon.label) === requestedName)
    );
  });
}
