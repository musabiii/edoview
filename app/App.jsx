import { useEffect, useMemo, useState } from 'preact/hooks';

import { Basis, DocHeader, FileInfo, Items, Marking, Signers } from './editor/Sections.jsx';
import { Party } from './editor/Party.jsx';
import { Loader } from './Loader.jsx';
import { Preview, Source } from './Preview.jsx';
import { track } from './lib/analytics.js';
import { analyzeMarking, markingSummary, rowsFromDom } from './lib/marking.js';
import { attr, defaultForm, partyName, parts as getParts } from './lib/upd.js';
import { checkUpd, declaredEncoding, decodeXml, download, encodeXml, parseXml, serializeXml } from './lib/xml.js';
import { Doc, GithubLink, Segmented } from './ui.jsx';

/** Текст XML → открытый документ. Бросает понятную ошибку, если это не УПД. */
function open(text, fileName) {
  const doc = parseXml(text);
  const problem = checkUpd(doc);
  if (problem) throw new Error(problem);
  const encoding = declaredEncoding(text);
  return { doc, encoding, fileName, original: serializeXml(doc, encoding) };
}

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function App() {
  const [file, setFile] = useState(null);
  const [rev, setRev] = useState(0);
  const [error, setError] = useState(null);
  const [form, setForm] = useState('upd');
  const [tab, setTab] = useState('preview');

  const xml = useMemo(() => (file ? serializeXml(file.doc, file.encoding) : ''), [file, rev]);
  const previewXml = useDebounced(xml, 300);
  const dirty = !!file && xml !== file.original;

  /** @param {'file'|'drop'|'paste'|'sample'|'reset'} [source] — для аналитики */
  function load(text, fileName, source) {
    try {
      const f = open(text, fileName);
      setFile(f);
      setForm(defaultForm(f.doc));
      setError(null);
      setRev((r) => r + 1);
      if (source && source !== 'reset') {
        const p = getParts(f.doc);
        track('open', { source, function: attr(p.doc, 'Функция') || '—', marking: !!p.table && analyzeMarking(rowsFromDom(p.table)).any });
      }
    } catch (e) {
      setError(e.message);
      if (source) track('open-error', { source });
    }
  }

  async function loadFile(f, source = 'file') {
    if (dirty && !confirm('Несохранённые правки пропадут. Открыть другой файл?')) return;
    load(decodeXml(await f.arrayBuffer()), f.name, source);
  }

  // Перетаскивание файла на любое место страницы.
  useEffect(() => {
    const over = (e) => e.preventDefault();
    const drop = (e) => {
      e.preventDefault();
      const f = e.dataTransfer?.files[0];
      if (f) loadFile(f, 'drop');
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!file) return <Loader onOpen={load} onFile={loadFile} error={error} />;

  const parts = getParts(file.doc);
  const edit = (fn) => {
    fn();
    setRev((r) => r + 1);
  };
  const marking = parts.table ? analyzeMarking(rowsFromDom(parts.table)) : null;
  const idFile = attr(parts.file, 'ИдФайл');
  const downloadName = idFile ? `${idFile}.xml` : file.fileName ?? 'upd.xml';

  return (
    <Doc.Provider value={{ edit }}>
      <header class="topbar">
        <div class="topbar-title">
          <h1>
            УПД № {attr(parts.hdr, 'НомерДок') || '—'} от {attr(parts.hdr, 'ДатаДок') || '—'}
            {dirty && <span class="badge changed">изменён</span>}
            {marking?.total.markedRows > 0 && <span class="badge mark" title="В документе есть коды маркировки">маркировка: {markingSummary(marking.total)}</span>}
          </h1>
          <div class="sub">{partyName(parts.sellers[0])} → {partyName(parts.buyers[0])}</div>
        </div>
        <div class="topbar-actions">
          <button type="button" class="small" onClick={() => {
            if (dirty && !confirm('Несохранённые правки пропадут. Закрыть документ?')) return;
            setFile(null);
            setError(null);
          }}>Открыть другой</button>
          <button type="button" class="small" disabled={!dirty} onClick={() => {
            if (confirm('Вернуть документ к исходному состоянию?')) load(file.original, file.fileName, 'reset');
          }}>Сбросить правки</button>
          <button type="button" class="small primary" onClick={() => {
            download(downloadName, encodeXml(xml, file.encoding));
            track('download', { changed: dirty, encoding: file.encoding });
          }}>
            Скачать XML
          </button>
          <GithubLink />
        </div>
      </header>

      <div class="workspace">
        <section class="editor" aria-label="Реквизиты">
          <DocHeader parts={parts} />
          {parts.sellers.map((p, i) => <Party key={`s${i}`} party={p} title={parts.sellers.length > 1 ? `Продавец ${i + 1}` : 'Продавец'} />)}
          {parts.buyers.map((p, i) => <Party key={`b${i}`} party={p} title={parts.buyers.length > 1 ? `Покупатель ${i + 1}` : 'Покупатель'} />)}
          <Basis parts={parts} />
          <Items parts={parts} marking={marking} />
          <Marking marking={marking} />
          <Signers parts={parts} />
          <FileInfo parts={parts} />
          <p class="field-hint encoding">Кодировка при сохранении: {file.encoding}. Остальные сведения файла (маркировка, транспортировка, доп. поля) сохраняются без изменений.</p>
        </section>

        <section class="viewer" aria-label="Просмотр">
          <Segmented value={tab} options={[['preview', 'Печатная форма'], ['xml', 'XML']]} onChange={(t) => { setTab(t); track('tab', { tab: t }); }} />
          {tab === 'preview'
            ? <Preview xml={previewXml || xml} form={form} onForm={(f) => { setForm(f); track('form', { form: f }); }} />
            : <Source xml={xml} onApply={(text) => {
                track('xml-apply');
                const f = open(text, file.fileName);
                setFile({ ...f, original: file.original });
                setRev((r) => r + 1);
              }} />}
        </section>
      </div>
    </Doc.Provider>
  );
}
