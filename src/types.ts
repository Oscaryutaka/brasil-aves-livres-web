export type Bird = {
  id: string;
  wikiavesId?: string;
  nomePopular: string;
  nomeCientifico?: string;
  familia?: string;
  url: string;
  tags?: string[];
  fonte?: 'seed' | 'manual' | 'supabase';
  validado?: boolean;
  totalSons?: number;
  totalFotos?: number;
  criadoEm?: string;
  atualizadoEm?: string;
};

export type PrintItem = {
  instanceId: string;
  birdId: string;
  copies: number;
  customBird?: Bird;
};

export type PdfOptions = {
  title: string;
  showScientificName: boolean;
  showUrl: boolean;
  showPageNumbers: boolean;
};
