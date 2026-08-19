import { validateWikiAvesName } from '../src/lib/wikiAvesValidation';

type ApiRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (statusCode: number) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  if (request.method && request.method !== 'GET') {
    response.status(405).json({ message: 'Metodo nao permitido.' });
    return;
  }

  const rawName = request.query.name;
  const name = Array.isArray(rawName) ? rawName[0] : rawName;

  if (!name?.trim() || name.length > 120) {
    response.status(400).json({ message: 'Informe um nome de ave valido.' });
    return;
  }

  try {
    const result = await validateWikiAvesName(name);
    response.status(200).json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'erro desconhecido';
    response.status(502).json({
      message: `Nao foi possivel confirmar a pagina no WikiAves. ${reason}`,
    });
  }
}
