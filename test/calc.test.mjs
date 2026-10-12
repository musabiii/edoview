import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rowAmounts, totals } from '../app/lib/calc.js';

test('строка с НДС 22%: количество × цена → налог → итог', () => {
  assert.deepEqual(rowAmounts({ qty: '12', price: '389,50', rate: '22%' }), { base: '4674.00', tax: '1028.28', total: '5702.28' });
});

test('без НДС: налога нет, итог = стоимости', () => {
  const r = rowAmounts({ qty: '2', price: '800', rate: 'без НДС' });
  assert.equal(r.base, '1600.00');
  assert.equal(r.total, '1600.00');
  assert.equal(r.tax, undefined);
});

test('расчётная ставка: налог не пересчитывается, берётся из строки', () => {
  assert.deepEqual(rowAmounts({ base: '1000.00', tax: '166.67', rate: '20/120' }, { fromQty: false }), { tax: '166.67', total: '1166.67' });
});

test('округление половины вверх до копеек', () => {
  assert.equal(rowAmounts({ qty: '3', price: '0.335', rate: '0%' }).base, '1.01');
});

test('итоги: НДС null, если во всех строках без НДС', () => {
  assert.deepEqual(totals([{ base: '1', total: '1', rate: 'без НДС' }, { base: '2.5', total: '2.5', rate: 'без НДС' }]), { base: '3.50', total: '3.50', tax: null });
  assert.deepEqual(totals([{ base: '100', tax: '22', total: '122', rate: '22%' }, { base: '5', total: '5', rate: 'без НДС' }]), { base: '105.00', total: '127.00', tax: '22.00' });
});
