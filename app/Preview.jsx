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

/** Исходный XML: можно поправить руками и применить. */
export function Source({ xml, onApply }) {
  const [text, setText] = useState(xml);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!dirty) setText(xml);
  }, [xml]);

  return (
    <div class="source">
      <div class="preview-bar">
        <span class="field-hint">{dirty ? 'Текст изменён — примените, чтобы обновить форму' : 'XML с вашими правками'}</span>
        {dirty && (
          <button type="button" class="small" onClick={() => { setText(xml); setDirty(false); setError(null); }}>Отменить</button>
        )}
        <button type="button" class="small primary" disabled={!dirty} onClick={() => {
          try {
            onApply(text);
            setDirty(false);
            setError(null);
          } catch (e) {
            setError(e.message);
          }
        }}>Применить</button>
      </div>
      {error && <p class="status error-text">{error}</p>}
      <textarea class="code" spellcheck={false} value={text} onInput={(e) => { setText(e.currentTarget.value); setDirty(true); }} />
    </div>
  );
}
