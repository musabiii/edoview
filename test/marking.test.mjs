import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { xmlLanguage } from '@codemirror/lang-xml';

import { analyzeMarking, gs1Valid, markingSummary, parseKiz, parseSscc } from '../app/lib/marking.js';
import { diagnostics, elements, markRowsFromTree, notes } from '../app/lib/xmlInsight.js';

const sample = readFileSync(new URL('../samples/upd-marking.xml', import.meta.url), 'utf-8');

function analyze(text) {
  const roots = elements(text, xmlLanguage.parser.parse(text));
  const table = roots[0].children[0].children.find((c) => c.name === 'ТаблСчФакт');
  return { roots, marking: analyzeMarking(markRowsFromTree(table)) };
}

test('GS1: контрольные цифры GTIN и SSCC', () => {
  assert.ok(gs1Valid('04607000123454'));
  assert.ok(!gs1Valid('04607000123455'));
  assert.ok(gs1Valid('4006381333931')); // EAN-13
  assert.deepEqual(parseSscc('00146070001000000124'), { sscc: '146070001000000124', valid: true });
  assert.equal(parseSscc('0104607000543221215GRP'), null);
});

test('разбор КИЗ: полный код, скобки, табак, неизвестный формат', () => {
  assert.deepEqual(parseKiz('0104607000123454215aB3kQ9mXp2Tz'), { gtin: '04607000123454', serial: '5aB3kQ9mXp2Tz', format: 'gs1' });
  assert.deepEqual(parseKiz('(01)04607000123454(21)5aB3kQ'), { gtin: '04607000123454', serial: '5aB3kQ', format: 'gs1' });
  assert.equal(parseKiz('04607000123454AbC1234MRPx').format, 'tobacco');
  assert.equal(parseKiz('XYZ').format, 'unknown');
});

test('пример с маркировкой: сводка и без замечаний', () => {
  const { roots, marking } = analyze(sample);
  assert.deepEqual(marking.total, { markedRows: 2, kiz: 3, packs: 1, transport: 1, kolVed: 0, traceRows: 0, gosRows: 0 });
  assert.deepEqual(marking.issues, []);
  assert.deepEqual(diagnostics(roots), []);
  assert.equal(markingSummary(marking.rows[1]), '1 упаковка · 1 трансп. упаковка');
  const n = notes(roots).map((x) => x.text);
  assert.ok(n.some((t) => t.startsWith('Строка 1 · Футболка') && t.endsWith('маркировка: 3 КИЗ')), n.join('\n'));
});

test('проверки маркировки: дубль, чужой GTIN, количество, пустая группа', () => {
  const text = sample
    .replace('<КИЗ>0104607000123454215aB3kQ9mXp2Ty</КИЗ>', '<КИЗ>0104607000123454215aB3kQ9mXp2Tz</КИЗ>')
    .replace('<КИЗ>0104607000123454215aB3kQ9mXp2Tx</КИЗ>', '<КИЗ>0104607000999990215other</КИЗ>')
    .replace('КолТов="3"', 'КолТов="4"')
    .replace('<ДопСведТов ПрТовРаб="1"/>', '<ДопСведТов ПрТовРаб="1"><НомСредИдентТов/></ДопСведТов>');
  const m = analyze(text).marking.issues.map((i) => `${i.severity}: ${i.message}`);
  assert.deepEqual(m, [
    'error: Строка 1: код повторяется (уже был в строке 1)',
    'warning: Строка 1: неверная контрольная цифра GTIN 04607000999990 в коде маркировки',
    'warning: Строка 1: GTIN кода маркировки не совпадает с ГТИН строки 04607000123454 (кодов: 1)',
    'warning: Строка 1: 3 кода КИЗ, а количество — 4 шт',
    'error: Строка 3: в НомСредИдентТов нет ни КИЗ, ни НомУпак, ни ИдентТрансУпак, ни КолВедМарк',
  ]);
  // Позиции указывают на сам код в тексте.
  const { roots } = analyze(text);
  const dup = diagnostics(roots).find((d) => d.message.includes('повторяется'));
  assert.equal(text.slice(dup.from, dup.to), '0104607000123454215aB3kQ9mXp2Tz');
});
