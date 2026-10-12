// Пересчёт сумм строк и итогов УПД. Только строки xs:decimal на входе и выходе,
// внутри — точная арифметика на BigInt (decimal.js).

import { add, multiply, parseDecimal, round, toXsDecimal } from './decimal.js';

export const VAT_RATES = [
  'без НДС', '0%', '5%', '7%', '10%', '20%', '22%',
  '9,09%', '16,67%', '18%', '18,03%', '5/105', '7/107', '10/110', '18/118', '20/120', '22/122',
  'НДС исчисляется налоговым агентом',
];

/** Ставки без суммы налога в строке (СумНал/БезНДС). */
export function isNoVat(rate) {
  return rate === 'без НДС' || rate === 'НДС исчисляется налоговым агентом';
}

/**
 * Ставка в процентах как десятичная дробь, если по ней можно посчитать налог от стоимости
 * без налога («20%» → 0.20). Расчётные ставки (20/120, 16,67% …) берутся от суммы с налогом —
 * их не пересчитываем, налог в строке остаётся как есть.
 */
function plainPercent(rate) {
  if (!/^(0|5|7|10|18|20|22)%$/.test(rate)) return null;
  const p = parseDecimal(rate.slice(0, -1));
  return { units: p.units, scale: p.scale + 2 };
}

export function normalizeNumber(s) {
  return String(s ?? '').replace(/[\s ]/g, '').replace(',', '.');
}

export function money(d) {
  return toXsDecimal(round(d, 2), 2);
}

/**
 * Суммы строки.
 * @param {{qty?: string, price?: string, base?: string, tax?: string, rate: string}} row
 * @param {{fromQty?: boolean}} [opts]  fromQty — стоимость = количество × цена
 * @returns {{base?: string, tax?: string, total?: string}} только то, что удалось посчитать
 */
export function rowAmounts(row, { fromQty = true } = {}) {
  const out = {};
  let base = parseDecimal(normalizeNumber(row.base));
  if (fromQty) {
    const qty = parseDecimal(normalizeNumber(row.qty));
    const price = parseDecimal(normalizeNumber(row.price));
    if (qty && price) {
      base = round(multiply(qty, price), 2);
      out.base = money(base);
    }
  }
  if (!base) return out;

  let tax = null;
  if (isNoVat(row.rate)) {
    out.tax = undefined;
  } else {
    const p = plainPercent(row.rate);
    tax = p ? round(multiply(base, p), 2) : parseDecimal(normalizeNumber(row.tax));
    if (tax) out.tax = money(tax);
  }
  out.total = money(tax ? add(base, tax) : base);
  return out;
}

/**
 * Итоги по строкам.
 * @param {{base?: string, tax?: string, total?: string, rate: string}[]} rows
 * @returns {{base: string, total: string, tax: string|null}} tax null — во всех строках «без НДС»
 */
export function totals(rows) {
  const zero = { units: 0n, scale: 2 };
  let base = zero;
  let total = zero;
  let tax = zero;
  let anyVat = false;
  for (const r of rows) {
    base = add(base, parseDecimal(normalizeNumber(r.base)) ?? zero);
    total = add(total, parseDecimal(normalizeNumber(r.total)) ?? zero);
    if (!isNoVat(r.rate)) {
      anyVat = true;
      tax = add(tax, parseDecimal(normalizeNumber(r.tax)) ?? zero);
    }
  }
  return { base: money(base), total: money(total), tax: anyVat ? money(tax) : null };
}
