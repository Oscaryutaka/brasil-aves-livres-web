import { useEffect, useMemo, useState } from 'react';
import { birdCatalog } from './data/birds';
import { mergeBirdCatalogs } from './lib/birds';
import { loadCustomBirds, saveCustomBirds } from './lib/localBirds';
import {
  fetchSupabaseBirds,
  isSupabaseConfigured,
  recordSupabasePdf,
  recordSupabaseSearch,
  saveSupabaseBird,
} from './lib/supabaseBirds';
import {
  formatPopularName,
  likelyWikiAvesUrl,
  normalizeSearch,
  wikiSlug,
} from './lib/text';
import { generateBirdPdf } from './pdf/generatePdf';
import type { Bird, PdfOptions, PrintItem } from './types';

const initialOptions: PdfOptions = {
  title: 'BRASIL AVES LIVRES',
  showScientificName: true,
  showUrl: false,
  showPageNumbers: true,
};

function App() {
  const [query, setQuery] = useState('');
  const [customBirds, setCustomBirds] = useState<Bird[]>(loadCustomBirds);
  const [supabaseBirds, setSupabaseBirds] = useState<Bird[]>([]);
  const [catalogStatus, setCatalogStatus] = useState(
    isSupabaseConfigured ? 'Conectando ao Supabase...' : 'Usando base local. Configure o Supabase para compartilhar aves.',
  );
  const [items, setItems] = useState<PrintItem[]>([]);
  const [options, setOptions] = useState<PdfOptions>(initialOptions);
  const [manualName, setManualName] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [wikiSearchValidatedFor, setWikiSearchValidatedFor] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');

  const catalog = useMemo(
    () => mergeBirdCatalogs(birdCatalog, customBirds, supabaseBirds),
    [customBirds, supabaseBirds],
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;

    fetchSupabaseBirds()
      .then((birds) => {
        if (!isMounted) return;
        setSupabaseBirds(birds);
        setCatalogStatus(`Supabase conectado: ${birds.length} aves compartilhadas.`);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        const reason = error instanceof Error ? error.message : 'erro desconhecido';
        setCatalogStatus(`Supabase indisponivel; usando fallback local. ${reason}`);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredBirds = useMemo(() => {
    const term = normalizeSearch(query);
    if (!term) return [];

    return catalog.filter((bird) => {
      const haystack = normalizeSearch(
        [bird.nomePopular, bird.nomeCientifico, bird.url, bird.tags?.join(' ')].filter(Boolean).join(' '),
      );
      return haystack.includes(term);
    });
  }, [catalog, query]);

  useEffect(() => {
    if (!isSupabaseConfigured || !query.trim()) return;

    const timeout = window.setTimeout(() => {
      recordSupabaseSearch(query, filteredBirds.length > 0).catch(() => {
        // Search analytics should never interrupt the PDF workflow.
      });
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [filteredBirds.length, query]);

  const selectedBirds = useMemo(() => {
    const byId = new Map(catalog.map((bird) => [bird.id, bird]));
    return items
      .map((item) => ({ item, bird: item.customBird ?? byId.get(item.birdId) }))
      .filter((entry): entry is { item: PrintItem; bird: Bird } => Boolean(entry.bird));
  }, [catalog, items]);

  const totalCopies = selectedBirds.reduce((total, entry) => total + entry.item.copies, 0);
  const previewCells = selectedBirds
    .flatMap(({ item, bird }) => Array.from({ length: Math.max(0, item.copies) }, () => bird.nomePopular))
    .slice(0, 12);
  const suggestedName = formatPopularName(query);
  const suggestedUrl = likelyWikiAvesUrl(query);
  const canAddManualBird = Boolean(manualName.trim() && manualUrl.trim() && wikiSearchValidatedFor === manualUrl.trim());
  const hasQuery = Boolean(query.trim());

  function handleQueryChange(value: string) {
    setQuery(value);
    const nextName = formatPopularName(value);
    const nextUrl = likelyWikiAvesUrl(value);
    setManualName(nextName);
    setManualUrl(nextUrl);
    setWikiSearchValidatedFor('');
  }

  function addBird(bird: Bird) {
    setItems((current) => [
      ...current,
      {
        instanceId: crypto.randomUUID(),
        birdId: bird.id,
        customBird: bird,
        copies: 1,
      },
    ]);
    setMessage(`${bird.nomePopular} adicionada ao PDF.`);
  }

  async function addManualBird() {
    const name = manualName.trim() || query.trim();
    const url = manualUrl.trim();

    if (!name || !url) {
      setMessage('Informe o nome da ave e a URL do WikiAves.');
      return;
    }

    if (wikiSearchValidatedFor !== url) {
      setMessage('Clique em Buscar no WikiAves e confira se o link existe antes de adicionar.');
      return;
    }

    const existingBird = catalog.find((bird) => normalizeSearch(bird.url) === normalizeSearch(url));
    let bird: Bird = existingBird ?? {
      id: `manual-${wikiSlug(name) || crypto.randomUUID()}`,
      nomePopular: name,
      url,
      fonte: 'manual',
      validado: true,
      atualizadoEm: new Date().toISOString().slice(0, 10),
    };

    if (!existingBird) {
      if (isSupabaseConfigured) {
        try {
          bird = await saveSupabaseBird(bird);
          setSupabaseBirds((current) => mergeBirdCatalogs(current, [bird]));
          setMessage(`${bird.nomePopular} adicionada ao PDF e salva no Supabase.`);
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'erro desconhecido';
          setCustomBirds((current) => {
            const next = mergeBirdCatalogs(current, [bird]);
            saveCustomBirds(next);
            return next;
          });
          setMessage(`${bird.nomePopular} salva localmente; Supabase falhou: ${reason}`);
        }
      } else {
        setCustomBirds((current) => {
          const next = mergeBirdCatalogs(current, [bird]);
          saveCustomBirds(next);
          return next;
        });
        setMessage(`${bird.nomePopular} adicionada ao PDF e salva na base JSON local.`);
      }
    }

    setItems((current) => [
      ...current,
      {
        instanceId: crypto.randomUUID(),
        birdId: bird.id,
        customBird: bird,
        copies: 1,
      },
    ]);
    setManualName('');
    setManualUrl('');
    if (existingBird) {
      setMessage(`${bird.nomePopular} ja estava na base e foi adicionada ao PDF.`);
    }
  }

  function removeItem(instanceId: string) {
    setItems((current) => current.filter((item) => item.instanceId !== instanceId));
  }

  function updateCopies(instanceId: string, rawValue: string) {
    const sanitized = rawValue.replace(/\D/g, '');
    const copies = sanitized ? Number(sanitized) : 0;

    setItems((current) =>
      current.map((item) => (item.instanceId === instanceId ? { ...item, copies } : item)),
    );
  }

  function normalizeCopies(instanceId: string) {
    setItems((current) =>
      current.map((item) => (item.instanceId === instanceId ? { ...item, copies: Math.max(1, item.copies) } : item)),
    );
  }

  async function handleGeneratePdf() {
    try {
      setIsGenerating(true);
      setMessage('');
      await generateBirdPdf(catalog, items, options);
      recordSupabasePdf(options.title, totalCopies).catch(() => {
        // PDF analytics are best-effort only.
      });
      setMessage('PDF gerado no navegador.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel gerar o PDF.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Gerador de QR Codes</p>
          <h1>Brasil Aves Livres</h1>
          <p className="catalog-status">{catalogStatus}</p>
        </div>
        <div className="topbar-stats" aria-label="Resumo da montagem">
          <span>{catalog.length} aves</span>
          <span>{items.length} itens</span>
          <span>{totalCopies} qtde.</span>
        </div>
      </header>

      <section className="workspace-grid">
        <aside className="panel search-panel">
          <div className="section-heading">
            <h2>Buscar ave</h2>
            <p>Busque no catálogo compartilhado ou adicione uma URL validada do WikiAves.</p>
          </div>

          <label className="field">
            <span>Nome</span>
            <input
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="Ex.: curicaca, sabiá, tucano"
            />
          </label>
          {message ? <p className="status-message search-status-message">{message}</p> : null}

          <div className="result-list">
            {!hasQuery ? (
              <div className="empty-state compact-empty">
                <strong>Digite para buscar.</strong>
                <span>Resultados e cadastro manual aparecem depois do primeiro termo.</span>
              </div>
            ) : null}

            {filteredBirds.map((bird) => (
              <article className="bird-row" key={bird.id}>
                <div>
                  <div className="bird-row-title">
                    <strong>{bird.nomePopular}</strong>
                    <span className={bird.validado ? 'status-pill valid' : 'status-pill pending'}>
                      {bird.validado ? 'validada' : 'pendente'}
                    </span>
                  </div>
                  <div className="bird-meta">
                    {bird.familia ? <span>{bird.familia}</span> : null}
                    {bird.totalFotos !== undefined ? <span>{bird.totalFotos} fotos</span> : null}
                    {bird.totalSons !== undefined ? <span>{bird.totalSons} sons</span> : null}
                  </div>
                  {bird.nomeCientifico ? <em>{bird.nomeCientifico}</em> : null}
                  <small>{bird.url}</small>
                </div>
                <button type="button" onClick={() => addBird(bird)}>
                  +
                </button>
              </article>
            ))}

            {hasQuery ? <div className="wiki-fallback">
              <strong>{filteredBirds.length === 0 ? 'Nenhuma ave encontrada.' : 'Nao encontrou a ave exata?'}</strong>
              <span>
                Abra a pagina provavel no WikiAves, confira a URL e adicione como item novo. Isso permite cadastrar
                "tucano" mesmo que exista "tucano-toco" na base local.
              </span>
              <a
                href={manualUrl || suggestedUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => setWikiSearchValidatedFor((manualUrl || suggestedUrl).trim())}
              >
                Buscar no WikiAves
              </a>
              <label className="field compact-field">
                <span>Nome da ave</span>
                <input
                  value={manualName}
                  onChange={(event) => {
                    setManualName(event.target.value);
                    setWikiSearchValidatedFor('');
                  }}
                  placeholder={suggestedName || 'Nome popular'}
                />
              </label>
              <label className="field compact-field">
                <span>URL do WikiAves</span>
                <input
                  value={manualUrl}
                  onChange={(event) => {
                    setManualUrl(event.target.value);
                    setWikiSearchValidatedFor('');
                  }}
                  placeholder={suggestedUrl}
                />
              </label>
              <button type="button" onClick={addManualBird} disabled={!canAddManualBird}>
                Adicionar como nova ave
              </button>
            </div> : null}
          </div>
        </aside>

        <section className="panel builder-panel">
          <div className="section-heading">
            <h2>Montagem do PDF</h2>
            <p>Ordene, repita e misture aves antes de exportar.</p>
          </div>

          <div className="selected-list">
            {selectedBirds.length === 0 ? (
              <div className="empty-state">
                <strong>Nenhuma ave selecionada.</strong>
                <span>Adicione aves pela busca para começar a compor o PDF.</span>
              </div>
            ) : (
              selectedBirds.map(({ item, bird }, index) => (
                <article className="selected-row" key={item.instanceId}>
                  <div className="selected-index">{index + 1}</div>
                  <div className="selected-copy">
                    <strong>{bird.nomePopular}</strong>
                    {bird.nomeCientifico ? <em>{bird.nomeCientifico}</em> : null}
                    <small>{bird.url}</small>
                  </div>
                  <label className="copies-control">
                    <span>Qtde.</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={item.copies || ''}
                      onBlur={() => normalizeCopies(item.instanceId)}
                      onChange={(event) => updateCopies(item.instanceId, event.target.value)}
                    />
                  </label>
                  <div className="row-actions">
                    <button type="button" onClick={() => removeItem(item.instanceId)} aria-label="Remover">
                      ×
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="panel options-panel">
          <div className="section-heading">
            <h2>PDF</h2>
            <p>A4 fixo com 4 linhas e 3 colunas.</p>
          </div>

          <label className="field">
            <span>Titulo</span>
            <input
              value={options.title}
              onChange={(event) => setOptions((current) => ({ ...current, title: event.target.value }))}
            />
          </label>

          <div className="fixed-layout-note">
            <strong>12 etiquetas por pagina</strong>
            <span>Quantidade e ordem sao controladas pela lista de montagem.</span>
          </div>

          <div className="sheet-preview" aria-label="Previa da primeira pagina do PDF">
            {Array.from({ length: 12 }).map((_, index) => (
              <div className={previewCells[index] ? 'sheet-cell filled' : 'sheet-cell'} key={index}>
                <span>{previewCells[index] ?? index + 1}</span>
              </div>
            ))}
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={options.showScientificName}
              onChange={(event) =>
                setOptions((current) => ({ ...current, showScientificName: event.target.checked }))
              }
            />
            <span>Mostrar nome cientifico</span>
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={options.showUrl}
              onChange={(event) => setOptions((current) => ({ ...current, showUrl: event.target.checked }))}
            />
            <span>Mostrar URL abaixo do nome</span>
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={options.showPageNumbers}
              onChange={(event) =>
                setOptions((current) => ({ ...current, showPageNumbers: event.target.checked }))
              }
            />
            <span>Mostrar paginacao</span>
          </label>

          <button className="primary-action" type="button" onClick={handleGeneratePdf} disabled={isGenerating}>
            {isGenerating ? 'Gerando...' : 'Gerar PDF'}
          </button>

        </aside>
      </section>
    </main>
  );
}

export default App;
