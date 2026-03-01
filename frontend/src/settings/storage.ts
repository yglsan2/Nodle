/**
 * Persistance des réglages Nodle (localStorage). Lecture/écriture sécurisées.
 */

import type { NodleSettings } from './types';
import { DEFAULT_SETTINGS } from './types';

const KEY = 'nodle-settings';
const MAX_SIZE = 4096;

function safeParse<T>(raw: string, fallback: T): T {
  try {
    const v = JSON.parse(raw) as T;
    return v != null && typeof v === 'object' ? v : fallback;
  } catch {
    return fallback;
  }
}

function deepMerge<T extends object>(base: T, partial: Partial<T>): T {
  const out = { ...base };
  for (const k of Object.keys(partial) as (keyof T)[]) {
    const v = partial[k];
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      (out as Record<string, unknown>)[k as string] = deepMerge(
        (base as Record<string, unknown>)[k as string] as object,
        v as Record<string, unknown>
      );
    } else if (v !== undefined) {
      (out as Record<string, unknown>)[k as string] = v;
    }
  }
  return out;
}

export function loadSettings(): NodleSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw || raw.length > MAX_SIZE) return DEFAULT_SETTINGS;
    const parsed = safeParse<Partial<NodleSettings>>(raw, {});
    return deepMerge(DEFAULT_SETTINGS, parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: NodleSettings): void {
  try {
    const s = JSON.stringify(settings);
    if (s.length > MAX_SIZE) return;
    localStorage.setItem(KEY, s);
  } catch {
    // quota or disabled
  }
}
