import type { Bird } from '../types';
import { normalizeSearch } from './text';

export function mergeBirdCatalogs(...catalogs: Bird[][]) {
  const byUrl = new Map<string, Bird>();

  for (const catalog of catalogs) {
    for (const bird of catalog) {
      const key = normalizeSearch(bird.url);
      if (!key) continue;
      byUrl.set(key, { ...byUrl.get(key), ...bird });
    }
  }

  return [...byUrl.values()].sort((first, second) =>
    first.nomePopular.localeCompare(second.nomePopular, 'pt-BR'),
  );
}
