// Кодировка windows-1251: XML-файлы ФНС объявлены в ней, а TextEncoder умеет только UTF-8.
// Таблицу строим из TextDecoder, чтобы не хранить её руками.

const byteOf = new Map();
const decoder = new TextDecoder('windows-1251');
for (let b = 0x80; b <= 0xff; b++) {
  const ch = decoder.decode(Uint8Array.of(b));
  if (ch !== '�') byteOf.set(ch.codePointAt(0), b);
}

/** Можно ли записать символ (code point) в windows-1251. */
export function canEncode(codePoint) {
  return codePoint < 0x80 || byteOf.has(codePoint);
}

/**
 * Строку в байты windows-1251. Непредставимые символы — ошибка: в XML их нужно заранее
 * заменить на ссылки &#x…; (это делает сериализатор в xml.js).
 * @param {string} str
 * @returns {Uint8Array}
 */
export function encodeCp1251(str) {
  const out = new Uint8Array(str.length);
  let i = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    const b = cp < 0x80 ? cp : byteOf.get(cp);
    if (b === undefined) throw new RangeError(`Символ U+${cp.toString(16).toUpperCase()} нельзя записать в windows-1251`);
    out[i++] = b;
  }
  return out.subarray(0, i);
}
