import { useEffect, useRef, useState } from 'preact/hooks';

import { renderHtml } from './lib/render.js';
import { Segmented } from './ui.jsx';

/**
 * Печатная форма текущего XML. Перерисовывается при каждой правке (XML приходит уже
 * с задержкой из App), прокрутка iframe сохраняется.
 */
export function Preview({ xml, form, onForm }) {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);
  const frame = useRef(null);
  const scroll = useRef(0);

  useEffect(() => {
    let alive = true;
    renderHtml(xml, form).then(
      (h) => {
        if (!alive) return;
        scroll.current = frame.current?.contentWindow?.scrollY ?? scroll.current;
        setHtml(h);
        setError(null);
      },
      (e) => alive && setError(e.message),
    );
    return () => { alive = false; };
  }, [xml, form]);

  return (
    <div class="preview">
      <div class="preview-bar">
        <Segmented value={form} options={[['upd', 'Форма УПД'], ['act', 'Акт']]} onChange={onForm} />
        <button type="button" class="small" disabled={!html} onClick={() => frame.current.contentWindow.print()}>
          Печать / PDF
        </button>
      </div>
      {error && <p class="status error-text">{error}</p>}
      {html ? (
        <iframe
          ref={frame}
          srcdoc={html}
          title="Печатная форма"
          onLoad={() => {
            fitWidth(frame.current);
            frame.current.contentWindow.scrollTo(0, scroll.current);
          }}
        />
      ) : (
        !error && <p class="status">Готовлю печатную форму…</p>
      )}
    </div>
  );
}

/**
 * Форма УПД альбомная (297 мм) и в узкой панели не помещается: на экране уменьшаем её
 * под ширину iframe. Только @media screen — печать идёт в натуральном размере.
 */
function fitWidth(iframe) {
  const doc = iframe.contentDocument;
  const page = doc?.querySelector('.page.upd');
  if (!page) return;
  const zoom = Math.min(1, (iframe.clientWidth - 24) / (page.offsetWidth + 2));
  const style = doc.createElement('style');
  style.textContent = `@media screen { html { zoom: ${zoom.toFixed(3)}; } }`;
  doc.head.append(style);
}

/**
 * Исходный XML в редакторе CodeMirror (грузится при первом открытии вкладки):
 * подсветка, пояснения над элементами, проверки реквизитов. Правки применяются кнопкой.
 */
export function Source({ xml, onApply }) {
  const host = useRef(null);
  const editor = useRef(null);
  const latest = useRef(xml);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);
  const [problems, setProblems] = useState(0);
  const [showNotes, setShowNotes] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [ready, setReady] = useState(false);

  latest.current = xml;

  useEffect(() => {
    let alive = true;
    import('./xmlEditor.js').then(
      ({ createXmlEditor }) => {
        if (!alive) return;
        editor.current = createXmlEditor(host.current, {
          doc: latest.current,
          onChange: (text) => setDirty(text !== latest.current),
          onDiagnostics: setProblems,
          onFormatError: setError,
        });
        setReady(true);
      },
      (e) => alive && setLoadError(`Не удалось загрузить редактор: ${e.message}`),
    );
    return () => {
      alive = false;
      editor.current?.destroy();
      editor.current = null;
    };
  }, []);

  useEffect(() => {
    if (!dirty) editor.current?.setText(xml);
  }, [xml]);

  function apply() {
    try {
      onApply(editor.current.getText());
      setDirty(false);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div class={`source${showNotes ? '' : ' hide-notes'}`}>
      <div class="preview-bar">
        <label class="check">
          <input type="checkbox" checked={showNotes} onChange={(e) => setShowNotes(e.currentTarget.checked)} />
          Пояснения
        </label>
        <button type="button" class={`small problems${problems ? ' has' : ''}`} disabled={!problems}
          onClick={() => editor.current?.openProblems()} title="Список замечаний (Ctrl+Shift+M)">
          {problems ? `Замечаний: ${problems}` : 'Замечаний нет'}
        </button>
        <button type="button" class="small" disabled={!ready} onClick={() => editor.current?.format()}
          title="Расставить отступы и переносы (Shift+Alt+F). Значения не меняются">Форматировать</button>
        <span class="field-hint">{dirty ? 'Текст изменён — примените, чтобы обновить форму' : 'Наведите на тег или атрибут — появится расшифровка'}</span>
        {dirty && (
          <button type="button" class="small" onClick={() => { editor.current?.setText(xml); setDirty(false); setError(null); }}>Отменить</button>
        )}
        <button type="button" class="small primary" disabled={!dirty} onClick={apply}>Применить</button>
      </div>
      {(error || loadError) && <p class="status error-text">{error ?? loadError}</p>}
      <div class="xml-editor" ref={host}>
        {!ready && !loadError && <p class="status">Загружаю редактор…</p>}
      </div>
    </div>
  );
}
