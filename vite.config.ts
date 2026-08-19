import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { validateWikiAvesName } from './src/lib/wikiAvesValidation';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'wikiaves-check-api',
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (!request.url?.startsWith('/api/check-wikiaves')) {
            next();
            return;
          }

          response.setHeader('Content-Type', 'application/json; charset=utf-8');

          try {
            const requestUrl = new URL(request.url, 'http://localhost');
            const name = requestUrl.searchParams.get('name')?.trim();

            if (!name || name.length > 120) {
              response.statusCode = 400;
              response.end(JSON.stringify({ message: 'Informe um nome de ave valido.' }));
              return;
            }

            const result = await validateWikiAvesName(name);
            response.statusCode = 200;
            response.end(JSON.stringify(result));
          } catch (error) {
            const reason = error instanceof Error ? error.message : 'erro desconhecido';
            response.statusCode = 502;
            response.end(
              JSON.stringify({ message: `Nao foi possivel confirmar a pagina no WikiAves. ${reason}` }),
            );
          }
        });
      },
    },
  ],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
});
