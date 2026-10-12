// Пояснения и проверки для XML-редактора. Работает по синтаксическому дереву lezer
// (@codemirror/lang-xml), поэтому знает позиции в тексте и не падает на незаконченном XML.
// Не зависит от DOM и от CodeMirror-view — тестируется в Node.

import { isNoVat, rowAmounts, totals, VAT_RATES } from './calc.js';
import * as check from './checks.js';
import { analyzeMarking, markingSummary } from './marking.js';

/**
 * @typedef {{name: string, value: string, from: number, to: number}} XAttr  from/to — значение без кавычек
 * @typedef {{name: string, from: number, to: number, openTo: number, attrs: XAttr[],
 *   children: XEl[], parent: XEl|null, text: string, textFrom: number, textTo: number}} XEl
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function unescape(s) {
  return s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e] ?? m;
  });
}

/**
 * Дерево элементов с позициями.
 * @param {string} text
 * @param {import('@lezer/common').Tree} tree
 * @returns {XEl[]} корневые элементы
 */
export function elements(text, tree) {
  const roots = [];
  const stack = [];
  tree.iterate({
    enter(n) {
      const top = stack.at(-1);
      switch (n.name) {
        case 'Element': {
          const el = { name: '', from: n.from, to: n.to, openTo: n.to, attrs: [], children: [], parent: top ?? null, text: '', textFrom: -1, textTo: -1 };
          (top ? top.children : roots).push(el);
          stack.push(el);
          break;
        }
        case 'OpenTag':
        case 'SelfClosingTag':
          if (top) top.openTo = n.to;
          break;
        case 'TagName': {
          const p = n.node.parent?.name;
          if (top && (p === 'OpenTag' || p === 'SelfClosingTag')) top.name = text.slice(n.from, n.to);
          break;
        }
        case 'AttributeName':
          top?.attrs.push({ name: text.slice(n.from, n.to), value: '', from: n.to, to: n.to });
          break;
        case 'AttributeValue': {
          const a = top?.attrs.at(-1);
          if (a) {
            const raw = text.slice(n.from, n.to);
            const quoted = /^["']/.test(raw);
            const closed = quoted && raw.length > 1 && raw.at(-1) === raw[0];
            a.from = n.from + (quoted ? 1 : 0);
            a.to = n.to - (closed ? 1 : 0);
            a.value = unescape(text.slice(a.from, a.to));
          }
          return false;
        }
        case 'Text':
          if (top && n.node.parent?.name === 'Element') {
            const raw = text.slice(n.from, n.to);
            if (raw.trim()) {
              const lead = raw.length - raw.trimStart().length;
              top.text += unescape(raw.trim());
              top.textFrom = n.from + lead;
              top.textTo = n.from + lead + raw.trim().length;
            }
          }
          break;
      }
      return undefined;
    },
    leave(n) {
      if (n.name === 'Element') stack.pop();
    },
  });
  return roots;
}

const kid = (el, name) => el?.children.find((c) => c.name === name) ?? null;
const kidsOf = (el, name) => el?.children.filter((c) => c.name === name) ?? [];
const at = (el, name) => el?.attrs.find((a) => a.name === name) ?? null;
const val = (el, name) => at(el, name)?.value ?? '';

function* walk(els) {
  for (const el of els) {
    yield el;
    yield* walk(el.children);
  }
}

/** Строки таблицы для анализа маркировки; ref — {from, to} для подсветки. */
export function markRowsFromTree(table) {
  const span = (el) => ({ from: el.from, to: el.openTo });
  const textSpan = (el) => (el.textFrom >= 0 ? { from: el.textFrom, to: el.textTo } : span(el));
  return kidsOf(table, 'СведТов').map((row) => {
    const dop = kid(row, 'ДопСведТов');
    const gtin = at(dop, 'ГТИН');
    return {
      num: val(row, 'НомСтр'),
      name: val(row, 'НаимТов'),
      qty: val(row, 'КолТов'),
      okei: val(row, 'ОКЕИ_Тов'),
      gtin: gtin?.value ?? '',
      ref: gtin ? { from: gtin.from, to: gtin.to } : span(row),
      idents: kidsOf(dop, 'НомСредИдентТов').map((g) => {
        const tr = at(g, 'ИдентТрансУпак');
        return {
          ref: span(g),
          kiz: kidsOf(g, 'КИЗ').map((k) => ({ code: k.text, ref: textSpan(k) })),
          packs: kidsOf(g, 'НомУпак').map((k) => ({ code: k.text, ref: textSpan(k) })),
          transport: tr ? { code: tr.value, ref: { from: tr.from, to: tr.to } } : null,
          kolVed: val(g, 'КолВедМарк'),
          party: val(g, 'ПрПартМарк'),
        };
      }),
      gos: kidsOf(dop, 'СвГосСист').map((g) => ({ system: val(g, 'НаимГосСист'), ids: kidsOf(g, 'ИдНомУчетЕд').map((x) => x.text) })),
      trace: kidsOf(dop, 'СведПрослеж').map((t) => ({ rnpt: val(t, 'НомТовПрослеж') })),
    };
  });
}

// ---------------------------------------------------------------- пояснения

function partyName(p) {
  const id = kid(p, 'ИдСв')?.children[0];
  if (!id) return '';
  if (id.name === 'СвЮЛУч') return val(id, 'НаимОрг');
  if (id.name === 'СвИнНеУч') return val(id, 'Наим');
  const fio = kid(id, 'ФИО');
  const name = ['Фамилия', 'Имя', 'Отчество'].map((n) => val(fio, n)).filter(Boolean).join(' ');
  return id.name === 'СвИП' && name ? `ИП ${name}` : name;
}

function partyIds(p) {
  const id = kid(p, 'ИдСв')?.children[0];
  const inn = val(id, 'ИННЮЛ') || val(id, 'ИННФЛ');
  const k = val(id, 'КПП');
  return inn ? `ИНН ${inn}${k ? ` / КПП ${k}` : ''}` : '';
}

const short = (s, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const join = (...parts) => parts.filter(Boolean).join(' · ');

const NOTES = {
  Документ: (el) => join(`Документ: ${val(el, 'Функция') || 'функция не указана'}`, val(el, 'НаимДокОпр') && short(val(el, 'НаимДокОпр'))),
  СвСчФакт: (el) => `Шапка: № ${val(el, 'НомерДок') || '—'} от ${val(el, 'ДатаДок') || '—'}`,
  ИспрДок: (el) => `Исправление № ${val(el, 'НомИспр')} от ${val(el, 'ДатаИспр')} (графа 1а)`,
  СвПрод: (el) => join('Продавец (графы 2–2б)', short(partyName(el)), partyIds(el)),
  ГрузОт: (el) => (kid(el, 'ОнЖе') ? 'Грузоотправитель (графа 3): он же' : join('Грузоотправитель (графа 3)', short(partyName(kid(el, 'ГрузОтпр'))))),
  ГрузПолуч: (el) => join('Грузополучатель (графа 4)', short(partyName(el))),
  СвПРД: () => 'Платёжно-расчётный документ (графа 5)',
  ДокПодтвОтгрНом: () => 'Документ об отгрузке (графа 5а)',
  СвПокуп: (el) => join('Покупатель (графы 6–6б)', short(partyName(el)), partyIds(el)),
  ДенИзм: (el) => `Валюта (графа 7): ${val(el, 'НаимОКВ') || val(el, 'КодОКВ')}`,
  ТаблСчФакт: (el) => `Таблица: строк ${kidsOf(el, 'СведТов').length}`,
  СведТов: (el) => {
    const dop = kid(el, 'ДопСведТов');
    const idents = kidsOf(dop, 'НомСредИдентТов');
    const mark = idents.length && markingSummary({
      kiz: idents.reduce((n, g) => n + kidsOf(g, 'КИЗ').length, 0),
      packs: idents.reduce((n, g) => n + kidsOf(g, 'НомУпак').length, 0),
      transport: idents.filter((g) => at(g, 'ИдентТрансУпак')).length,
      kolVed: idents.filter((g) => at(g, 'КолВедМарк')).length,
    });
    const rnpt = kidsOf(dop, 'СведПрослеж').length;
    return join(
      `Строка ${val(el, 'НомСтр')}`,
      short(val(el, 'НаимТов'), 50),
      val(el, 'СтТовУчНал') && `${val(el, 'СтТовУчНал')} с налогом`,
      mark && `маркировка: ${mark}`,
      rnpt && 'прослеживаемость (РНПТ)',
    );
  },
  НомСредИдентТов: (el) => join('Средства идентификации', markingSummary({
    kiz: kidsOf(el, 'КИЗ').length,
    packs: kidsOf(el, 'НомУпак').length,
    transport: at(el, 'ИдентТрансУпак') ? 1 : 0,
    kolVed: at(el, 'КолВедМарк') ? 1 : 0,
  })),
  ВсегоОпл: (el) => {
    const tax = kid(kid(el, 'СумНалВсего'), 'СумНал')?.text;
    return join('Всего к оплате', `без налога ${val(el, 'СтТовБезНДСВсего') || '—'}`, tax ? `налог ${tax}` : 'без НДС', `с налогом ${val(el, 'СтТовУчНалВсего') || '—'}`);
  },
  СвПродПер: () => 'Передача (графы 8–14)',
  Подписант: (el) => {
    const fio = kid(el, 'ФИО');
    return join('Подписант', val(el, 'Должн'), ['Фамилия', 'Имя', 'Отчество'].map((n) => val(fio, n)).filter(Boolean).join(' '));
  },
};

/**
 * Пояснения над ключевыми элементами.
 * @returns {{pos: number, text: string}[]} pos — начало открывающего тега
 */
export function notes(roots) {
  const out = [];
  for (const el of walk(roots)) {
    const fn = NOTES[el.name];
    if (fn) out.push({ pos: el.from, text: fn(el) });
  }
  return out;
}

// ---------------------------------------------------------------- проверки

/**
 * @typedef {{from: number, to: number, severity: 'error'|'warning'|'info', message: string}} Diag
 */

const FUNCTIONS = ['СЧФ', 'СЧФДОП', 'ДОП', 'СвРК', 'СвЗК'];
const DECIMALS = new Set(['КолТов', 'ЦенаТов', 'СтТовБезНДС', 'СтТовУчНал', 'СтТовБезНДСВсего', 'СтТовУчНалВсего', 'КурсВал', 'СуммаПРД']);

/** Атрибуты типа ДатаТип: все Дата* и РеквДатаДок, кроме специальных. */
const isDateAttr = (name) => /^(Дата|РеквДата)/.test(name);

/** Проверка одного атрибута с учётом элемента. */
function checkAttr(el, a) {
  const v = a.value;
  const p = el.name;
  if (!v) return null;
  if (a.name === 'ИННЮЛ') return check.innUl(v);
  if (a.name === 'ИННФЛ') return check.innFl(v);
  if (a.name === 'КПП') return check.kpp(v);
  if (a.name === 'ОГРНИП') return check.ogrnip(v);
  if (a.name === 'БИК') return check.bik(v);
  if (a.name === 'НомерСчета' && p === 'БанкРекв') return check.account(v, val(kid(el, 'СвБанк'), 'БИК'));
  if (a.name === 'КорСчет' && p === 'СвБанк') return check.corrAccount(v, val(el, 'БИК'));
  if (a.name === 'ВремИнфПр') return check.time(v);
  if (isDateAttr(a.name)) return check.date(v);
  if (DECIMALS.has(a.name)) return check.decimal(v);
  if (a.name === 'НалСт' && p === 'СведТов' && !VAT_RATES.includes(v)) return `Неизвестная ставка. Допустимо: ${VAT_RATES.join(', ')}`;
  if (a.name === 'Функция' && p === 'Документ' && !FUNCTIONS.includes(v)) return `Функция — одно из: ${FUNCTIONS.join(', ')}`;
  return null;
}

function rowOf(el) {
  const tax = kid(kid(el, 'СумНал'), 'СумНал');
  return {
    qty: val(el, 'КолТов'),
    price: val(el, 'ЦенаТов'),
    base: val(el, 'СтТовБезНДС'),
    rate: val(el, 'НалСт'),
    tax: tax?.text ?? '',
    total: val(el, 'СтТовУчНал'),
    taxEl: tax,
  };
}

function mismatch(out, a, expected, what) {
  if (!a || !expected || a.value === expected) return;
  if (Number(a.value) === Number(expected)) return;
  out.push({ from: a.from, to: a.to, severity: 'warning', message: `${what}: по расчёту ${expected}` });
}

/** Арифметика строки: количество × цена, налог по ставке, стоимость с налогом. */
function checkRow(el, out) {
  const r = rowOf(el);
  if (check.decimal(r.base)) return;
  const fromQty = !check.decimal(r.qty) && !check.decimal(r.price);
  const exp = rowAmounts(r, { fromQty });
  if (fromQty) mismatch(out, at(el, 'СтТовБезНДС'), exp.base, 'Количество × цена не равно стоимости без налога');
  const calc = rowAmounts({ ...r, qty: '', price: '' }, { fromQty: false });
  if (r.taxEl && calc.tax && r.tax !== calc.tax && Number(r.tax) !== Number(calc.tax)) {
    out.push({ from: r.taxEl.textFrom, to: r.taxEl.textTo, severity: 'warning', message: `Налог по ставке ${r.rate}: по расчёту ${calc.tax}` });
  }
  if (isNoVat(r.rate) && r.taxEl) {
    out.push({ from: r.taxEl.textFrom, to: r.taxEl.textTo, severity: 'warning', message: `При ставке «${r.rate}» в СумНал должно быть <БезНДС>без НДС</БезНДС>` });
  }
  const noTax = kid(kid(el, 'СумНал'), 'БезНДС');
  if (!isNoVat(r.rate) && r.rate && noTax) {
    out.push({ from: noTax.from, to: noTax.to, severity: 'warning', message: `При ставке «${r.rate}» нужна сумма налога: <СумНал>…</СумНал>` });
  }
  mismatch(out, at(el, 'СтТовУчНал'), calc.total, 'Стоимость с налогом не равна сумме стоимости и налога');
}

/** Итоги ВсегоОпл против суммы строк. */
function checkTotals(table, out) {
  const all = kid(table, 'ВсегоОпл');
  if (!all) return;
  const rows = kidsOf(table, 'СведТов').map(rowOf);
  if (rows.some((r) => check.decimal(r.base) || check.decimal(r.total))) return;
  const t = totals(rows);
  mismatch(out, at(all, 'СтТовБезНДСВсего'), t.base, 'Итог без налога не равен сумме строк');
  mismatch(out, at(all, 'СтТовУчНалВсего'), t.total, 'Итог с налогом не равен сумме строк');
  const tax = kid(kid(all, 'СумНалВсего'), 'СумНал');
  if (tax && t.tax !== null && Number(tax.text) !== Number(t.tax)) {
    out.push({ from: tax.textFrom, to: tax.textTo, severity: 'warning', message: `Налог всего не равен сумме по строкам: ${t.tax}` });
  }
}

const REQUIRED = {
  Файл: ['ИдФайл', 'ВерсФорм', 'ВерсПрог'],
  Документ: ['КНД', 'Функция', 'ДатаИнфПр', 'ВремИнфПр'],
  СвСчФакт: ['НомерДок', 'ДатаДок'],
  СвЮЛУч: ['НаимОрг', 'ИННЮЛ'],
  СвИП: ['ИННФЛ'],
  СведТов: ['НомСтр', 'НалСт'],
  ДенИзм: ['КодОКВ', 'НаимОКВ'],
  ОснПер: ['РеквНаимДок', 'РеквДатаДок'],
  ДокПодтвОтгрНом: ['РеквНаимДок', 'РеквДатаДок'],
  Подписант: ['СпосПодтПолном'],
  ФИО: ['Фамилия', 'Имя'],
};

/**
 * Проверки по всему документу.
 * @param {XEl[]} roots
 * @returns {Diag[]}
 */
export function diagnostics(roots) {
  const out = [];
  const root = roots[0];
  if (root && root.name !== 'Файл') {
    out.push({ from: root.from, to: root.openTo, severity: 'error', message: 'Корневой элемент УПД — «Файл»' });
  }
  for (const el of walk(roots)) {
    for (const a of el.attrs) {
      const msg = checkAttr(el, a);
      if (msg) out.push({ from: a.from, to: Math.max(a.to, a.from), severity: 'error', message: msg });
    }
    for (const name of REQUIRED[el.name] ?? []) {
      const a = at(el, name);
      if (!a || !a.value) {
        out.push({ from: el.from, to: el.openTo, severity: 'error', message: `${el.name}: не заполнен обязательный атрибут ${name}` });
      }
    }
    if (el.name === 'СведТов') checkRow(el, out);
    if (el.name === 'ТаблСчФакт') {
      checkTotals(el, out);
      for (const i of analyzeMarking(markRowsFromTree(el)).issues) out.push({ ...i.ref, severity: i.severity, message: i.message });
    }
  }
  return out;
}

/**
 * Позиция ошибки разбора из сообщения DOMParser (Chrome: «line 5 at column 3»,
 * Firefox: «Line Number 5, Column 3»).
 * @returns {{line: number, column: number}|null}
 */
export function parserErrorPosition(message) {
  const m = /line (\d+) at column (\d+)/i.exec(message) ?? /Line Number (\d+), Column (\d+)/i.exec(message);
  return m ? { line: Number(m[1]), column: Number(m[2]) } : null;
}

/**
 * Chrome (libxml2) отдаёт имена тегов в сообщении об ошибке как UTF-8, прочитанный
 * побайтно («Ð¡Ð²ÐÑÐ¾Ð´» вместо «СвПрод»). Перекодируем такие куски обратно.
 */
export function fixMojibake(message) {
  return message.replace(/[-ÿ]{2,}/g, (run) => {
    const text = new TextDecoder('utf-8').decode(Uint8Array.from(run, (c) => c.charCodeAt(0)));
    return text.includes('�') ? run : text;
  });
}

/** Текст parsererror → короткое сообщение: без служебных фраз Chrome и с нормальной кириллицей. */
export function parserMessage(raw) {
  return fixMojibake(raw)
    .replace(/\s+/g, ' ')
    .replace(/^.*?This page contains the following errors:/, '')
    .replace(/Below is a rendering.*$/, '')
    .trim();
}
