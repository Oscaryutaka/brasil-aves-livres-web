import { validateWikiAvesName } from '../src/lib/wikiAvesValidation';

const RESPONSE_HEADERS = {
  'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
  'Content-Type': 'application/json; charset=utf-8',
};

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') {
      return Response.json(
        { message: 'Metodo nao permitido.' },
        { status: 405, headers: RESPONSE_HEADERS },
      );
    }

    const name = new URL(request.url).searchParams.get('name')?.trim();

    if (!name || name.length > 120) {
      return Response.json(
        { message: 'Informe um nome de ave valido.' },
        { status: 400, headers: RESPONSE_HEADERS },
      );
    }

    try {
      const result = await validateWikiAvesName(name);
      return Response.json(result, { status: 200, headers: RESPONSE_HEADERS });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'erro desconhecido';
      return Response.json(
        { message: `Nao foi possivel confirmar a pagina no WikiAves. ${reason}` },
        { status: 502, headers: RESPONSE_HEADERS },
      );
    }
  },
};
