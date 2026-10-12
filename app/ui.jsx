// Поля формы, привязанные к атрибутам XML. Значение читается прямо из DOM при каждом
// рендере, запись идёт через edit() — он меняет документ и перерисовывает редактор.

import { useContext } from 'preact/hooks';
import { createContext } from 'preact';

import { normalizeNumber } from './lib/calc.js';
import { attr, setAttr } from './lib/upd.js';

/** { edit(fn) } — правка документа с перерисовкой. */
export const Doc = createContext(null);

export function useEdit() {
  return useContext(Doc).edit;
}

export function Field({ label, error, hint, wide, children }) {
  return (
    <label class={`field${error ? ' has-error' : ''}${wide ? ' wide' : ''}`}>
      <span class="field-label">{label}</span>
      {children}
      {error ? <span class="field-error">{error}</span> : hint && <span class="field-hint">{hint}</span>}
    </label>
  );
}

function problem(value, { required, check }) {
  if (!value) return required ? 'Обязательное поле' : null;
  return check?.(value) ?? null;
}

/**
 * Атрибут элемента как текстовое поле.
 * @param {object} p
 * @param {Element|null} p.el     элемент (может ещё не существовать)
 * @param {() => Element} [p.make] создаёт элемент при первой записи
 * @param {string} p.name         имя атрибута
 * @param {(el: Element) => void} [p.after] вызывается после записи (пересчёт, чистка)
 */
export function Attr({ el, make, name, label, required, check, hint, wide, multiline, kind = 'text', after, ...rest }) {
  const edit = useEdit();
  const value = attr(el, name);
  const error = problem(value, { required, check });

  function write(raw) {
    edit(() => {
      const v = kind === 'number' ? normalizeNumber(raw) : raw;
      const target = el ?? (v ? make?.() : null);
      if (!target) return;
      setAttr(target, name, v);
      after?.(target);
    });
  }

  let input;
  if (kind === 'date') {
    input = <input type="date" value={toIso(value)} onInput={(e) => write(fromIso(e.currentTarget.value))} {...rest} />;
  } else if (multiline) {
    input = <textarea rows={2} value={value} onInput={(e) => write(e.currentTarget.value)} {...rest} />;
  } else {
    input = (
      <input
        type="text"
        inputMode={kind === 'number' || kind === 'digits' ? 'decimal' : undefined}
        value={value}
        onInput={(e) => write(e.currentTarget.value)}
        {...rest}
      />
    );
  }
  return <Field label={label} error={error} hint={hint} wide={wide}>{input}</Field>;
}

/** Атрибут как выпадающий список. options: [[value, label], …] */
export function AttrSelect({ el, make, name, label, options, required, hint, wide, after }) {
  const edit = useEdit();
  const value = attr(el, name);
  const known = options.some(([v]) => v === value);
  return (
    <Field label={label} hint={hint} wide={wide} error={!value && required ? 'Обязательное поле' : null}>
      <select
        value={value}
        onChange={(e) => edit(() => {
          const target = el ?? make?.();
          setAttr(target, name, e.currentTarget.value);
          after?.(target);
        })}
      >
        {!required && <option value="">—</option>}
        {!known && value && <option value={value}>{value}</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Field>
  );
}

/** ДД.ММ.ГГГГ ↔ ГГГГ-ММ-ДД для input[type=date]. */
function toIso(d) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(d);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function fromIso(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

export function Section({ title, badge, open = true, actions, children }) {
  return (
    <details class="card" open={open}>
      <summary>
        <span class="card-title">{title}</span>
        {badge && <span class="badge">{badge}</span>}
        {actions && <span class="card-actions" onClick={(e) => e.preventDefault()}>{actions}</span>}
      </summary>
      <div class="card-body">{children}</div>
    </details>
  );
}

export function Notice({ kind = 'error', children }) {
  return <div class={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function Segmented({ value, options, onChange }) {
  return (
    <div class="segmented" role="tablist">
      {options.map(([v, l]) => (
        <button key={v} type="button" role="tab" aria-selected={v === value} class={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}
