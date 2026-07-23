import { createClient } from '@supabase/supabase-js';
import type { Bird } from '../types';
import { wikiSlug } from './text';

type SupabaseBirdRow = {
  id: string;
  wikiaves_id: string | null;
  nome_popular: string;
  nome_cientifico: string | null;
  familia: string | null;
  url_wikiaves: string;
  slug: string;
  fonte: string | null;
  validado: boolean | null;
  total_sons: number | null;
  total_fotos: number | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

export async function fetchSupabaseBirds(): Promise<Bird[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('aves')
    .select('id,wikiaves_id,nome_popular,nome_cientifico,familia,url_wikiaves,slug,fonte,validado,total_sons,total_fotos,criado_em,atualizado_em')
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
    familia: bird.familia ?? null,
    url_wikiaves: bird.url,
    slug: wikiSlug(bird.nomePopular),
    fonte: 'manual',
    validado: Boolean(bird.validado),
    atualizado_em: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('aves')
    .upsert(payload, { onConflict: 'url_wikiaves' })
    .select('id,wikiaves_id,nome_popular,nome_cientifico,familia,url_wikiaves,slug,fonte,validado,total_sons,total_fotos,criado_em,atualizado_em')
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
    wikiavesId: row.wikiaves_id ?? undefined,
    nomePopular: row.nome_popular,
    nomeCientifico: row.nome_cientifico ?? undefined,
    familia: row.familia ?? undefined,
    url: row.url_wikiaves,
    fonte: 'supabase',
    validado: Boolean(row.validado),
    totalSons: row.total_sons ?? undefined,
    totalFotos: row.total_fotos ?? undefined,
    criadoEm: row.criado_em ?? undefined,
    atualizadoEm: row.atualizado_em ?? undefined,
  };
}
