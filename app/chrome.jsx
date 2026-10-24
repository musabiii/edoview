// Элементы оболочки: иконки, замечания в шапке, навигация по разделам, диалог, уведомление,
// плашка примера, мобильные вкладки, подвал.

import { useEffect, useRef, useState } from 'preact/hooks';

import { issuesWord, sectionTitle } from './lib/issues.js';
import { REPO_URL } from './ui.jsx';

// ---------------------------------------------------------------- иконки

function Svg({ children, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const Icon = {
  upload: (p) => <Svg {...p}><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></Svg>,
  check: (p) => <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>,
  alert: (p) => <Svg {...p}><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></Svg>,
  edit: (p) => <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>,
  print: (p) => <Svg {...p}><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></Svg>,
  code: (p) => <Svg {...p}><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></Svg>,
  shield: (p) => <Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></Svg>,
  barcode: (p) => <Svg {...p}><path d="M3 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14" /></Svg>,
  doc: (p) => <Svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></Svg>,
  more: (p) => <Svg {...p}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></Svg>,
  close: (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>,
  download: (p) => <Svg {...p}><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" /></Svg>,
};

// ---------------------------------------------------------------- всплывающие меню

/** details-меню, которое закрывается кликом снаружи и по Escape. */
function usePopover() {
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => {
      const d = ref.current;
      if (d?.open && (e.type === 'keydown' ? e.key === 'Escape' : !d.contains(e.target))) d.open = false;
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
  }, []);
  return ref;
}

/**
 * Счётчик замечаний в шапке со списком по разделам; клик — переход к разделу.
 * @param {{issues: {severity: string, text: string, section: string}[], onGo: (section: string) => void, onOpen?: () => void}} p
 */
export function IssuesButton({ issues, onGo, onOpen }) {
  const ref = usePopover();
  const shown = issues.filter((i) => i.severity !== 'info');
  const errors = shown.filter((i) => i.severity === 'error').length;
  if (!shown.length) {
    return <span class="issues-ok" title="Проверки реквизитов, сумм и маркировки пройдены"><Icon.check size={16} />Без замечаний</span>;
  }
  return (
    <details class="popover-host" ref={ref} onToggle={(e) => e.currentTarget.open && onOpen?.()}>
      <summary class={`btn small issues-btn ${errors ? 'has-errors' : 'has-warnings'}`} data-count={shown.length} aria-label={issuesWord(shown.length)}>
        <Icon.alert size={16} />{issuesWord(shown.length)}
      </summary>
      <div class="popover issues-list" role="menu">
        {shown.map((i, k) => (
          <button key={k} type="button" role="menuitem" class={`issue ${i.severity}`}
            onClick={() => { ref.current.open = false; onGo(i.section); }}>
            <span class="issue-section">{sectionTitle(i.section)}</span>
            <span class="issue-text">{i.text}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

/** Меню «⋯» для узкой шапки. */
export function MoreMenu({ children }) {
  const ref = usePopover();
  return (
    <details class="popover-host mobile-only" ref={ref}>
      <summary class="btn small icon-btn" aria-label="Ещё действия"><Icon.more /></summary>
      <div class="popover menu" role="menu" onClick={() => { ref.current.open = false; }}>{children}</div>
    </details>
  );
}

/**
 * Оглавление редактора: разделы с числом замечаний.
 * @param {{sections: string[], counts: Map<string, number>, onGo: (id: string) => void}} p
 */
export function SectionNav({ sections, counts, onGo }) {
  return (
    <nav class="section-nav" aria-label="Разделы">
      {sections.map((id) => (
        <button key={id} type="button" onClick={() => onGo(id)}>
          {sectionTitle(id)}
          {counts.get(id) > 0 && <span class="count">{counts.get(id)}</span>}
        </button>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------- диалог и уведомление

function Dialog({ title, text, list, confirm = 'OK', cancel = 'Отмена', danger, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog ref={ref} class="dialog" aria-labelledby="dialog-title" onCancel={(e) => { e.preventDefault(); onClose(false); }}>
      <h2 id="dialog-title">{title}</h2>
      {text && <p>{text}</p>}
      {list?.length > 0 && (
        <ul class="dialog-list">
          {list.map((i, k) => <li key={k}><b>{sectionTitle(i.section)}:</b> {i.text}</li>)}
        </ul>
      )}
      <div class="dialog-actions">
        <button type="button" onClick={() => onClose(false)}>{cancel}</button>
        <button type="button" class={danger ? 'danger-solid' : 'primary'} onClick={() => onClose(true)}>{confirm}</button>
      </div>
    </dialog>
  );
}

/** Вместо window.confirm: [узел для рендера, ask(options) → Promise<boolean>]. */
export function useDialog() {
  const [state, setState] = useState(null);
  const ask = (opts) => new Promise((resolve) => setState({ ...opts, resolve }));
  const node = state && (
    <Dialog {...state} onClose={(v) => { state.resolve(v); setState(null); }} />
  );
  return [node, ask];
}

/** Короткое уведомление внизу экрана: [узел, show(text)]. */
export function useToast() {
  const [text, setText] = useState(null);
  useEffect(() => {
    if (!text) return undefined;
    const t = setTimeout(() => setText(null), 4500);
    return () => clearTimeout(t);
  }, [text]);
  const node = text && (
    <div class="toast" role="status">
      <Icon.check size={16} /><span>{text}</span>
      <button type="button" class="icon-btn" aria-label="Закрыть" onClick={() => setText(null)}><Icon.close size={16} /></button>
    </div>
  );
  return [node, setText];
}

// ---------------------------------------------------------------- плашки и навигация

/** Плашка режима примера: подталкивает открыть свой файл. */
export function SampleBanner({ onFile, onClose }) {
  return (
    <div class="sample-banner" role="status">
      <Icon.doc />
      <span><b>Это пример.</b> Откройте свой XML — он тоже обрабатывается только в браузере.</span>
      <label class="btn small primary">
        Открыть свой файл
        <input type="file" accept=".xml,text/xml,application/xml" hidden onChange={(e) => {
          const f = e.currentTarget.files[0];
          e.currentTarget.value = '';
          if (f) onFile(f);
        }} />
      </label>
      <button type="button" class="icon-btn" aria-label="Скрыть" onClick={onClose}><Icon.close size={16} /></button>
    </div>
  );
}

/** Нижние вкладки на узком экране: реквизиты, форма, XML. */
export function MobileTabs({ value, onChange, problems }) {
  const tabs = [
    ['edit', 'Реквизиты', Icon.edit],
    ['preview', 'Форма', Icon.print],
    ['xml', 'XML', Icon.code],
  ];
  return (
    <nav class="mobile-tabs" aria-label="Режим">
      {tabs.map(([id, label, I]) => (
        <button key={id} type="button" class={value === id ? 'on' : ''} aria-current={value === id ? 'page' : undefined} onClick={() => onChange(id)}>
          <I size={20} />
          <span>{label}</span>
          {id === 'edit' && problems > 0 && <span class="count">{problems}</span>}
        </button>
      ))}
    </nav>
  );
}

export function Footer() {
  return (
    <footer class="site-footer">
      <span>edoview</span>
      <span>Файлы обрабатываются только в вашем браузере — на сервер ничего не отправляется.</span>
      <span>Формат УПД 5.03 (приказ ФНС ЕД-7-26/970@).</span>
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer">Открытый код на GitHub</a>
    </footer>
  );
}
