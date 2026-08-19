import type { WikiAvesValidationResult } from './wikiAvesValidation';

type WikiAvesApiResponse = WikiAvesValidationResult & {
  message?: string;
};

export async function checkWikiAvesBird(name: string, signal?: AbortSignal) {
  const response = await fetch(`/api/check-wikiaves?name=${encodeURIComponent(name)}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    throw new Error('A verificacao do WikiAves nao esta disponivel neste ambiente.');
  }

  const result = (await response.json()) as WikiAvesApiResponse;

  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel consultar o WikiAves agora.');
  }

  return result;
}
