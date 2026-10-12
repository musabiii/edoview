// Проверка реквизитов по контрольным суммам. XSD проверяет только длину и цифры,
// а опечатку в ИНН или счёте ловит лишь контрольный разряд.

const digits = (s) => [...s].map(Number);
const weighted = (ds, weights) => weights.reduce((sum, w, i) => sum + ds[i] * w, 0);

/** ИНН организации (10 цифр) или физлица/ИП (12 цифр). */
export function isValidInn(inn) {
  if (!/^\d{10}$|^\d{12}$/.test(inn)) return false;
  const d = digits(inn);
  const check = (n, weights) => (weighted(d, weights) % 11) % 10 === d[n];
  if (d.length === 10) return check(9, [2, 4, 10, 3, 5, 9, 4, 6, 8]);
  return check(10, [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) && check(11, [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);
}

/** КПП: 9 символов, 5–6-й могут быть буквами A–Z. */
export function isValidKpp(kpp) {
  return /^\d{4}[\dA-Z]{2}\d{3}$/.test(kpp) && !kpp.startsWith('00');
}

/** ОГРНИП: 15 цифр, последняя = (первые 14 mod 13) mod 10. */
export function isValidOgrnip(ogrnip) {
  if (!/^\d{15}$/.test(ogrnip)) return false;
  return Number((BigInt(ogrnip.slice(0, 14)) % 13n) % 10n) === Number(ogrnip[14]);
}

/** ОГРН организации: 13 цифр, последняя = (первые 12 mod 11) mod 10. */
export function isValidOgrn(ogrn) {
  if (!/^\d{13}$/.test(ogrn)) return false;
  return Number((BigInt(ogrn.slice(0, 12)) % 11n) % 10n) === Number(ogrn[12]);
}

export function isValidBik(bik) {
  return /^\d{9}$/.test(bik);
}

const ACCOUNT_WEIGHTS = [7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1];

/** Расчётный счёт: 20 цифр, ключ проверяется вместе с тремя последними цифрами БИК. */
export function isValidAccount(account, bik) {
  if (!/^\d{20}$/.test(account) || !isValidBik(bik)) return false;
  return weighted(digits(bik.slice(-3) + account), ACCOUNT_WEIGHTS) % 10 === 0;
}

/** Корреспондентский счёт: ключ проверяется с «0» + 5–6-я цифры БИК. */
export function isValidCorrAccount(account, bik) {
  if (!/^\d{20}$/.test(account) || !isValidBik(bik)) return false;
  return weighted(digits('0' + bik.slice(4, 6) + account), ACCOUNT_WEIGHTS) % 10 === 0;
}
