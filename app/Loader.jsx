import { useState } from 'preact/hooks';

import actSample from '../samples/act-dop.xml?raw';
import markSample from '../samples/upd-marking.xml?raw';
import updSample from '../samples/upd-schfdop.xml?raw';
import { GithubLink, Notice, Segmented } from './ui.jsx';

/**
 * Экран загрузки: файл (кнопка или перетаскивание) либо вставка текста XML.
 * @param {{onOpen: (text: string, fileName?: string) => void, onFile: (f: File) => void, error?: string}} props
 */
export function Loader({ onOpen, onFile, error }) {
  const [tab, setTab] = useState('file');
  const [text, setText] = useState('');
  const [over, setOver] = useState(false);

  function drop(e) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }

  return (
    <main class="loader">
      <div class="loader-corner"><GithubLink /></div>
      <div class="loader-intro">
        <h1>Редактор УПД</h1>
        <p>Откройте XML универсального передаточного документа (формат 5.03), поправьте основные реквизиты и посмотрите печатную форму. Файл никуда не отправляется — всё работает в браузере.</p>
      </div>

      <Segmented value={tab} options={[['file', 'Файл'], ['paste', 'Вставить XML']]} onChange={setTab} />

      {tab === 'file' ? (
        <label
          class={`dropzone${over ? ' over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
        >
          <span class="dropzone-icon" aria-hidden="true">⇪</span>
          <strong>Перетащите XML-файл сюда</strong>
          <span>или</span>
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
          <span class="field-hint">Кодировка windows-1251 или UTF-8 определяется по XML-декларации.</span>
        </label>
      ) : (
        <div class="paste">
          <textarea
            class="code"
            rows={16}
            spellcheck={false}
            placeholder={'<?xml version="1.0" encoding="windows-1251"?>\n<Файл ИдФайл="ON_NSCHFDOPPR_…" ВерсФорм="5.03" …>'}
            value={text}
            onInput={(e) => setText(e.currentTarget.value)}
          />
          <button type="button" class="primary" disabled={!text.trim()} onClick={() => onOpen(text)}>Открыть</button>
        </div>
      )}

      {error && <Notice>{error}</Notice>}

      <p class="samples">
        Нет файла под рукой? Примеры:{' '}
        <button type="button" class="link" onClick={() => onOpen(updSample, 'upd-schfdop.xml')}>УПД со статусом 1 (с НДС)</button>
        {' · '}
        <button type="button" class="link" onClick={() => onOpen(markSample, 'upd-marking.xml')}>УПД с маркировкой</button>
        {' · '}
        <button type="button" class="link" onClick={() => onOpen(actSample, 'act-dop.xml')}>акт ИП без НДС (ДОП)</button>
      </p>
    </main>
  );
}
