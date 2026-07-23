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

export type SpeechRecognitionConstructor = new () => SpeechRecognition;

export type SpeechRecognitionResultLike = {
  readonly transcript: string;
};

export type SpeechRecognitionEventLike = Event & {
  readonly results: {
    readonly length: number;
    readonly [index: number]: {
      readonly [index: number]: SpeechRecognitionResultLike;
    };
  };
};

export type SpeechRecognition = EventTarget & {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
