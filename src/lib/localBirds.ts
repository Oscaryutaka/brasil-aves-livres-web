import type { Bird } from '../types';

const customBirdsStorageKey = 'brasil-aves-livres.customBirds';

export function loadCustomBirds(): Bird[] {
  try {
    const stored = localStorage.getItem(customBirdsStorageKey);
    return stored ? (JSON.parse(stored) as Bird[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomBirds(birds: Bird[]) {
  localStorage.setItem(customBirdsStorageKey, JSON.stringify(birds, null, 2));
}
