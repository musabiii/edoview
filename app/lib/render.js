// Печатные формы: XML УПД → HTML через XSLT (xslt/*.xslt).
// Встроенный в браузеры XSLT удаляется (Chrome 155, ноябрь 2026), поэтому всегда используем
// полифил — libxslt в WebAssembly (~1,4 МБ, грузится лениво при первом предпросмотре).
// Подход взят из docdriver (app/lib/render.js).

import polyfillUrl from 'xslt-polyfill/xslt-polyfill.min.js?url';

import actXslt from '../../xslt/act.xslt?raw';
import commonXslt from '../../xslt/common.xslt?raw';
import updXslt from '../../xslt/upd.xslt?raw';

const XSL_NS = 'http://www.w3.org/1999/XSL/Transform';
const INCLUDES = { 'common.xslt': commonXslt };
const SOURCES = { act: actXslt, upd: updXslt };

let ready;

/** Заранее подгрузить XSLT-движок (пока человек на стартовой странице). Ошибки не важны. */
export function warmup() {
  return loadPolyfill().catch(() => {});
}

function loadPolyfill() {
  ready ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = polyfillUrl;
    script.charset = 'utf-8';
    script.onload = () => window.xsltPolyfillReady().then(resolve, reject);
    script.onerror = () => {
      ready = undefined;
      reject(new Error('Не удалось загрузить XSLT-движок'));
    };
    document.head.append(script);
  });
  return ready;
}

function parse(text, what) {
  const doc = new DOMParser().parseFromString(text.replace(/^\s*<\?xml[^>]*\?>/, ''), 'application/xml');
  const error = doc.querySelector('parsererror');
  if (error) throw new Error(`${what}: ошибка XML — ${error.textContent.trim().slice(0, 300)}`);
  return doc;
}

/** Полифил не умеет синхронно подгружать xsl:include — подставляем содержимое сами. */
function parseStylesheet(text) {
  const doc = parse(text, 'XSLT');
  for (const include of [...doc.getElementsByTagNameNS(XSL_NS, 'include')]) {
    const href = include.getAttribute('href');
    if (!(href in INCLUDES)) throw new Error(`XSLT: неизвестный include ${href}`);
    const included = parse(INCLUDES[href], href).documentElement;
    for (const node of [...included.childNodes]) include.before(doc.importNode(node, true));
    include.remove();
  }
  return doc;
}

const processors = {};

/**
 * @param {string} xml  XML УПД строкой (уже декодированный)
 * @param {'upd'|'act'} form
 * @returns {Promise<string>} HTML-страница печатной формы
 */
export async function renderHtml(xml, form) {
  await loadPolyfill();
  if (!processors[form]) {
    const p = new XSLTProcessor();
    p.importStylesheet(parseStylesheet(SOURCES[form]));
    processors[form] = p;
  }
  const result = processors[form].transformToDocument(parse(xml, 'XML'));
  if (!result?.documentElement) throw new Error('XSLT вернул пустой результат');
  return '<!DOCTYPE html>\n' + result.documentElement.outerHTML;
}
