// Замечания по всему документу для шапки и навигации: те же проверки, что в XML-редакторе,
// но по DOM формы и с привязкой к разделам редактора.

import { ATTRIBUTES } from './glossary.js';
import { diagnostics, elementsFromDom } from './xmlInsight.js';

const TITLES = {
  doc: 'Документ',
  seller: 'Продавец',
  buyer: 'Покупатель',
  items: 'Товары и услуги',
  marking: 'Маркировка',
  basis: 'Передача и основание',
  signers: 'Подписант',
  extra: 'Дополнительно',
};

/** Порядок разделов в редакторе — так же сортируем замечания и навигацию. */
export const SECTION_ORDER = ['doc', 'seller', 'buyer', 'items', 'marking', 'basis', 'signers', 'extra'];

/** «seller-1» → «Продавец 2». */
export function sectionTitle(id) {
  const [base, i] = id.split('-');
  const t = TITLES[base] ?? id;
  return i && i !== '0' ? `${t} ${Number(i) + 1}` : t;
}

const sectionRank = (id) => SECTION_ORDER.indexOf(id.split('-')[0]) * 100 + Number(id.split('-')[1] ?? 0);

/** Короткое название реквизита: «ИНН организации (10 цифр)» → «ИНН организации». */
function label(attr) {
  const s = ATTRIBUTES[attr];
  return s ? s.replace(/\s*\(.*$/, '').replace(/\s+—.*$/, '').replace(/:.*$/, '') : attr;
}

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

function humanize(d) {
  if (/не заполнен обязательный атрибут/.test(d.message)) return `Не заполнено: ${lowerFirst(label(d.attr))}`;
  if (d.attr) return `${label(d.attr)}: ${lowerFirst(d.message)}`;
  return d.message;
}

/**
 * @param {Document} doc
 * @returns {{severity: string, text: string, section: string}[]} по порядку разделов
 */
export function documentIssues(doc) {
  return diagnostics(elementsFromDom(doc))
    .map((d) => ({ severity: d.severity, section: d.section ?? 'doc', text: humanize(d) }))
    .sort((a, b) => sectionRank(a.section) - sectionRank(b.section));
}

/** Сколько замечаний (без «info») в каждом разделе. */
export function countBySection(issues) {
  const m = new Map();
  for (const i of issues) if (i.severity !== 'info') m.set(i.section, (m.get(i.section) ?? 0) + 1);
  return m;
}

export function plural(n, one, few, many) {
  const r100 = n % 100;
  const r10 = n % 10;
  if (r100 >= 11 && r100 <= 14) return many;
  if (r10 === 1) return one;
  if (r10 >= 2 && r10 <= 4) return few;
  return many;
}

export const issuesWord = (n) => `${n} ${plural(n, 'замечание', 'замечания', 'замечаний')}`;
