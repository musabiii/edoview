// Загрузка и сохранение XML УПД. Файлы ФНС обычно в windows-1251, поэтому при чтении
// декодируем по XML-декларации, а при сохранении пишем обратно в той же кодировке.

import { canEncode, encodeCp1251 } from './cp1251.js';
import { parserMessage } from './xmlInsight.js';

/** Байты файла → строка: по BOM или по encoding из XML-декларации. */
export function decodeXml(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  const head = new TextDecoder('ascii').decode(bytes.subarray(0, 200));
  const declared = /encoding\s*=\s*["']([\w-]+)["']/i.exec(head);
  return new TextDecoder(declared ? declared[1] : 'utf-8').decode(bytes);
}

/** Кодировка из XML-декларации строки; без декларации — UTF-8. */
export function declaredEncoding(text) {
  const m = /^\s*<\?xml[^>]*encoding\s*=\s*["']([\w-]+)["']/i.exec(text);
  if (!m) return 'UTF-8';
  return /^(windows-1251|cp1251)$/i.test(m[1]) ? 'windows-1251' : 'UTF-8';
}

/**
 * Строка → XMLDocument. Декларацию убираем: строка уже декодирована, и её encoding
 * не должен сбить парсер.
 */
export function parseXml(text) {
  const doc = new DOMParser().parseFromString(text.replace(/^﻿?\s*<\?xml[^>]*\?>/, ''), 'application/xml');
  const error = doc.querySelector('parsererror');
  if (error) throw new Error(`Ошибка XML: ${parserMessage(error.textContent).slice(0, 300)}`);
  return doc;
}

/** Проверяет, что это УПД: корень Файл с Документом. Возвращает текст ошибки или null. */
export function checkUpd(doc) {
  const root = doc.documentElement;
  if (root.localName !== 'Файл') return `Корневой элемент — «${root.localName}», ожидается «Файл» (XML УПД).`;
  if (!child(root, 'Документ')) return 'В файле нет элемента Документ.';
  if (!child(child(root, 'Документ'), 'СвСчФакт')) return 'В документе нет элемента СвСчФакт: это не УПД.';
  return null;
}

function child(el, name) {
  for (const c of el.children) if (c.localName === name) return c;
  return null;
}

/**
 * XMLDocument → строка с декларацией. Символы, которых нет в windows-1251, записываются
 * ссылками &#x…; — в XML так можно в тексте и в атрибутах (имена элементов кириллические,
 * но кириллица в windows-1251 есть).
 */
export function serializeXml(doc, encoding) {
  let body = new XMLSerializer().serializeToString(doc);
  if (encoding === 'windows-1251') {
    let out = '';
    for (const ch of body) {
      const cp = ch.codePointAt(0);
      out += canEncode(cp) ? ch : `&#x${cp.toString(16).toUpperCase()};`;
    }
    body = out;
  }
  return `<?xml version="1.0" encoding="${encoding}"?>\n${body}\n`;
}

/** Строка XML → байты для скачивания. */
export function encodeXml(text, encoding) {
  return encoding === 'windows-1251' ? encodeCp1251(text) : new TextEncoder().encode(text);
}

export function download(fileName, bytes, type = 'application/xml') {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
