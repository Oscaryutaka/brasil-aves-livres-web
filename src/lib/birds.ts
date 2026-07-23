import type { Bird } from '../types';
import { normalizeSearch } from './text';

export function mergeBirdCatalogs(...catalogs: Bird[][]) {
  const byUrl = new Map<string, Bird>();

  for (const catalog of catalogs) {
    for (const bird of catalog) {
      const key = normalizeSearch(bird.url);
      if (!key) continue;
      byUrl.set(key, mergeBird(byUrl.get(key), bird));
    }
  }

  return [...byUrl.values()].sort((first, second) =>
    first.nomePopular.localeCompare(second.nomePopular, 'pt-BR'),
  );
}

function mergeBird(existing: Bird | undefined, incoming: Bird): Bird {
  if (!existing) return incoming;

  return {
    ...existing,
    ...definedFields(incoming),
    id: preferredId(existing, incoming),
    nomePopular: incoming.nomePopular || existing.nomePopular,
    url: incoming.url || existing.url,
    tags: mergeTags(existing.tags, incoming.tags),
    validado: Boolean(existing.validado || incoming.validado),
  };
}

function definedFields(bird: Bird): Partial<Bird> {
  return Object.fromEntries(
    Object.entries(bird).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      return true;
    }),
  ) as Partial<Bird>;
}

function preferredId(existing: Bird, incoming: Bird) {
  if (incoming.fonte === 'supabase') return incoming.id;
  if (existing.fonte === 'supabase') return existing.id;
  return incoming.id || existing.id;
}

function mergeTags(first: string[] | undefined, second: string[] | undefined) {
  const tags = [...(first ?? []), ...(second ?? [])];
  return tags.length ? [...new Set(tags)] : undefined;
}
