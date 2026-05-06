export type Bird = {
  id: string;
  nomePopular: string;
  nomeCientifico?: string;
  url: string;
  tags?: string[];
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
