import { createClient } from '@supabase/supabase-js';
import type { Bird } from '../types';
import { wikiSlug } from './text';

type SupabaseBirdRow = {
  id: string;
  nome_popular: string;
  nome_cientifico: string | null;
  url_wikiaves: string;
  slug: string;
  fonte: string | null;
  validado: boolean | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

export async function fetchSupabaseBirds(): Promise<Bird[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('aves')
    .select('id,nome_popular,nome_cientifico,url_wikiaves,slug,fonte,validado,criado_em,atualizado_em')
    .order('nome_popular', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(rowToBird);
}

export async function saveSupabaseBird(bird: Bird): Promise<Bird> {
  if (!supabase) {
    throw new Error('Supabase nao configurado.');
  }

  const payload = {
    nome_popular: bird.nomePopular,
    nome_cientifico: bird.nomeCientifico ?? null,
    url_wikiaves: bird.url,
    slug: wikiSlug(bird.nomePopular),
    fonte: 'manual',
    validado: Boolean(bird.validado),
    atualizado_em: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('aves')
    .upsert(payload, { onConflict: 'url_wikiaves' })
    .select('id,nome_popular,nome_cientifico,url_wikiaves,slug,fonte,validado,criado_em,atualizado_em')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return rowToBird(data);
}

export async function recordSupabaseSearch(term: string, found: boolean) {
  if (!supabase || !term.trim()) return;

  await supabase.from('buscas').insert({
    termo: term.trim(),
    encontrou: found,
  });
}

export async function recordSupabasePdf(title: string, itemCount: number) {
  if (!supabase) return;

  await supabase.from('pdfs_gerados').insert({
    titulo: title,
    quantidade_itens: itemCount,
  });
}

function rowToBird(row: SupabaseBirdRow): Bird {
  return {
    id: row.id,
    nomePopular: row.nome_popular,
    nomeCientifico: row.nome_cientifico ?? undefined,
    url: row.url_wikiaves,
    fonte: 'supabase',
    validado: Boolean(row.validado),
    criadoEm: row.criado_em ?? undefined,
    atualizadoEm: row.atualizado_em ?? undefined,
  };
}
