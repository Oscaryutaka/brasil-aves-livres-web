const RESPONSE_HEADERS = {
  'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
  'Content-Type': 'application/json; charset=utf-8',
};

export default {
  async fetch(request) {
    if (request.method !== 'GET') {
      return Response.json(
        { message: 'Metodo nao permitido.' },
        { status: 405, headers: RESPONSE_HEADERS },
      );
    }

    const name = new URL(request.url).searchParams.get('name')?.trim();

    if (!name || name.length > 120) {
      return Response.json(
        { message: 'Informe um nome de ave valido.' },
        { status: 400, headers: RESPONSE_HEADERS },
      );
    }

    try {
      const result = await validateWikiAvesName(name);
      return Response.json(result, { status: 200, headers: RESPONSE_HEADERS });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'erro desconhecido';
      return Response.json(
        { message: `Nao foi possivel confirmar a pagina no WikiAves. ${reason}` },
        { status: 502, headers: RESPONSE_HEADERS },
      );
    }
  },
};

async function validateWikiAvesName(name) {
  const url = likelyWikiAvesUrl(name);
  if (url.endsWith('/wiki/')) throw new Error('Informe um nome de ave valido.');
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), 10_000);

  try {
    const searchUrl = new URL('https://www.wikiaves.com.br/getTaxonsJSON.php');
    searchUrl.searchParams.set('term', name);
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

    if (!response.ok) throw new Error(`O WikiAves respondeu com o status ${response.status}.`);

    const taxons = JSON.parse(await response.text());
    const match = findExactSpecies(taxons, name);
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

function likelyWikiAvesUrl(value) {
  return `https://www.wikiaves.com.br/wiki/${wikiSlug(value)}`;
}

function wikiSlug(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeSearch(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatPopularName(value) {
  const normalized = value.trim().replace(/\s+/g, '-').toLocaleLowerCase('pt-BR');
  return normalized.charAt(0).toLocaleUpperCase('pt-BR') + normalized.slice(1);
}

function findExactSpecies(taxons, name) {
  if (!Array.isArray(taxons)) return undefined;
  const requestedSlug = wikiSlug(name);
  const requestedName = normalizeSearch(name);

  return taxons.find((taxon) => {
    const isSpecies = taxon?.sp === 1 || taxon?.sp === '1';
    if (!isSpecies || !taxon.wid) return false;

    return (
      wikiSlug(taxon.wid) === requestedSlug ||
      (taxon.nome && wikiSlug(taxon.nome) === requestedSlug) ||
      (taxon.label && normalizeSearch(taxon.label) === requestedName)
    );
  });
}
