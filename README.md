# Brasil Aves Livres Web

MVP para buscar aves, selecionar URLs do WikiAves e gerar PDFs A4 com QR Codes no navegador.
O PDF usa fundo branco e grade fixa de 4 linhas por 3 colunas.

## Rodar localmente

```bash
npm install
npm run dev
```

No PowerShell com execucao de scripts bloqueada, use:

```powershell
npm.cmd install
npm.cmd run dev
```

## Base de aves

A base inicial fica em:

```text
src/data/aves.json
```

Cada ave usa este formato:

```json
{
  "id": "curicaca",
  "nomePopular": "Curicaca",
  "nomeCientifico": "Theristicus caudatus",
  "url": "https://www.wikiaves.com.br/wiki/curicaca",
  "tags": ["campo", "cerrado"],
  "atualizadoEm": "2026-05-05"
}
```

## Supabase

O app funciona sem backend, mas pode usar Supabase como catalogo compartilhado.

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Execute o arquivo:

```text
supabase/schema.sql
```

4. Opcionalmente, carregue a base inicial executando:

```text
supabase/seed.sql
```

5. Copie `.env.example` para `.env.local`.
6. Preencha:

```text
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-public
```

No Vercel, configure as mesmas variaveis em Project Settings > Environment Variables.

## Publicacao gratuita

O projeto pode ser publicado como site estatico em Vercel, Netlify ou GitHub Pages.
O MVP nao depende de API oficial do WikiAves nem de backend.

## Proximas melhorias

- Importar CSV exportado do banco local.
- Salvar modelos de layout, caso a grade fixa deixe de ser suficiente.
- Criar editor visual de paginas.
- Permitir upload de lista temporaria pelo usuario.
- Criar uma funcao serverless opcional para consulta assistida ao WikiAves, caso os termos de uso e a estabilidade tecnica permitam.
