import { useEffect, useState } from 'preact/hooks';

import actSample from '../samples/act-dop.xml?raw';
import markSample from '../samples/upd-marking.xml?raw';
import updSample from '../samples/upd-schfdop.xml?raw';
import { Footer, Icon } from './chrome.jsx';
import { warmup } from './lib/render.js';
import { GithubLink, Notice } from './ui.jsx';

const SAMPLES = [
  { file: 'upd-schfdop.xml', xml: updSample, title: 'УПД со статусом 1', text: 'Счёт-фактура и передаточный документ, НДС 22%, три строки товаров.', tags: ['СЧФДОП', 'НДС 22%'] },
  { file: 'upd-marking.xml', xml: markSample, title: 'УПД с маркировкой', text: 'Коды КИЗ, групповая и транспортная упаковка, проверка GTIN.', tags: ['Честный знак', 'КИЗ'] },
  { file: 'act-dop.xml', xml: actSample, title: 'Акт ИП без НДС', text: 'Передаточный документ (ДОП) в виде акта оказанных услуг.', tags: ['ДОП', 'УСН'] },
];

const FEATURES = [
  [Icon.print, 'Печатная форма УПД и акта', 'Обновляется при каждой правке. Печать и сохранение в PDF.'],
  [Icon.check, 'Проверка реквизитов', 'ИНН, КПП, ОГРНИП, счета по БИК, даты, суммы и НДС по строкам.'],
  [Icon.barcode, 'Маркировка', 'КИЗ, упаковки и GTIN: дубли, контрольные цифры, приложение с кодами.'],
  [Icon.shield, 'Файл остаётся у вас', 'Всё работает в браузере, на сервер ничего не отправляется.'],
];

/** Похоже ли на XML: для вставки через Ctrl+V в любом месте страницы. */
const looksLikeXml = (s) => /^\s*(<\?xml|<Файл[\s>])/.test(s);

/**
 * Стартовая страница: загрузка файла, вставка текста, примеры, возможности.
 * @param {{onOpen: (text: string, fileName?: string, source?: string) => void, onFile: (f: File, source?: string) => void, error?: string}} props
 */
export function Loader({ onOpen, onFile, error }) {
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState('');
  const [over, setOver] = useState(false);

  // XSLT-движок (~560 КБ) качаем заранее, пока человек выбирает файл: первая форма откроется сразу.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 1200));
    const id = idle(() => warmup(), { timeout: 3000 });
    return () => (window.cancelIdleCallback ?? clearTimeout)(id);
  }, []);

  // Ctrl+V с XML в любом месте страницы (кроме поля вставки) сразу открывает документ.
  useEffect(() => {
    const onPaste = (e) => {
      if (e.target.closest?.('textarea, input')) return;
      const t = e.clipboardData?.getData('text') ?? '';
      if (looksLikeXml(t)) {
        e.preventDefault();
        onOpen(t, undefined, 'paste');
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  function drop(e) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f, 'drop');
  }

  return (
    <div class="landing">
      <header class="landing-top">
        <span class="brand"><Icon.doc size={20} />edoview</span>
        <GithubLink />
      </header>

      <main class="landing-main">
        <section class="hero">
          <h1>Просмотр и правка XML УПД онлайн</h1>
          <p class="lead">
            Откройте XML универсального передаточного документа (формат 5.03): проверьте реквизиты, исправьте ошибки
            и распечатайте форму УПД или акта. Бесплатно и без регистрации.
          </p>

          <label
            class={`dropzone${over ? ' over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={drop}
          >
            <span class="dropzone-icon"><Icon.upload size={28} /></span>
            <strong class="pointer-fine">Перетащите XML-файл сюда</strong>
            <strong class="pointer-coarse">Выберите XML-файл УПД</strong>
            <span class="btn primary">Выбрать файл…</span>
            <input
              type="file"
              accept=".xml,text/xml,application/xml"
              hidden
              onChange={(e) => {
                const f = e.currentTarget.files[0];
                e.currentTarget.value = '';
                if (f) onFile(f);
              }}
            />
            <span class="field-hint">
              <Icon.shield size={14} /> Файл не покидает браузер · windows-1251 или UTF-8
              <span class="pointer-fine"> · можно вставить текст через Ctrl+V</span>
            </span>
          </label>

          {paste ? (
            <div class="paste">
              <textarea
                class="code"
                rows={10}
                spellcheck={false}
                autofocus
                aria-label="Текст XML"
                placeholder={'<?xml version="1.0" encoding="windows-1251"?>\n<Файл ИдФайл="ON_NSCHFDOPPR_…" ВерсФорм="5.03" …>'}
                value={text}
                onInput={(e) => setText(e.currentTarget.value)}
              />
              <div class="actions">
                <button type="button" class="primary" disabled={!text.trim()} onClick={() => onOpen(text, undefined, 'paste')}>Открыть</button>
                <button type="button" onClick={() => setPaste(false)}>Отмена</button>
              </div>
            </div>
          ) : (
            <button type="button" class="link paste-link" onClick={() => setPaste(true)}>или вставьте текст XML</button>
          )}

          {error && <Notice>{error}</Notice>}
        </section>

        <section class="samples" aria-labelledby="samples-title">
          <h2 id="samples-title">Нет файла под рукой? Попробуйте на примере</h2>
          <div class="sample-grid">
            {SAMPLES.map((s) => (
              <button key={s.file} type="button" class="sample-card" onClick={() => onOpen(s.xml, s.file, 'sample')}>
                <span class="sample-title">{s.title}</span>
                <span class="sample-text">{s.text}</span>
                <span class="sample-tags">{s.tags.map((t) => <span key={t} class="tag">{t}</span>)}</span>
                <span class="sample-cta">Открыть пример →</span>
              </button>
            ))}
          </div>
        </section>

        <section class="features" aria-label="Возможности">
          {FEATURES.map(([I, title, text]) => (
            <div key={title} class="feature">
              <span class="feature-icon"><I size={20} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  );
}
