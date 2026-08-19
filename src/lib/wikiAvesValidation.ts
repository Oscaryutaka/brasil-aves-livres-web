import { likelyWikiAvesUrl } from './text';

export type WikiAvesValidationResult = {
  found: boolean;
  url: string;
};

const NOT_FOUND_HEADINGS = [
  'esse topico ainda nao existe',
  'este topico ainda nao existe',
  'pagina nao encontrada',
  'pagina nao foi encontrada',
  'nao encontrado',
  'nao foi encontrado',
];

export async function validateWikiAvesName(name: string): Promise<WikiAvesValidationResult> {
  const normalizedName = name.trim();
  const url = likelyWikiAvesUrl(normalizedName);

  if (!normalizedName || url === 'https://www.wikiaves.com.br/') {
    throw new Error('Informe um nome de ave valido.');
  }

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

    if (response.status === 404) {
      return { found: false, url };
    }

    if (!response.ok) {
      throw new Error(`O WikiAves respondeu com o status ${response.status}.`);
    }

    const html = await response.text();
    const found = isExistingWikiAvesPage(html);

    return {
      found,
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

export function isExistingWikiAvesPage(html: string) {
  if (/\bnotFound\b/i.test(html)) return false;

  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) =>
    normalizeHtmlText(match[1]),
  );

  if (headings.some((heading) => NOT_FOUND_HEADINGS.some((phrase) => heading.includes(phrase)))) {
    return false;
  }

  return /id=["']dokuwiki__content["']/i.test(html) && headings.length > 0;
}

function normalizeHtmlText(value: string) {
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

function isWikiAvesPageUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.hostname === 'www.wikiaves.com.br' && parsed.pathname.startsWith('/wiki/');
  } catch {
    return false;
  }
}
