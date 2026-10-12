import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { xmlLanguage } from '@codemirror/lang-xml';

import { diagnostics, elements, fixMojibake, notes, parserErrorPosition } from '../app/lib/xmlInsight.js';

const sample = (name) => readFileSync(new URL(`../samples/${name}`, import.meta.url), 'utf-8');

function analyze(text) {
  const roots = elements(text, xmlLanguage.parser.parse(text));
  return { roots, notes: notes(roots), diags: diagnostics(roots) };
}

const messages = (diags, text) => diags.map((d) => `${text.slice(d.from, d.to)}: ${d.message}`);

test('примеры из samples проходят проверки без замечаний', () => {
  for (const name of ['upd-schfdop.xml', 'act-dop.xml']) {
    const text = sample(name);
    assert.deepEqual(messages(analyze(text).diags, text), [], name);
  }
});

test('пояснения: стороны, строки, итоги', () => {
  const text = sample('upd-schfdop.xml');
  const n = analyze(text).notes.map((x) => x.text);
  assert.ok(n.includes('Шапка: № СС-0412 от 09.10.2026'));
  assert.ok(n.some((t) => t.startsWith('Продавец (графы 2–2б) · Общество с ограниченной ответственностью «Северный склад» · ИНН 5029000002 / КПП 502901001')));
  assert.ok(n.includes('Грузоотправитель (графа 3): он же'));
  assert.ok(n.includes('Таблица: строк 3'));
  assert.ok(n.some((t) => t.startsWith('Строка 2 · Стрейч-плёнка')));
  assert.ok(n.includes('Всего к оплате · без налога 26174.00 · налог 5758.28 · с налогом 31932.28'));
  // Позиция пояснения — начало открывающего тега.
  const seller = analyze(text).notes.find((x) => x.text.startsWith('Продавец'));
  assert.equal(text.slice(seller.pos, seller.pos + 8), '<СвПрод>');
});

test('проверки: ИНН, счёт, дата, арифметика строки и итогов', () => {
  const text = sample('upd-schfdop.xml')
    .replace('ИННЮЛ="5029000002"', 'ИННЮЛ="5029000003"')
    .replace('НомерСчета="40702810400000001237"', 'НомерСчета="40702810400000001238"')
    .replace('ДатаДок="09.10.2026"', 'ДатаДок="31.02.2026"')
    .replace('КолТов="12"', 'КолТов="13"');
  const m = messages(analyze(text).diags, text);
  assert.ok(m.includes('5029000003: Неверная контрольная сумма ИНН'), m.join('\n'));
  assert.ok(m.includes('40702810400000001238: Счёт не сходится с БИК (контрольный ключ)'));
  assert.ok(m.includes('31.02.2026: Такой даты нет'));
  assert.ok(m.includes('4674.00: Количество × цена не равно стоимости без налога: по расчёту 5063.50'));
});

test('итоги и налог по ставке', () => {
  const text = sample('upd-schfdop.xml')
    .replace('<СумНал>1028.28</СумНал>', '<СумНал>1000.00</СумНал>')
    .replace('СтТовУчНалВсего="31932.28"', 'СтТовУчНалВсего="31932.29"');
  const m = messages(analyze(text).diags, text);
  assert.ok(m.includes('1000.00: Налог по ставке 22%: по расчёту 1028.28'), m.join('\n'));
  assert.ok(m.includes('31932.29: Итог с налогом не равен сумме строк: по расчёту 31932.28'));
});

test('обязательные атрибуты и незаконченный XML не ломают разбор', () => {
  const text = '<Файл ИдФайл="x" ВерсФорм="5.03" ВерсПрог="t"><Документ КНД="1115131" Функция="ДОП" ДатаИнфПр="01.01.2026" ВремИнфПр="25.00.00"><СвСчФакт НомерДок="1"';
  const { diags } = analyze(text);
  const m = messages(diags, text);
  assert.ok(m.some((x) => x.endsWith('Время в формате ЧЧ.ММ.СС')), m.join('\n'));
  assert.ok(m.some((x) => x.endsWith('СвСчФакт: не заполнен обязательный атрибут ДатаДок')));
});

test('позиция ошибки разбора из сообщений Chrome и Firefox', () => {
  assert.deepEqual(parserErrorPosition('error on line 5 at column 13: Opening and ending tag mismatch'), { line: 5, column: 13 });
  assert.deepEqual(parserErrorPosition('XML Parsing Error: mismatched tag\nLine Number 7, Column 3:'), { line: 7, column: 3 });
  assert.equal(parserErrorPosition('что-то другое'), null);
});

test('кириллица в сообщении парсера Chrome восстанавливается', () => {
  const broken = String.fromCharCode(...new TextEncoder().encode('СвПрод'));
  assert.equal(fixMojibake(`tag mismatch: ${broken} line 5`), 'tag mismatch: СвПрод line 5');
  assert.equal(fixMojibake('Ошибка без порчи'), 'Ошибка без порчи');
});
