import { useEffect, useMemo, useRef, useState } from 'react';
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
  normalizeSearch,
  wikiAvesSearchUrl,
  wikiSlug,
} from './lib/text';
import { checkWikiAvesBird } from './lib/wikiAvesClient';
import { generateBirdPdf } from './pdf/generatePdf';
import type { Bird, PdfOptions, PrintItem, SpeechRecognitionConstructor, SpeechRecognitionEventLike } from './types';

const initialOptions: PdfOptions = {
  title: 'BRASIL AVES LIVRES',
  showScientificName: true,
  showUrl: false,
  showPageNumbers: true,
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function App() {
  const [query, setQuery] = useState('');
  const [customBirds, setCustomBirds] = useState<Bird[]>(loadCustomBirds);
  const [supabaseBirds, setSupabaseBirds] = useState<Bird[]>([]);
  const [catalogStatus, setCatalogStatus] = useState(
    isSupabaseConfigured ? 'Conectando ao Supabase...' : 'Usando base local. Configure o Supabase para compartilhar aves.',
  );
  const [items, setItems] = useState<PrintItem[]>([]);
  const [options, setOptions] = useState<PdfOptions>(initialOptions);
  const [isAddingNewBird, setIsAddingNewBird] = useState(false);
  const [addFeedback, setAddFeedback] = useState<{ query: string; text: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const [isListening, setIsListening] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const builderPanelRef = useRef<HTMLElement | null>(null);
  const addRequestRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) return;

    const timeout = window.setTimeout(() => setToastMessage(''), 2800);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => () => addRequestRef.current?.abort(), []);

  const filteredBirds = useMemo(() => {
    const term = normalizeSearch(query);
    if (!term) return [];
    const termSlug = wikiSlug(query);

    return catalog.filter((bird) => {
      const haystack = normalizeSearch(
        [bird.nomePopular, bird.nomeCientifico, bird.url, bird.tags?.join(' ')].filter(Boolean).join(' '),
      );
      const nameSlug = wikiSlug(bird.nomePopular);
      return haystack.includes(term) || Boolean(termSlug && nameSlug.includes(termSlug));
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
  const suggestedSearchUrl = wikiAvesSearchUrl(query);
  const hasQuery = Boolean(query.trim());
  const hasExactMatch = catalog.some((bird) => {
    const term = normalizeSearch(query);
    return (
      wikiSlug(bird.nomePopular) === wikiSlug(query) ||
      Boolean(bird.nomeCientifico && normalizeSearch(bird.nomeCientifico) === term)
    );
  });
  const supportsVoiceSearch = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  function handleQueryChange(value: string) {
    addRequestRef.current?.abort();
    addRequestRef.current = null;
    setIsAddingNewBird(false);
    setAddFeedback(null);
    setMessage('');
    setQuery(value);
  }

  function handleVoiceSearch() {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!Recognition) {
      setMessage('Pesquisa por voz nao esta disponivel neste navegador.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        handleQueryChange(transcript);
        setMessage(`Busca por voz: ${transcript}`);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setMessage('Nao foi possivel ouvir agora. Tente novamente ou digite o nome.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    setIsListening(true);
    recognition.start();
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
    announceAddedBird(bird.nomePopular);
  }

  function announceAddedBird(name: string) {
    setMessage(`${name} adicionada ao PDF.`);
    setToastMessage(`${name} foi para a montagem.`);
    window.setTimeout(() => {
      builderPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  async function addNewBird() {
    const requestedQuery = query.trim();
    const name = formatPopularName(requestedQuery);

    if (!name || isAddingNewBird) return;

    const controller = new AbortController();
    addRequestRef.current?.abort();
    addRequestRef.current = controller;
    setIsAddingNewBird(true);
    setAddFeedback({ query: requestedQuery, text: `Conferindo “${name}” no WikiAves...` });

    try {
      const validation = await checkWikiAvesBird(name, controller.signal);
      if (addRequestRef.current !== controller) return;

      if (!validation.found) {
        setAddFeedback({
          query: requestedQuery,
          text: `O WikiAves não encontrou uma página para “${name}”. Confira o nome e tente novamente.`,
        });
        return;
      }

      const existingBird = catalog.find(
        (bird) => normalizeSearch(bird.url) === normalizeSearch(validation.url),
      );
      const verifiedName = validation.canonicalName || name;
      let bird: Bird = existingBird ?? {
        id: `manual-${wikiSlug(verifiedName) || crypto.randomUUID()}`,
        nomePopular: verifiedName,
        url: validation.url,
        fonte: 'manual',
        validado: true,
        atualizadoEm: new Date().toISOString().slice(0, 10),
      };
      let savedOnlyOnDevice = false;

      if (!existingBird) {
        if (isSupabaseConfigured) {
          try {
            bird = await saveSupabaseBird(bird);
            setSupabaseBirds((current) => mergeBirdCatalogs(current, [bird]));
          } catch {
            savedOnlyOnDevice = true;
            setCustomBirds((current) => {
              const next = mergeBirdCatalogs(current, [bird]);
              saveCustomBirds(next);
              return next;
            });
          }
        } else {
          setCustomBirds((current) => {
            const next = mergeBirdCatalogs(current, [bird]);
            saveCustomBirds(next);
            return next;
          });
        }
      }

      if (addRequestRef.current !== controller) return;

      setItems((current) => [
        ...current,
        {
          instanceId: crypto.randomUUID(),
          birdId: bird.id,
          customBird: bird,
          copies: 1,
        },
      ]);
      setAddFeedback(null);
      announceAddedBird(bird.nomePopular);

      if (savedOnlyOnDevice) {
        setToastMessage(`${bird.nomePopular} foi adicionada e ficou salva neste dispositivo.`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      if (addRequestRef.current !== controller) return;

      setAddFeedback({
        query: requestedQuery,
        text:
          error instanceof Error
            ? error.message
            : 'Não foi possível confirmar essa página no WikiAves. Tente novamente.',
      });
    } finally {
      if (addRequestRef.current === controller) {
        addRequestRef.current = null;
        setIsAddingNewBird(false);
      }
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

  async function handleInstallApp() {
    if (!installPrompt) {
      setMessage('Use o menu do navegador para instalar este app neste dispositivo.');
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
      setMessage('App instalado neste dispositivo.');
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img className="brand-logo" src="/logoBAL.png" alt="Brasil Aves Livres" />
          <div>
            <p className="eyebrow">Gerador de QR Codes</p>
            <h1>Brasil Aves Livres</h1>
          </div>
        </div>
        <div className="topbar-side">
          <p className="catalog-status">{catalogStatus}</p>
          <div className="topbar-stats" aria-label="Resumo da montagem">
            <span>{catalog.length} aves</span>
            <span>{items.length} itens</span>
            <span>{totalCopies} qtde.</span>
            {!isInstalled ? (
              <button className="install-action" type="button" onClick={handleInstallApp}>
                Instalar app
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <section className="workspace-grid">
        <aside className="panel search-panel">
          <div className="section-heading">
            <h2>Encontre uma ave</h2>
            <p>Digite o nome. Se for uma ave nova, nós conferimos no WikiAves antes de adicionar.</p>
          </div>

          <label className="field search-field">
            <span>Nome da ave</span>
            <input
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="Ex.: curicaca, sabiá, tucano"
            />
            <button
              className={isListening ? 'voice-button listening' : 'voice-button'}
              type="button"
              onClick={handleVoiceSearch}
              disabled={!supportsVoiceSearch || isListening}
              title={supportsVoiceSearch ? 'Pesquisar usando microfone' : 'Microfone indisponivel neste navegador'}
            >
              {isListening ? 'Ouvindo...' : 'Microfone'}
            </button>
          </label>
          {message ? <p className="status-message search-status-message">{message}</p> : null}

          <div className="result-list">
            {!hasQuery ? (
              <div className="empty-state compact-empty">
                <strong>Qual ave você quer adicionar?</strong>
                <span>Comece digitando o nome popular no campo acima.</span>
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
                <button type="button" onClick={() => addBird(bird)} aria-label={`Adicionar ${bird.nomePopular}`}>
                  Adicionar
                </button>
              </article>
            ))}

            {hasQuery && !hasExactMatch ? (
              <div className="add-bird-prompt">
                <div className="add-bird-copy">
                  <span className="new-bird-label">Não está na base</span>
                  <strong>Adicionar “{suggestedName}”?</strong>
                  <span>
                    {filteredBirds.length > 0
                      ? 'Há resultados parecidos acima, mas nenhum com esse nome exato.'
                      : 'Não encontramos esse nome no catálogo.'}{' '}
                    O link será verificado automaticamente.
                  </span>
                </div>
                <button type="button" onClick={addNewBird} disabled={isAddingNewBird}>
                  {isAddingNewBird ? 'Verificando...' : 'Adicionar'}
                </button>
                {addFeedback?.query === query.trim() ? (
                  <div className={isAddingNewBird ? 'add-feedback checking' : 'add-feedback error'} role="status">
                    <span>{addFeedback.text}</span>
                    {!isAddingNewBird ? (
                      <a href={suggestedSearchUrl} target="_blank" rel="noreferrer">
                        Pesquisar no WikiAves
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>

        <section className="panel builder-panel" ref={builderPanelRef}>
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
      {toastMessage ? <div className="toast-message" role="status">{toastMessage}</div> : null}
    </main>
  );
}

export default App;
