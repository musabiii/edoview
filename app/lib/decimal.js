// Точная десятичная арифметика на BigInt: суммы в документах нельзя считать во float
// (0.1 + 0.2 !== 0.3). Значение хранится как целое число units и масштаб scale:
// { units: 1805n, scale: 2 } — это 18.05.

const DECIMAL_RE = /^\d+(?:\.\d+)?$/;

/**
 * Разбирает неотрицательное число из строки («1 800,50», «18000.00») или number.
 * @param {string|number} value
 * @returns {{units: bigint, scale: number} | null} null, если это не число
 */
export function parseDecimal(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    value = String(value);
    if (value.includes('e')) return null;
  }
  if (typeof value !== 'string') return null;
  const s = value.replace(/[\s ]/g, '').replace(',', '.');
  if (!DECIMAL_RE.test(s)) return null;
  const [int, frac = ''] = s.split('.');
  return { units: BigInt(int + frac), scale: frac.length };
}

const pow10 = (n) => 10n ** BigInt(n);

function rescale(d, scale) {
  return d.units * pow10(scale - d.scale);
}

export function add(a, b) {
  const scale = Math.max(a.scale, b.scale);
  return { units: rescale(a, scale) + rescale(b, scale), scale };
}

export function multiply(a, b) {
  return { units: a.units * b.units, scale: a.scale + b.scale };
}

/** Округление половины вверх до scale знаков (бухгалтерское, для неотрицательных). */
export function round(d, scale) {
  if (d.scale <= scale) return { units: rescale(d, scale), scale };
  const div = pow10(d.scale - scale);
  let units = d.units / div;
  if ((d.units % div) * 2n >= div) units += 1n;
  return { units, scale };
}

export function isZero(d) {
  return d.units === 0n;
}

/** Количество значащих знаков после запятой (без хвостовых нулей). */
export function significantScale(d) {
  let { units, scale } = d;
  while (scale > 0 && units % 10n === 0n) {
    units /= 10n;
    scale--;
  }
  return scale;
}

/** Количество цифр в целой части. */
export function integerDigits(d) {
  return (d.units / pow10(d.scale)).toString().length;
}

/**
 * Строка в формате xs:decimal: точка, без разделителей разрядов.
 * Хвостовые нули после запятой убираются, но остаётся не меньше minScale знаков.
 */
export function toXsDecimal(d, minScale = 0) {
  const scale = Math.max(significantScale(d), minScale);
  const units = d.scale >= scale ? d.units / pow10(d.scale - scale) : rescale(d, scale);
  const digits = units.toString().padStart(scale + 1, '0');
  return scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}
