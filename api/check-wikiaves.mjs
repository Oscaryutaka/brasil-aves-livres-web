const RESPONSE_HEADERS = {
  'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
  'Content-Type': 'application/json; charset=utf-8',
};

const NOT_FOUND_HEADINGS = [
  'esse topico ainda nao existe',
  'este topico ainda nao existe',
  'pagina nao encontrada',
  'pagina nao foi encontrada',
  'nao encontrado',
  'nao foi encontrado',
];

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
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
      },
      redirect: 'follow',
      signal: timeoutController.signal,
    });

    if (response.status === 404) return { found: false, url };
    if (!response.ok) throw new Error(`O WikiAves respondeu com o status ${response.status}.`);

    const html = await response.text();
    return {
      found: isExistingWikiAvesPage(html),
      url: isWikiAvesPageUrl(response.url) ? response.url : url,
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
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `https://www.wikiaves.com.br/wiki/${slug}`;
}

function isExistingWikiAvesPage(html) {
  if (/\bnotFound\b/i.test(html)) return false;

  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) =>
    normalizeHtmlText(match[1]),
  );

  if (headings.some((heading) => NOT_FOUND_HEADINGS.some((phrase) => heading.includes(phrase)))) {
    return false;
  }

  return /id=["']dokuwiki__content["']/i.test(html) && headings.length > 0;
}

function normalizeHtmlText(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isWikiAvesPageUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.hostname === 'www.wikiaves.com.br' && parsed.pathname.startsWith('/wiki/');
  } catch {
    return false;
  }
}
