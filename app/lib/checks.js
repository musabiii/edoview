// Проверки значений реквизитов: общие для формы и для XML-редактора.
// Каждая возвращает текст ошибки или null.

import { isValidAccount, isValidBik, isValidCorrAccount, isValidInn, isValidKpp, isValidOgrnip } from './requisites.js';

export const innUl = (v) => (/^\d{10}$/.test(v) ? (isValidInn(v) ? null : 'Неверная контрольная сумма ИНН') : 'ИНН организации — 10 цифр');
export const innFl = (v) => (/^\d{12}$/.test(v) ? (isValidInn(v) ? null : 'Неверная контрольная сумма ИНН') : 'ИНН физлица/ИП — 12 цифр');
export const kpp = (v) => (isValidKpp(v) ? null : 'КПП — 9 символов, например 770101001');
export const ogrnip = (v) => (isValidOgrnip(v) ? null : 'ОГРНИП — 15 цифр с верной контрольной суммой');
export const bik = (v) => (isValidBik(v) ? null : 'БИК — 9 цифр');

/** Расчётный счёт; с известным БИК проверяется и контрольный ключ. */
export function account(v, b) {
  if (!/^\d{20}$/.test(v)) return 'Счёт — 20 цифр';
  return isValidBik(b) && !isValidAccount(v, b) ? 'Счёт не сходится с БИК (контрольный ключ)' : null;
}

export function corrAccount(v, b) {
  if (!/^\d{20}$/.test(v)) return 'Корр. счёт — 20 цифр';
  return isValidBik(b) && !isValidCorrAccount(v, b) ? 'Корр. счёт не сходится с БИК' : null;
}

/** ДатаТип: ДД.ММ.ГГГГ, существующая дата. */
export function date(v) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v);
  if (!m) return 'Дата в формате ДД.ММ.ГГГГ';
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? null : 'Такой даты нет';
}

export const time = (v) => (/^([01]\d|2[0-3])\.[0-5]\d\.[0-5]\d$/.test(v) ? null : 'Время в формате ЧЧ.ММ.СС');

export const decimal = (v) => (/^\d+(\.\d+)?$/.test(v) ? null : 'Число с точкой, например 1500.00');
