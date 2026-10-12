// Работа с DOM XML УПД 5.03: поиск и создание элементов в порядке XSD, чтение и запись
// реквизитов. Редактор меняет исходный документ на месте, поэтому всё, что он не знает
// (маркировка, транспортировка, доп. сведения), остаётся в файле нетронутым.

import { isNoVat, rowAmounts, totals } from './calc.js';

/** Порядок дочерних элементов по XSD — чтобы новые элементы вставали на своё место. */
const ORDER = {
  Документ: ['СвСчФакт', 'ТаблСчФакт', 'СвПродПер', 'Подписант', 'ОснДоверОргСост'],
  СвСчФакт: ['ИспрДок', 'СвПрод', 'ГрузОт', 'ГрузПолуч', 'СвПРД', 'ДокПодтвОтгрНом', 'СвПокуп', 'ДенИзм', 'ДопСвФХЖ1', 'ИнфПолФХЖ1'],
  Участник: ['ИдСв', 'Адрес', 'БанкРекв', 'Контакт'],
  СвПродПер: ['СвПер'],
  СвПер: ['ОснПер', 'БезДокОснПер', 'СвЛицПер', 'ТранГруз', 'СвПерВещи'],
  БанкРекв: ['СвБанк'],
  Адрес: ['АдрРФ', 'АдрГАР', 'АдрИнф'],
};

const PARTICIPANTS = new Set(['СвПрод', 'СвПокуп', 'ГрузОтпр', 'ГрузПолуч']);

export function kids(el, name) {
  return el ? [...el.children].filter((c) => c.localName === name) : [];
}

export function kid(el, name) {
  if (!el) return null;
  for (const c of el.children) if (c.localName === name) return c;
  return null;
}

/** Путь из имён: path(doc, 'Документ', 'СвСчФакт'). */
export function path(el, ...names) {
  for (const n of names) el = kid(el, n);
  return el;
}

function orderOf(parent) {
  return ORDER[parent.localName] ?? (PARTICIPANTS.has(parent.localName) ? ORDER.Участник : null);
}

function create(parent, name) {
  const doc = parent.ownerDocument;
  return doc.createElementNS(parent.namespaceURI, name);
}

/**
 * Вставляет элемент на место по XSD: после последнего элемента, который идёт раньше
 * по порядку (или того же имени). Отступы копируются у соседей, чтобы файл оставался читаемым.
 */
export function insert(parent, el) {
  const order = orderOf(parent) ?? [];
  const rank = order.indexOf(el.localName);
  let before = null;
  if (rank >= 0) {
    before = [...parent.children].find((c) => {
      const r = order.indexOf(c.localName);
      return r > rank;
    }) ?? null;
  }
  const indent = indentOf(parent);
  if (before) {
    parent.insertBefore(el, before);
    parent.insertBefore(parent.ownerDocument.createTextNode(`\n${indent}  `), before);
  } else {
    const last = parent.lastChild;
    const hadChildren = parent.children.length > 0;
    if (last?.nodeType === 3 && /^\s*$/.test(last.data) && hadChildren) {
      parent.insertBefore(parent.ownerDocument.createTextNode(`\n${indent}  `), last);
      parent.insertBefore(el, last);
    } else {
      parent.append(parent.ownerDocument.createTextNode(`\n${indent}  `), el, parent.ownerDocument.createTextNode(`\n${indent}`));
    }
  }
  return el;
}

function indentOf(el) {
  const prev = el.previousSibling;
  if (prev?.nodeType === 3) {
    const m = /\n([ \t]*)$/.exec(prev.data);
    if (m) return m[1];
  }
  return '';
}

/** Удаляет элемент вместе с отступом перед ним. */
export function removeEl(el) {
  const prev = el.previousSibling;
  if (prev?.nodeType === 3 && /^\s*$/.test(prev.data)) prev.remove();
  el.remove();
}

/** Дочерний элемент; если его нет — создаётся на своём месте. */
export function ensure(parent, ...names) {
  for (const n of names) {
    parent = kid(parent, n) ?? insert(parent, create(parent, n));
  }
  return parent;
}

export function attr(el, name) {
  return el?.getAttribute(name) ?? '';
}

/** Пустое значение удаляет атрибут. */
export function setAttr(el, name, value) {
  if (value === '' || value === null || value === undefined) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

// ---------------------------------------------------------------- части документа

export function parts(doc) {
  const file = doc.documentElement;
  const d = kid(file, 'Документ');
  const hdr = kid(d, 'СвСчФакт');
  return {
    file,
    doc: d,
    hdr,
    table: kid(d, 'ТаблСчФакт'),
    per: path(d, 'СвПродПер', 'СвПер'),
    sellers: kids(hdr, 'СвПрод'),
    buyers: kids(hdr, 'СвПокуп'),
    signers: kids(d, 'Подписант'),
  };
}

// ---------------------------------------------------------------- участник

export const PARTY_KINDS = {
  СвЮЛУч: 'Организация',
  СвИП: 'ИП',
  СвФЛУч: 'Физлицо',
  СвИнНеУч: 'Иностранная',
};

export function partyKind(party) {
  const id = kid(party, 'ИдСв');
  return id?.firstElementChild?.localName ?? null;
}

/** Меняет вид участника (организация ↔ ИП …): ИНН переносится, остальное начинается с нуля. */
export function setPartyKind(party, kind) {
  const id = ensure(party, 'ИдСв');
  const old = id.firstElementChild;
  const inn = old ? attr(old, 'ИННЮЛ') || attr(old, 'ИННФЛ') : '';
  const el = create(id, kind);
  if (kind === 'СвЮЛУч') {
    el.setAttribute('НаимОрг', '');
    if (inn.length === 10) el.setAttribute('ИННЮЛ', inn);
  } else if (kind === 'СвИП' || kind === 'СвФЛУч') {
    if (inn.length === 12) el.setAttribute('ИННФЛ', inn);
    if (kind === 'СвИП' && !el.hasAttribute('ИННФЛ')) el.setAttribute('ИННФЛ', '');
    const fio = old ? kid(old, 'ФИО') : null;
    el.append(fio ? fio.cloneNode(true) : create(id, 'ФИО'));
  } else if (kind === 'СвИнНеУч') {
    el.setAttribute('ИдСтат', 'ИЮЛ');
    el.setAttribute('КодСтр', '');
    el.setAttribute('НаимСтран', '');
    el.setAttribute('Наим', '');
  }
  if (old) old.replaceWith(el);
  else insert(id, el);
}

export function partyName(party) {
  const k = partyKind(party);
  const el = path(party, 'ИдСв', k);
  if (!el) return '';
  if (k === 'СвЮЛУч') return attr(el, 'НаимОрг');
  if (k === 'СвИнНеУч') return attr(el, 'Наим');
  const fio = kid(el, 'ФИО');
  const name = [attr(fio, 'Фамилия'), attr(fio, 'Имя'), attr(fio, 'Отчество')].filter(Boolean).join(' ');
  return k === 'СвИП' && name ? `ИП ${name}` : name;
}

/** Вид адреса участника: АдрИнф (текстом), АдрРФ, АдрГАР или null. */
export function addressKind(party) {
  return kid(party, 'Адрес')?.firstElementChild?.localName ?? null;
}

/** Заменяет адрес на текстовый (АдрИнф), сохраняя ГЛНМеста и т.п. у элемента Адрес. */
export function setTextAddress(party, text) {
  const addr = ensure(party, 'Адрес');
  let inf = kid(addr, 'АдрИнф');
  if (!inf) {
    addr.textContent = '';
    inf = insert(addr, create(addr, 'АдрИнф'));
    inf.setAttribute('КодСтр', '643');
    inf.setAttribute('НаимСтран', 'Россия');
  }
  inf.setAttribute('АдрТекст', text);
}

// ---------------------------------------------------------------- основание и период

/** Документы-основания (ОснПер) или null, если указано «без документа-основания». */
export function basisDocs(per) {
  return kids(per, 'ОснПер');
}

export function addBasis(per) {
  for (const b of kids(per, 'БезДокОснПер')) removeEl(b);
  const el = create(per, 'ОснПер');
  el.setAttribute('РеквНаимДок', 'Договор');
  el.setAttribute('РеквДатаДок', '');
  el.setAttribute('РеквНомерДок', '');
  return insert(per, el);
}

export function setNoBasis(per) {
  for (const b of kids(per, 'ОснПер')) removeEl(b);
  if (!kid(per, 'БезДокОснПер')) {
    const el = create(per, 'БезДокОснПер');
    el.textContent = '1';
    insert(per, el);
  }
}

// ---------------------------------------------------------------- строки

export function readRow(row) {
  return {
    num: attr(row, 'НомСтр'),
    name: attr(row, 'НаимТов'),
    qty: attr(row, 'КолТов'),
    unit: attr(row, 'НаимЕдИзм'),
    okei: attr(row, 'ОКЕИ_Тов'),
    price: attr(row, 'ЦенаТов'),
    base: attr(row, 'СтТовБезНДС'),
    rate: attr(row, 'НалСт'),
    tax: kid(kid(row, 'СумНал'), 'СумНал')?.textContent ?? '',
    total: attr(row, 'СтТовУчНал'),
  };
}

/** Записывает СумНал строки или итога: число или «без НДС». */
function writeTax(parent, tax) {
  const sum = ensureLast(parent, 'СумНал');
  for (const c of [...sum.childNodes]) c.remove();
  const el = create(sum, tax === null ? 'БезНДС' : 'СумНал');
  el.textContent = tax === null ? 'без НДС' : tax;
  sum.append(el);
}

/** СумНал в строке стоит после ДопСведТов/Акциз, СумНалВсего — после атрибутов ВсегоОпл. */
function ensureLast(parent, name) {
  let el = kid(parent, name);
  if (!el) {
    el = create(parent, name);
    const after = kid(parent, 'ИнфПолФХЖ2');
    if (after) parent.insertBefore(el, after);
    else parent.append(el);
  }
  return el;
}

/**
 * Пересчитывает строку после правки (количество × цена → стоимость → налог → с налогом).
 * @param {Element} row
 * @param {{fromQty?: boolean}} [opts]
 */
export function recalcRow(row, opts) {
  const r = readRow(row);
  const out = rowAmounts(r, opts);
  if (out.base !== undefined) setAttr(row, 'СтТовБезНДС', out.base);
  if (isNoVat(r.rate)) writeTax(row, null);
  else if (out.tax !== undefined) writeTax(row, out.tax);
  if (out.total !== undefined) setAttr(row, 'СтТовУчНал', out.total);
}

/** Итоги ВсегоОпл по строкам. */
export function recalcTotals(table) {
  const rows = kids(table, 'СведТов').map(readRow);
  const t = totals(rows);
  const all = kid(table, 'ВсегоОпл') ?? table.appendChild(create(table, 'ВсегоОпл'));
  setAttr(all, 'СтТовБезНДСВсего', t.base);
  setAttr(all, 'СтТовУчНалВсего', t.total);
  const sum = kid(all, 'СумНалВсего') ?? all.appendChild(create(all, 'СумНалВсего'));
  for (const c of [...sum.childNodes]) c.remove();
  const el = create(sum, t.tax === null ? 'БезНДС' : 'СумНал');
  el.textContent = t.tax === null ? 'без НДС' : t.tax;
  sum.append(el);
}

/** Новая строка — копия последней с пустыми значениями (так сохраняются ПрТовРаб и т.п.). */
export function addRow(table) {
  const rows = kids(table, 'СведТов');
  const last = rows.at(-1);
  let row;
  if (last) {
    row = last.cloneNode(true);
    for (const a of ['НаимТов', 'КолТов', 'ЦенаТов', 'СтТовБезНДС', 'СтТовУчНал']) row.removeAttribute(a);
    for (const c of [...row.children]) if (!['ДопСведТов', 'СумНал'].includes(c.localName)) removeEl(c);
    const dop = kid(row, 'ДопСведТов');
    if (dop) for (const a of [...dop.attributes]) if (a.name !== 'ПрТовРаб') dop.removeAttribute(a.name);
    for (const c of dop ? [...dop.children] : []) removeEl(c);
    insertAfter(last, row);
  } else {
    row = create(table, 'СведТов');
    row.setAttribute('НалСт', 'без НДС');
    const before = kid(table, 'ВсегоОпл');
    table.insertBefore(row, before);
  }
  row.setAttribute('НомСтр', String(rows.length + 1));
  writeTax(row, isNoVat(attr(row, 'НалСт')) ? null : '0.00');
  return row;
}

function insertAfter(ref, el) {
  const ws = ref.previousSibling?.nodeType === 3 ? ref.previousSibling.cloneNode() : null;
  const next = ref.nextSibling;
  if (ws) ref.parentNode.insertBefore(ws, next);
  ref.parentNode.insertBefore(el, next);
}

export function removeRow(table, row) {
  removeEl(row);
  kids(table, 'СведТов').forEach((r, i) => r.setAttribute('НомСтр', String(i + 1)));
}

// ---------------------------------------------------------------- вид печатной формы

/** «act» — для ДОП с названием «Акт…», иначе официальная форма УПД. */
export function defaultForm(doc) {
  const d = parts(doc).doc;
  return attr(d, 'Функция') === 'ДОП' && /акт/i.test(attr(d, 'НаимДокОпр')) ? 'act' : 'upd';
}
