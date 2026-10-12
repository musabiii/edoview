import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { formatXml } from '../app/lib/xmlFormat.js';

test('сжатый XML раскладывается по строкам с отступами', () => {
  const src = '<?xml version="1.0" encoding="windows-1251"?><Файл ИдФайл="x"><Документ А="1"><!-- примечание --><Пусто></Пусто><СумНал><СумНал> 12.00 </СумНал></СумНал><Т>a &amp; b&#xD7;c</Т></Документ></Файл>';
  assert.equal(formatXml(src), [
    '<?xml version="1.0" encoding="windows-1251"?>',
    '<Файл ИдФайл="x">',
    '  <Документ А="1">',
    '    <!-- примечание -->',
    '    <Пусто/>',
    '    <СумНал>',
    '      <СумНал>12.00</СумНал>',
    '    </СумНал>',
    '    <Т>a &amp; b&#xD7;c</Т>',
    '  </Документ>',
    '</Файл>',
    '',
  ].join('\n'));
});

test('длинный тег: атрибуты переносятся по одному', () => {
  const src = `<a><Документ КНД="1115131" Функция="СЧФДОП" ПоФактХЖ="${'x'.repeat(80)}" ДатаИнфПр="12.10.2026"/></a>`;
  assert.equal(formatXml(src), [
    '<a>',
    '  <Документ КНД="1115131"',
    '      Функция="СЧФДОП"',
    `      ПоФактХЖ="${'x'.repeat(80)}"`,
    '      ДатаИнфПр="12.10.2026"/>',
    '</a>',
    '',
  ].join('\n'));
});

test('повторное форматирование ничего не меняет; образцы — тоже', () => {
  for (const name of ['upd-schfdop.xml', 'upd-marking.xml', 'act-dop.xml']) {
    const once = formatXml(readFileSync(new URL(`../samples/${name}`, import.meta.url), 'utf-8'));
    assert.equal(formatXml(once), once, name);
  }
});

test('сломанный XML не форматируется', () => {
  assert.throws(() => formatXml('<a>\n<b></c>\n</a>'), /строка 2/);
  assert.throws(() => formatXml('<a x="1>'), /ошибка/);
});
