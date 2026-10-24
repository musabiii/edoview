import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { Icon, IssuesButton, MobileTabs, MoreMenu, SampleBanner, SectionNav, useDialog, useToast } from './chrome.jsx';
import { Basis, DocHeader, Extra, Items, Marking, Signers } from './editor/Sections.jsx';
import { Party } from './editor/Party.jsx';
import { Loader } from './Loader.jsx';
import { Preview, Source } from './Preview.jsx';
import { track } from './lib/analytics.js';
import { countBySection, documentIssues, issuesWord, plural } from './lib/issues.js';
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

/** Длинное имя файла для уведомления: начало…конец. */
const shortName = (s, n = 42) => (s.length > n ? `${s.slice(0, 22)}…${s.slice(-(n - 23))}` : s);

/** Раскрыть раздел редактора, прокрутить к нему и поставить курсор в первое поле с ошибкой. */
function goToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === 'DETAILS') el.open = true;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
  el.querySelector('.has-error input, .has-error select, .has-error textarea')?.focus({ preventScroll: true });
}

export function App() {
  const [file, setFile] = useState(null);
  const [rev, setRev] = useState(0);
  const [error, setError] = useState(null);
  const [form, setForm] = useState('upd');
  const [tab, setTab] = useState('preview');
  const [pane, setPane] = useState('edit');
  const [banner, setBanner] = useState(true);
  const [dialog, ask] = useDialog();
  const [toast, showToast] = useToast();
  const edited = useRef(false);
  const sawSample = useRef(false);

  const xml = useMemo(() => (file ? serializeXml(file.doc, file.encoding) : ''), [file, rev]);
  const previewXml = useDebounced(xml, 300);
  const dirty = !!file && xml !== file.original;
  const issues = useMemo(() => (file ? documentIssues(file.doc) : []), [file, rev]);

  /** @param {'file'|'drop'|'paste'|'sample'|'reset'} [source] — для аналитики и плашки примера */
  function load(text, fileName, source) {
    try {
      const f = open(text, fileName);
      const keep = source === 'reset' ? file?.source : source;
      setFile({ ...f, source: keep });
      setForm(defaultForm(f.doc));
      setError(null);
      setRev((r) => r + 1);
      edited.current = false;
      if (source && source !== 'reset') {
        const p = getParts(f.doc);
        track('open', {
          source,
          function: attr(p.doc, 'Функция') || '—',
          marking: !!p.table && analyzeMarking(rowsFromDom(p.table)).any,
          afterSample: source !== 'sample' && sawSample.current,
          issues: documentIssues(f.doc).filter((i) => i.severity !== 'info').length,
        });
        if (source === 'sample') sawSample.current = true;
        setBanner(true);
        setPane('edit');
      }
    } catch (e) {
      setError(e.message);
      if (source) track('open-error', { source });
    }
  }

  async function confirmDiscard(action) {
    if (!dirty) return true;
    return ask({ title: 'Несохранённые правки пропадут', text: `${action} без скачивания изменённого XML?`, confirm: 'Продолжить', cancel: 'Остаться', danger: true });
  }

  async function loadFile(f, source = 'file') {
    if (!(await confirmDiscard('Открыть другой файл'))) return;
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
    if (!dirty) return undefined;
    const warn = (e) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!file) return <>{dialog}<Loader onOpen={load} onFile={loadFile} error={error} /></>;

  const parts = getParts(file.doc);
  const edit = (fn) => {
    fn();
    setRev((r) => r + 1);
    if (!edited.current) {
      edited.current = true;
      track('edit', { source: file.source ?? '—' });
    }
  };
  const marking = parts.table ? analyzeMarking(rowsFromDom(parts.table)) : null;
  const idFile = attr(parts.file, 'ИдФайл');
  const downloadName = idFile ? `${idFile}.xml` : file.fileName ?? 'upd.xml';
  const counts = countBySection(issues);
  const problems = issues.filter((i) => i.severity !== 'info').length;
  const errors = issues.filter((i) => i.severity === 'error');

  const sections = [
    'doc',
    ...parts.sellers.map((_, i) => `seller-${i}`),
    ...parts.buyers.map((_, i) => `buyer-${i}`),
    'items',
    ...(marking?.any ? ['marking'] : []),
    'basis',
    'signers',
    'extra',
  ];

  function go(id) {
    setPane('edit');
    // На узком экране редактор мог быть скрыт — ждём отрисовки.
    requestAnimationFrame(() => goToSection(id));
  }

  async function onDownload() {
    if (errors.length) {
      const ok = await ask({
        title: `В документе ${errors.length} ${plural(errors.length, 'ошибка', 'ошибки', 'ошибок')}`,
        text: 'Оператор ЭДО или получатель может не принять такой файл. Скачать всё равно?',
        list: errors.slice(0, 5),
        confirm: 'Скачать всё равно',
        cancel: 'Исправить',
      });
      if (!ok) {
        track('download-cancel', { errors: errors.length });
        go(errors[0].section);
        return;
      }
    }
    download(downloadName, encodeXml(xml, file.encoding));
    track('download', { changed: dirty, encoding: file.encoding, issues: problems, errors: errors.length, source: file.source ?? '—' });
    showToast(`Сохранено: ${shortName(downloadName)} (${file.encoding})`);
  }

  async function onClose() {
    if (!(await confirmDiscard('Закрыть документ'))) return;
    setFile(null);
    setError(null);
  }

  async function onReset() {
    const ok = await ask({ title: 'Сбросить правки?', text: 'Документ вернётся к состоянию на момент открытия.', confirm: 'Сбросить', cancel: 'Отмена', danger: true });
    if (ok) load(file.original, file.fileName, 'reset');
  }

  const setView = (t) => {
    setTab(t);
    track('tab', { tab: t });
  };

  return (
    <Doc.Provider value={{ edit }}>
      {dialog}
      <header class="topbar">
        <div class="topbar-title">
          <h1>
            <span class="doc-title">УПД № {attr(parts.hdr, 'НомерДок') || '—'} от {attr(parts.hdr, 'ДатаДок') || '—'}</span>
            {dirty && <span class="badge changed">изменён</span>}
            {marking?.total.markedRows > 0 && <span class="badge mark desk-only" title="В документе есть коды маркировки">маркировка: {markingSummary(marking.total)}</span>}
          </h1>
          <div class="sub">{partyName(parts.sellers[0])} → {partyName(parts.buyers[0])}</div>
        </div>
        <div class="topbar-actions">
          <IssuesButton issues={issues} onGo={go} onOpen={() => track('issues', { count: problems })} />
          <button type="button" class="small desk-only" onClick={onClose}>Открыть другой</button>
          <button type="button" class="small desk-only" disabled={!dirty} onClick={onReset}>Сбросить правки</button>
          <button type="button" class="small primary" onClick={onDownload}>
            <Icon.download size={16} /><span class="desk-only">Скачать XML</span><span class="mobile-only">XML</span>
          </button>
          <MoreMenu>
            <button type="button" onClick={onClose}>Открыть другой файл</button>
            <button type="button" disabled={!dirty} onClick={onReset}>Сбросить правки</button>
            <a href="https://github.com/musabiii/edoview" target="_blank" rel="noopener noreferrer">Исходный код на GitHub</a>
          </MoreMenu>
          <span class="desk-only"><GithubLink /></span>
        </div>
      </header>

      {file.source === 'sample' && banner && (
        <SampleBanner onFile={(f) => loadFile(f, 'file')} onClose={() => setBanner(false)} />
      )}

      <div class="workspace" data-pane={pane === 'edit' ? 'edit' : 'view'}>
        <section class="editor" aria-label="Реквизиты">
          <SectionNav sections={sections} counts={counts} onGo={go} />
          <DocHeader parts={parts} />
          {parts.sellers.map((p, i) => <Party key={`s${i}`} id={`seller-${i}`} party={p} title={parts.sellers.length > 1 ? `Продавец ${i + 1}` : 'Продавец'} />)}
          {parts.buyers.map((p, i) => <Party key={`b${i}`} id={`buyer-${i}`} party={p} title={parts.buyers.length > 1 ? `Покупатель ${i + 1}` : 'Покупатель'} />)}
          <Items parts={parts} marking={marking} />
          <Marking marking={marking} />
          <Basis parts={parts} />
          <Signers parts={parts} />
          <Extra parts={parts} />
          <p class="field-hint encoding">
            Кодировка при сохранении: {file.encoding}. Остальные сведения файла (транспортировка, доп. поля) сохраняются без изменений.
            {problems > 0 && ` Сейчас в документе ${issuesWord(problems)}.`}
          </p>
        </section>

        <section class="viewer" aria-label="Просмотр">
          <div class="desk-only viewer-tabs">
            <Segmented value={tab} options={[['preview', 'Печатная форма'], ['xml', 'XML']]} onChange={setView} />
          </div>
          {tab === 'preview'
            ? <Preview xml={previewXml || xml} form={form} onForm={(f) => { setForm(f); track('form', { form: f }); }} />
            : <Source xml={xml} onApply={(text) => {
                track('xml-apply');
                const f = open(text, file.fileName);
                setFile({ ...f, original: file.original, source: file.source });
                setRev((r) => r + 1);
              }} />}
        </section>
      </div>

      <MobileTabs
        value={pane === 'edit' ? 'edit' : tab}
        problems={problems}
        onChange={(p) => {
          if (p === 'edit') setPane('edit');
          else {
            setPane('view');
            setView(p);
          }
          window.scrollTo(0, 0);
        }}
      />
      {toast}
    </Doc.Provider>
  );
}
