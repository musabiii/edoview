// XML-редактор на CodeMirror 6: подсветка, сворачивание, поиск, плюс слой пояснений
// (нередактируемые виджеты над ключевыми элементами), проверки реквизитов и подсказки
// с расшифровкой элементов и атрибутов. Модуль грузится лениво — при открытии вкладки XML.

import { xml, xmlLanguage } from '@codemirror/lang-xml';
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { diagnosticCount, linter, lintGutter, openLintPanel } from '@codemirror/lint';
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, hoverTooltip, keymap, ViewPlugin, WidgetType } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { basicSetup } from 'codemirror';

import { ATTRIBUTES, ELEMENTS } from './lib/glossary.js';
import { formatXml } from './lib/xmlFormat.js';
import { diagnostics, elements, notes, parserErrorPosition, parserMessage } from './lib/xmlInsight.js';

// ---------------------------------------------------------------- оформление

const highlight = HighlightStyle.define([
  { tag: t.tagName, color: 'var(--xml-tag)' },
  { tag: t.attributeName, color: 'var(--xml-attr)' },
  { tag: t.attributeValue, color: 'var(--xml-value)' },
  { tag: [t.angleBracket, t.definitionOperator], color: 'var(--xml-punct)' },
  { tag: t.comment, color: 'var(--xml-comment)', fontStyle: 'italic' },
  { tag: t.processingInstruction, color: 'var(--xml-meta)' },
  { tag: t.character, color: 'var(--xml-entity)' },
  { tag: t.content, color: 'var(--text)' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '12.5px', backgroundColor: 'var(--surface)', color: 'var(--text)' },
  '.cm-scroller': { fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace', lineHeight: '1.5' },
  '.cm-gutters': { backgroundColor: 'var(--surface-2)', color: 'var(--muted)', borderRight: '1px solid var(--border)' },
  '.cm-activeLine': { backgroundColor: 'var(--xml-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--xml-active)' },
  '.cm-cursor': { borderLeftColor: 'var(--text)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--xml-selection) !important' },
  '.cm-tooltip': { backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px' },
  '.cm-panels': { backgroundColor: 'var(--surface-2)', color: 'var(--text)' },
});

// ---------------------------------------------------------------- пояснения

class NoteWidget extends WidgetType {
  constructor(text) {
    super();
    this.text = text;
  }

  eq(other) {
    return other.text === this.text;
  }

  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-note';
    el.append(Object.assign(document.createElement('span'), { textContent: this.text }));
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  ignoreEvent() {
    return true;
  }
}

function buildNotes(text) {
  const roots = elements(text, xmlLanguage.parser.parse(text));
  // Блочный виджет ставим в начало строки, иначе он разрежет отступ перед тегом.
  const lineStart = (pos) => text.lastIndexOf('\n', pos - 1) + 1;
  return Decoration.set(
    notes(roots).map((n) => Decoration.widget({ widget: new NoteWidget(n.text), block: true, side: -1 }).range(lineStart(n.pos))),
    true,
  );
}

const setNotes = StateEffect.define();

/** Виджеты храним в состоянии: блочные декорации можно задавать только так. */
const notesField = StateField.define({
  create: (state) => buildNotes(state.doc.toString()),
  update(deco, tr) {
    for (const e of tr.effects) if (e.is(setNotes)) return e.value;
    return tr.docChanged ? deco.map(tr.changes) : deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Пересчёт пояснений после паузы в наборе — пока печатают, виджеты просто сдвигаются. */
const notesRefresh = ViewPlugin.fromClass(class {
  constructor(view) {
    this.view = view;
    this.timer = 0;
  }

  update(u) {
    if (!u.docChanged) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.view.dispatch({ effects: setNotes.of(buildNotes(this.view.state.doc.toString())) });
    }, 400);
  }

  destroy() {
    clearTimeout(this.timer);
  }
});

// ---------------------------------------------------------------- проверки

function wellFormed(text, doc) {
  const parsed = new DOMParser().parseFromString(text.replace(/^﻿?\s*<\?xml[^>]*\?>/, (m) => ' '.repeat(m.length)), 'application/xml');
  const error = parsed.querySelector('parsererror');
  if (!error) return null;
  const message = parserMessage(error.textContent);
  const p = parserErrorPosition(message);
  let from = 0;
  if (p && p.line <= doc.lines) {
    const line = doc.line(p.line);
    from = Math.min(line.from + Math.max(p.column - 1, 0), line.to);
  }
  return { from, to: Math.min(from + 1, doc.length), severity: 'error', message: `Ошибка XML: ${message.slice(0, 200)}` };
}

const checks = linter((view) => {
  const text = view.state.doc.toString();
  const out = diagnostics(elements(text, xmlLanguage.parser.parse(text)));
  const broken = wellFormed(text, view.state.doc);
  if (broken) out.unshift(broken);
  return out;
}, { delay: 400 });

// ---------------------------------------------------------------- подсказки

const glossaryTooltip = hoverTooltip((view, pos, side) => {
  let node = syntaxTree(view.state).resolveInner(pos, side);
  if (node.name === 'AttributeValue' || node.name === 'Is') node = node.parent?.firstChild ?? node;
  if (node.name !== 'TagName' && node.name !== 'AttributeName') return null;
  const name = view.state.sliceDoc(node.from, node.to);
  const text = node.name === 'TagName' ? ELEMENTS[name] : ATTRIBUTES[name];
  if (!text) return null;
  return {
    pos: node.from,
    end: node.to,
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className = 'cm-glossary';
      const b = document.createElement('b');
      b.textContent = name;
      dom.append(b, document.createTextNode(` — ${text}`));
      return { dom };
    },
  };
});

// ---------------------------------------------------------------- редактор

/**
 * @param {HTMLElement} parent
 * @param {{doc: string, onChange: (text: string) => void, onDiagnostics?: (count: number) => void,
 *   onFormatError?: (message: string) => void}} opts
 */
export function createXmlEditor(parent, { doc, onChange, onDiagnostics, onFormatError }) {
  let external = false;
  let count = -1;

  /** Форматирование — обычная правка: попадает в историю (Ctrl+Z) и делает текст изменённым. */
  function format(view) {
    try {
      const text = formatXml(view.state.doc.toString());
      if (text !== view.state.doc.toString()) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
      onFormatError?.(null);
    } catch (e) {
      onFormatError?.(e.message);
      if (e.pos !== undefined) view.dispatch({ selection: { anchor: e.pos }, scrollIntoView: true });
    }
    return true;
  }

  const view = new EditorView({
    parent,
    doc,
    extensions: [
      basicSetup,
      xml(),
      syntaxHighlighting(highlight),
      theme,
      EditorView.lineWrapping,
      notesField,
      notesRefresh,
      checks,
      lintGutter(),
      glossaryTooltip,
      keymap.of([{ key: 'Shift-Alt-f', run: format }]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !external) onChange(u.state.doc.toString());
        const n = diagnosticCount(u.state);
        if (n !== count) onDiagnostics?.((count = n));
      }),
    ],
  });

  return {
    view,
    /** Заменяет текст, меняя только отличающийся кусок — прокрутка и курсор остаются на месте. */
    setText(text) {
      const cur = view.state.doc.toString();
      if (cur === text) return;
      let start = 0;
      while (start < cur.length && start < text.length && cur[start] === text[start]) start++;
      let endCur = cur.length;
      let endNew = text.length;
      while (endCur > start && endNew > start && cur[endCur - 1] === text[endNew - 1]) {
        endCur--;
        endNew--;
      }
      external = true;
      view.dispatch({ changes: { from: start, to: endCur, insert: text.slice(start, endNew) } });
      external = false;
    },
    getText: () => view.state.doc.toString(),
    openProblems: () => openLintPanel(view),
    format: () => format(view),
    destroy: () => view.destroy(),
  };
}
