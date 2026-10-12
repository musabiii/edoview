// Маркировка в УПД 5.03: СведТов/ДопСведТов/НомСредИдентТов (КИЗ, НомУпак, ИдентТрансУпак,
// КолВедМарк), а рядом — СвГосСист (учёт в других ГИС) и СведПрослеж (прослеживаемость, РНПТ).
//
// Анализ работает на нейтральной модели строк, чтобы одинаково обслуживать форму (DOM)
// и XML-редактор (дерево lezer с позициями). ref — то, что адаптер даст для подсветки места.

/**
 * @typedef {{code: string, ref: any}} Code
 * @typedef {{ref: any, kiz: Code[], packs: Code[], transport: Code|null, kolVed: string, party: string}} IdentGroup
 * @typedef {{num: string, name: string, qty: string, okei: string, gtin: string, ref: any,
 *   idents: IdentGroup[], gos: {system: string, ids: string[]}[], trace: {rnpt: string}[]}} MarkRow
 * @typedef {{ref: any, severity: 'error'|'warning'|'info', message: string}} MarkIssue
 */

// ---------------------------------------------------------------- GS1

/** Контрольная цифра GS1 (GTIN-8/12/13/14, SSCC-18): вес 3 у крайней правой цифры данных. */
export function gs1Valid(digits) {
  if (!/^\d{8,18}$/.test(digits)) return false;
  let sum = 0;
  for (let i = digits.length - 2, w = 3; i >= 0; i--, w = 4 - w) sum += Number(digits[i]) * w;
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}

/**
 * Код маркировки → GTIN и серийный номер.
 * Полный код Честного знака: «01» + GTIN(14) + «21» + серийный номер [+ GS + крипто-хвост 91/92/93].
 * Пачка табака: GTIN(14) + серийный номер(7) [+ МРЦ + крипто] — всего 21–29 символов.
 * Встречается и «человекочитаемая» запись со скобками: (01)…(21)….
 * @returns {{gtin: string|null, serial: string, format: 'gs1'|'tobacco'|'unknown'}}
 */
export function parseKiz(code) {
  const s = code.trim().replace(/\((\d{2,4})\)/g, '$1');
  let m = /^01(\d{14})21([^\u001d]+)/.exec(s);
  if (m) return { gtin: m[1], serial: m[2], format: 'gs1' };
  m = /^(\d{14})(.{7})/.exec(s);
  if (m && s.length >= 21 && s.length <= 29) return { gtin: m[1], serial: m[2], format: 'tobacco' };
  return { gtin: null, serial: s, format: 'unknown' };
}

/** SSCC: 18 цифр, иногда с префиксом AI «00». null — не похоже на SSCC (агрегат в формате КИЗ и т.п.). */
export function parseSscc(code) {
  const m = /^(?:00)?(\d{18})$/.exec(code.trim());
  return m ? { sscc: m[1], valid: gs1Valid(m[1]) } : null;
}

// ---------------------------------------------------------------- анализ

/** Единицы, где один КИЗ — одна единица количества: штука, пара. */
const PIECE_UNITS = new Set(['796', '715']);

const plural = (n, one, few, many) => {
  const r100 = n % 100;
  const r10 = n % 10;
  if (r100 >= 11 && r100 <= 14) return many;
  if (r10 === 1) return one;
  if (r10 >= 2 && r10 <= 4) return few;
  return many;
};

export const codesWord = (n) => `${n} ${plural(n, 'код', 'кода', 'кодов')}`;

/**
 * @param {MarkRow[]} rows
 */
export function analyzeMarking(rows) {
  const seen = new Map();
  const issues = [];
  const out = [];
  const total = { markedRows: 0, kiz: 0, packs: 0, transport: 0, kolVed: 0, traceRows: 0, gosRows: 0 };

  for (const row of rows) {
    const kiz = row.idents.flatMap((g) => g.kiz);
    const packs = row.idents.flatMap((g) => g.packs);
    const transport = row.idents.map((g) => g.transport).filter(Boolean);
    const kolVed = row.idents.filter((g) => g.kolVed);
    const rowIssues = [];
    const add = (ref, severity, message) => {
      const i = { ref, severity, message: `Строка ${row.num}: ${message}` };
      rowIssues.push(i);
      issues.push(i);
    };

    for (const g of row.idents) {
      if (!g.kiz.length && !g.packs.length && !g.transport && !g.kolVed) {
        add(g.ref, 'error', 'в НомСредИдентТов нет ни КИЗ, ни НомУпак, ни ИдентТрансУпак, ни КолВедМарк');
      }
    }

    // Дубли — по всему документу: один код не может уйти дважды.
    for (const c of [...kiz, ...packs, ...transport]) {
      const prev = seen.get(c.code);
      if (prev) add(c.ref, 'error', `код повторяется (уже был в строке ${prev})`);
      else seen.set(c.code, row.num);
    }

    // GTIN кодов против ГТИН строки и контрольные цифры.
    const parsed = kiz.map((c) => ({ c, p: parseKiz(c.code) }));
    const gtins = new Set(parsed.map(({ p }) => p.gtin).filter(Boolean));
    const unknown = parsed.filter(({ p }) => p.format === 'unknown');
    if (unknown.length) {
      add(unknown[0].c.ref, 'info', `формат кода не распознан (${codesWord(unknown.length)}): ожидается 01 + GTIN(14) + 21 + серийный номер`);
    }
    const badGtin = [...gtins].filter((g) => !gs1Valid(g));
    if (badGtin.length) {
      const first = parsed.find(({ p }) => p.gtin === badGtin[0]);
      add(first.c.ref, 'warning', `неверная контрольная цифра GTIN ${badGtin[0]} в коде маркировки`);
    }
    if (row.gtin) {
      if (!gs1Valid(row.gtin)) add(row.ref, 'warning', `неверная контрольная цифра ГТИН ${row.gtin}`);
      const other = parsed.filter(({ p }) => p.gtin && p.gtin !== row.gtin.padStart(14, '0'));
      if (other.length) {
        add(other[0].c.ref, 'warning', `GTIN кода маркировки не совпадает с ГТИН строки ${row.gtin} (кодов: ${other.length})`);
      }
    }
    for (const c of transport) {
      const s = parseSscc(c.code);
      if (s && !s.valid) add(c.ref, 'warning', `неверная контрольная цифра SSCC ${s.sscc}`);
    }

    // Поштучный товар: кодов столько же, сколько единиц.
    const qty = Number(row.qty);
    if (kiz.length && !packs.length && !transport.length && PIECE_UNITS.has(row.okei) && Number.isFinite(qty) && qty !== kiz.length) {
      add(kiz[0].ref, 'warning', `${codesWord(kiz.length)} КИЗ, а количество — ${row.qty} ${row.okei === '715' ? 'пар' : 'шт'}`);
    }

    const marked = row.idents.length > 0;
    if (marked) total.markedRows++;
    if (row.trace.length) total.traceRows++;
    if (row.gos.length) total.gosRows++;
    total.kiz += kiz.length;
    total.packs += packs.length;
    total.transport += transport.length;
    total.kolVed += kolVed.length;
    out.push({ row, marked, kiz: kiz.length, packs: packs.length, transport: transport.length, kolVed: kolVed.length, gtins: [...gtins], issues: rowIssues });
  }
  return { rows: out, total, issues, any: total.markedRows + total.traceRows + total.gosRows > 0 };
}

/** «52 КИЗ · 1 упаковка · 1 трансп.» — для бейджей и пояснений. */
export function markingSummary({ kiz, packs, transport, kolVed }) {
  const parts = [];
  if (kiz) parts.push(`${kiz} КИЗ`);
  if (packs) parts.push(`${packs} ${plural(packs, 'упаковка', 'упаковки', 'упаковок')}`);
  if (transport) parts.push(`${transport} трансп. ${plural(transport, 'упаковка', 'упаковки', 'упаковок')}`);
  if (kolVed) parts.push('учёт по количеству');
  return parts.join(' · ');
}

// ---------------------------------------------------------------- адаптер DOM

const elKids = (el, name) => (el ? [...el.children].filter((c) => c.localName === name) : []);
const elKid = (el, name) => elKids(el, name)[0] ?? null;
const elAttr = (el, name) => el?.getAttribute(name) ?? '';

/** Строки таблицы из DOM документа (для формы). ref — сам элемент. */
export function rowsFromDom(table) {
  return elKids(table, 'СведТов').map((row) => {
    const dop = elKid(row, 'ДопСведТов');
    return {
      num: elAttr(row, 'НомСтр'),
      name: elAttr(row, 'НаимТов'),
      qty: elAttr(row, 'КолТов'),
      okei: elAttr(row, 'ОКЕИ_Тов'),
      gtin: elAttr(dop, 'ГТИН'),
      ref: row,
      idents: elKids(dop, 'НомСредИдентТов').map((g) => ({
        ref: g,
        kiz: elKids(g, 'КИЗ').map((k) => ({ code: k.textContent.trim(), ref: k })),
        packs: elKids(g, 'НомУпак').map((k) => ({ code: k.textContent.trim(), ref: k })),
        transport: g.hasAttribute('ИдентТрансУпак') ? { code: elAttr(g, 'ИдентТрансУпак'), ref: g } : null,
        kolVed: elAttr(g, 'КолВедМарк'),
        party: elAttr(g, 'ПрПартМарк'),
      })),
      gos: elKids(dop, 'СвГосСист').map((g) => ({ system: elAttr(g, 'НаимГосСист'), ids: elKids(g, 'ИдНомУчетЕд').map((x) => x.textContent.trim()) })),
      trace: elKids(dop, 'СведПрослеж').map((t) => ({ rnpt: elAttr(t, 'НомТовПрослеж') })),
    };
  });
}
