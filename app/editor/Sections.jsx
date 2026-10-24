import { useState } from 'preact/hooks';

import { VAT_RATES } from '../lib/calc.js';
import { decimal, time } from '../lib/checks.js';
import { markingSummary } from '../lib/marking.js';
import {
  addBasis, addRow, attr, ensure, insert, kid, kids, readRow, recalcRow, recalcTotals, removeEl, removeRow, setNoBasis,
} from '../lib/upd.js';
import { Attr, AttrSelect, Field, Section, Segmented, useEdit } from '../ui.jsx';

const FUNCTIONS = [
  ['СЧФДОП', 'СЧФДОП · статус 1'],
  ['ДОП', 'ДОП · статус 2'],
  ['СЧФ', 'СЧФ · счёт-фактура'],
];

const FUNCTION_HINTS = {
  СЧФДОП: 'Счёт-фактура и передаточный документ (акт) — для плательщиков НДС',
  ДОП: 'Только передаточный документ или акт, без счёта-фактуры',
  СЧФ: 'Только счёт-фактура',
};

const DOC_TITLES = [
  'Документ об отгрузке товаров (выполнении работ), передаче имущественных прав (документ об оказании услуг)',
  'Счет-фактура и документ об отгрузке товаров (выполнении работ), передаче имущественных прав (документ об оказании услуг)',
  'Счет-фактура',
];

const CURRENCIES = [
  ['643', 'Российский рубль'],
  ['840', 'Доллар США'],
  ['978', 'Евро'],
  ['156', 'Китайский юань'],
  ['933', 'Белорусский рубль'],
  ['398', 'Казахстанский тенге'],
];


// ---------------------------------------------------------------- документ

export function DocHeader({ parts }) {
  const { doc, hdr } = parts;
  const cur = kid(hdr, 'ДенИзм');
  return (
    <Section id="doc" title="Документ" badge={attr(doc, 'Функция')}>
      <AttrSelect el={doc} name="Функция" label="Функция" options={FUNCTIONS} required wide hint={FUNCTION_HINTS[attr(doc, 'Функция')]} />
      <div class="row">
        <Attr el={hdr} name="НомерДок" label="Номер документа" required />
        <Attr el={hdr} name="ДатаДок" label="Дата документа" required kind="date" />
      </div>
      <Attr el={doc} name="НаимДокОпр" label="Наименование документа" hint="Например, «Акт выполненных работ (оказанных услуг)» или «Товарная накладная»" wide list="doc-names" />
      <datalist id="doc-names">
        <option value="Акт выполненных работ (оказанных услуг)" />
        <option value="Акт сдачи-приемки выполненных работ" />
        <option value="Товарная накладная" />
        <option value="Универсальный передаточный документ" />
      </datalist>
      <div class="row">
        <AttrSelect
          el={cur} make={() => ensure(hdr, 'ДенИзм')} name="КодОКВ" label="Валюта" required options={CURRENCIES.map(([c, n]) => [c, `${c} — ${n}`])}
          after={(el) => {
            const name = CURRENCIES.find(([c]) => c === attr(el, 'КодОКВ'))?.[1];
            if (name) el.setAttribute('НаимОКВ', name);
          }}
        />
        <Attr el={cur} name="КурсВал" label="Курс валюты" kind="number" hint="Только для иностранной валюты" />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------- дополнительно

/** Редко меняемые реквизиты: исправление, составитель, наименование по ФХЖ, сведения о файле. */
export function Extra({ parts }) {
  const edit = useEdit();
  const { doc, hdr, file } = parts;
  const ispr = kid(hdr, 'ИспрДок');
  return (
    <Section id="extra" title="Дополнительно" open={false}>
      <Attr el={doc} name="ПоФактХЖ" label="Наименование документа по факту хозяйственной жизни" wide multiline list="fhzh" />
      <datalist id="fhzh">{DOC_TITLES.map((t) => <option key={t} value={t} />)}</datalist>

      <h3>Исправление</h3>
      <div class="row">
        <Attr el={ispr} make={() => ensure(hdr, 'ИспрДок')} name="НомИспр" label="№ исправления" kind="digits"
          after={(el) => !el.attributes.length && removeEl(el)} />
        <Attr el={ispr} make={() => ensure(hdr, 'ИспрДок')} name="ДатаИспр" label="Дата исправления" kind="date"
          after={(el) => !el.attributes.length && removeEl(el)} required={!!ispr} />
      </div>
      {ispr && (
        <button type="button" class="link" onClick={() => edit(() => removeEl(ispr))}>Убрать исправление</button>
      )}

      <h3>Составитель</h3>
      <div class="row">
        <Attr el={doc} name="ДатаИнфПр" label="Дата формирования" required kind="date" />
        <Attr el={doc} name="ВремИнфПр" label="Время формирования" required check={time} placeholder="ЧЧ.ММ.СС" />
      </div>
      <Attr el={doc} name="НаимЭконСубСост" label="Экономический субъект — составитель" wide multiline />

      <h3>Файл</h3>
      <Attr el={file} name="ИдФайл" label="Идентификатор файла (ИдФайл)" required wide multiline
        hint="Имя файла при скачивании. В нём закодированы ID участников ЭДО, дата и UUID — меняйте осознанно." />
      <div class="row">
        <Attr el={file} name="ВерсФорм" label="Версия формата" required readOnly />
        <Attr el={file} name="ВерсПрог" label="Версия программы" required />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------- документы-реквизиты (РеквДокТип)

function DocRefs({ items, onAdd, onRemove, addLabel, minItems = 0 }) {
  return (
    <>
      {items.map((el, i) => (
        <div class="ref" key={i}>
          <div class="row">
            <Attr el={el} name="РеквНаимДок" label="Документ" required list="ref-names" />
            <Attr el={el} name="РеквНомерДок" label="Номер" hint="«Без номера», если номера нет" />
            <Attr el={el} name="РеквДатаДок" label="Дата" required kind="date" />
          </div>
          {items.length > minItems && (
            <button type="button" class="link danger" onClick={() => onRemove(el)}>Удалить</button>
          )}
        </div>
      ))}
      <button type="button" class="small" onClick={onAdd}>{addLabel}</button>
    </>
  );
}

export function Basis({ parts }) {
  const edit = useEdit();
  const { doc, hdr } = parts;
  const per = parts.per;
  const fn = attr(doc, 'Функция');
  const mode = attr(per, 'ДатаНачПер') || attr(per, 'ДатаОконПер') ? 'period' : 'date';
  const makePer = () => ensure(doc, 'СвПродПер', 'СвПер');
  const noBasis = !!kid(per, 'БезДокОснПер');
  const shipDocs = kids(hdr, 'ДокПодтвОтгрНом');

  return (
    <Section id="basis" title="Передача и основание">
      <Attr el={per} make={makePer} name="СодОпер" label="Содержание операции" required={fn !== 'СЧФ'} wide multiline
        hint="Например, «Товары переданы» или «Услуги оказаны в полном объеме»" />
      <Field label="Дата отгрузки / оказания услуг" wide>
        <Segmented
          value={mode}
          options={[['date', 'Дата'], ['period', 'Период']]}
          onChange={(m) => edit(() => {
            const p = makePer();
            if (m === 'period') {
              const d = attr(p, 'ДатаПер');
              p.removeAttribute('ДатаПер');
              if (d) {
                p.setAttribute('ДатаНачПер', d);
                p.setAttribute('ДатаОконПер', d);
              }
            } else {
              const d = attr(p, 'ДатаОконПер') || attr(p, 'ДатаНачПер');
              p.removeAttribute('ДатаНачПер');
              p.removeAttribute('ДатаОконПер');
              if (d) p.setAttribute('ДатаПер', d);
            }
          })}
        />
      </Field>
      {mode === 'date' ? (
        <Attr el={per} make={makePer} name="ДатаПер" label="Дата передачи (сдачи)" kind="date" required={fn !== 'СЧФ'} />
      ) : (
        <div class="row">
          <Attr el={per} make={makePer} name="ДатаНачПер" label="Начало периода" kind="date" required />
          <Attr el={per} make={makePer} name="ДатаОконПер" label="Конец периода" kind="date" required />
        </div>
      )}

      <h3>Основание передачи</h3>
      <datalist id="ref-names">
        <option value="Договор" />
        <option value="Счет" />
        <option value="Заказ" />
        <option value="Спецификация" />
        <option value="Товарная накладная" />
        <option value="Универсальный передаточный документ" />
      </datalist>
      <label class="check">
        <input type="checkbox" checked={noBasis} onChange={(e) => edit(() => {
          const p = makePer();
          if (e.currentTarget.checked) setNoBasis(p);
          else addBasis(p);
        })} />
        Без документа-основания
      </label>
      {!noBasis && (
        <DocRefs
          items={kids(per, 'ОснПер')}
          minItems={1}
          addLabel="+ Добавить основание"
          onAdd={() => edit(() => addBasis(makePer()))}
          onRemove={(el) => edit(() => removeEl(el))}
        />
      )}

      <h3>Документ об отгрузке</h3>
      <p class="field-hint">Реквизиты документа, подтверждающего отгрузку (графа 5а). Для УПД обычно сам этот документ.</p>
      <DocRefs
        items={shipDocs}
        addLabel="+ Добавить документ"
        onAdd={() => edit(() => {
          const el = hdr.ownerDocument.createElementNS(hdr.namespaceURI, 'ДокПодтвОтгрНом');
          el.setAttribute('РеквНаимДок', attr(doc, 'НаимДокОпр') || 'Универсальный передаточный документ');
          el.setAttribute('РеквНомерДок', attr(hdr, 'НомерДок'));
          el.setAttribute('РеквДатаДок', attr(hdr, 'ДатаДок'));
          insert(hdr, el);
        })}
        onRemove={(el) => edit(() => removeEl(el))}
      />
    </Section>
  );
}

// ---------------------------------------------------------------- строки

const ROW_LIMIT = 30;

export function Items({ parts, marking }) {
  const edit = useEdit();
  const [auto, setAuto] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const { table } = parts;
  if (!table) return <Section id="items" title="Товары и услуги"><p class="field-hint">В документе нет таблицы (ТаблСчФакт).</p></Section>;

  const rows = kids(table, 'СведТов');
  const all = kid(table, 'ВсегоОпл');
  const shown = showAll ? rows : rows.slice(0, ROW_LIMIT);
  const after = (fromQty) => (row) => {
    if (!auto) return;
    recalcRow(row, { fromQty });
    recalcTotals(table);
  };
  const taxTotal = kid(kid(all, 'СумНалВсего'), 'СумНал')?.textContent;
  const markOf = new Map(marking?.rows.map((m) => [m.row.ref, m]));

  return (
    <Section id="items" title="Товары и услуги" badge={String(rows.length)}>
      <label class="check">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.currentTarget.checked)} />
        Пересчитывать суммы и итоги автоматически
      </label>
      {shown.map((row, i) => <Row key={i} row={row} table={table} auto={auto} after={after} mark={markOf.get(row)} />)}
      {rows.length > shown.length && (
        <button type="button" class="link" onClick={() => setShowAll(true)}>Показать все строки ({rows.length})</button>
      )}
      <div class="actions">
        <button type="button" class="small" onClick={() => edit(() => addRow(table))}>+ Добавить строку</button>
        <button type="button" class="small" onClick={() => edit(() => {
          for (const r of rows) recalcRow(r);
          recalcTotals(table);
        })}>Пересчитать всё</button>
      </div>
      <div class="totals">
        <div><span>Без налога</span><strong>{attr(all, 'СтТовБезНДСВсего') || '—'}</strong></div>
        <div><span>Налог</span><strong>{taxTotal ?? 'без НДС'}</strong></div>
        <div><span>Всего с налогом</span><strong>{attr(all, 'СтТовУчНалВсего') || '—'}</strong></div>
      </div>
      {!auto && (
        <div class="row">
          <Attr el={all} name="СтТовБезНДСВсего" label="Итого без налога" kind="number" />
          <Attr el={all} name="СтТовУчНалВсего" label="Итого с налогом" kind="number" />
        </div>
      )}
    </Section>
  );
}

const num = decimal;

function Row({ row, table, auto, after, mark }) {
  const edit = useEdit();
  const r = readRow(row);
  const taxEl = kid(kid(row, 'СумНал'), 'СумНал');
  return (
    <div class="item">
      <div class="item-head">
        <span>
          Строка {r.num}
          {mark?.marked && <span class="badge mark" title="Есть средства идентификации (НомСредИдентТов)">маркировка: {markingSummary(mark)}</span>}
          {mark?.row.trace.length > 0 && <span class="badge mark">РНПТ</span>}
        </span>
        <button type="button" class="link danger" onClick={() => edit(() => {
          removeRow(table, row);
          if (auto) recalcTotals(table);
        })}>Удалить</button>
      </div>
      <Attr el={row} name="НаимТов" label="Наименование" wide multiline />
      <div class="row">
        <Attr el={row} name="КолТов" label="Количество" kind="number" check={num} after={after(true)} />
        <Attr el={row} name="НаимЕдИзм" label="Ед. изм." />
        <Attr el={row} name="ОКЕИ_Тов" label="Код ОКЕИ" kind="digits" maxLength={4} />
        <Attr el={row} name="ЦенаТов" label="Цена" kind="number" check={num} after={after(true)} />
      </div>
      <div class="row">
        <Attr el={row} name="СтТовБезНДС" label="Стоимость без налога" kind="number" check={num} after={after(false)} />
        <AttrSelect el={row} name="НалСт" label="Ставка" required options={VAT_RATES.map((v) => [v, v])} after={after(false)} />
        {taxEl ? (
          <Field label="Сумма налога">
            <input type="text" inputMode="decimal" value={taxEl.textContent}
              onInput={(e) => edit(() => {
                taxEl.textContent = e.currentTarget.value.replace(/\s/g, '').replace(',', '.');
                after(false)(row);
              })} />
          </Field>
        ) : (
          <Field label="Сумма налога"><div class="readonly">без НДС</div></Field>
        )}
        <Attr el={row} name="СтТовУчНал" label="Стоимость с налогом" kind="number" check={num}
          after={() => auto && recalcTotals(table)} />
      </div>
      {mark?.issues.length > 0 && (
        <ul class="mark-issues">
          {mark.issues.map((i, k) => <li key={k} class={i.severity}>{i.message.replace(/^Строка \d+: /, '')}</li>)}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- подписанты

const POWERS = [
  ['1', '1 — электронная подпись'],
  ['2', '2 — доверенность в электронной форме (МЧД)'],
  ['3', '3 — доверенность в бумажной форме'],
  ['4', '4 — иной документ'],
  ['5', '5 — уполномочен по ЭП и в документе'],
  ['6', '6 — сведения переданы ранее'],
];

export function Signers({ parts }) {
  const edit = useEdit();
  const { doc, signers } = parts;
  return (
    <Section id="signers" title="Подписант" badge={signers.length > 1 ? String(signers.length) : null}>
      {signers.map((s, i) => {
        const fio = kid(s, 'ФИО');
        return (
          <div class={signers.length > 1 ? 'item' : 'stack'} key={i}>
            <Attr el={s} name="Должн" label="Должность" wide />
            <div class="row">
              <Attr el={fio} name="Фамилия" label="Фамилия" required />
              <Attr el={fio} name="Имя" label="Имя" required />
              <Attr el={fio} name="Отчество" label="Отчество" />
            </div>
            <div class="row">
              <AttrSelect el={s} name="СпосПодтПолном" label="Подтверждение полномочий" options={POWERS} required />
              <Attr el={s} name="ДатаПодДок" label="Дата подписания" kind="date" />
            </div>
            {signers.length > 1 && (
              <button type="button" class="link danger" onClick={() => edit(() => removeEl(s))}>Удалить подписанта</button>
            )}
          </div>
        );
      })}
      {!signers.length && (
        <button type="button" class="small" onClick={() => edit(() => {
          const s = ensure(doc, 'Подписант');
          s.setAttribute('СпосПодтПолном', '1');
          ensure(s, 'ФИО');
        })}>+ Добавить подписанта</button>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- файл

// ---------------------------------------------------------------- маркировка

const KIND_LABEL = { kiz: 'КИЗ', packs: 'Упаковка', transport: 'Трансп. упаковка', kolVed: 'Учёт' };

/** Сводка по маркировке и прослеживаемости. Только просмотр: коды правятся во вкладке XML. */
export function Marking({ marking }) {
  if (!marking?.any) return null;
  const { total } = marking;
  const problems = marking.issues.filter((i) => i.severity !== 'info').length;
  return (
    <Section id="marking" title="Маркировка" badge={problems ? `замечаний: ${problems}` : markingSummary(total)}>
      <div class="totals">
        <div><span>Строк с маркировкой</span><strong>{total.markedRows}</strong></div>
        <div><span>Кодов КИЗ</span><strong>{total.kiz}</strong></div>
        <div><span>Упаковок</span><strong>{total.packs + total.transport}</strong></div>
      </div>
      {(total.traceRows > 0 || total.gosRows > 0) && (
        <p class="field-hint">
          {total.traceRows > 0 && `Прослеживаемость (РНПТ): строк ${total.traceRows}. `}
          {total.gosRows > 0 && `Учёт в других ГИС: строк ${total.gosRows}.`}
        </p>
      )}
      {marking.rows.filter((m) => m.marked || m.row.trace.length || m.row.gos.length).map((m) => (
        <details class="item mark-row" key={m.row.num}>
          <summary>
            <span class="mark-title">Строка {m.row.num}. {m.row.name || '—'}</span>
            <span class="mark-sub">
              {[
                m.marked && markingSummary(m),
                (m.row.gtin || m.gtins.length > 0) && `GTIN ${m.row.gtin || m.gtins.join(', ')}`,
                m.row.qty && `кол-во ${m.row.qty}`,
              ].filter(Boolean).join(' · ')}
            </span>
          </summary>
          {m.issues.length > 0 && (
            <ul class="mark-issues">
              {m.issues.map((i, k) => <li key={k} class={i.severity}>{i.message.replace(/^Строка \d+: /, '')}</li>)}
            </ul>
          )}
          <ol class="codes">
            {m.row.idents.flatMap((g) => [
              ...g.kiz.map((c) => ['kiz', c.code]),
              ...g.packs.map((c) => ['packs', c.code]),
              ...(g.transport ? [['transport', g.transport.code]] : []),
              ...(g.kolVed ? [['kolVed', `количество в единицах маркировки: ${g.kolVed}`]] : []),
            ]).map(([kind, code], k) => (
              <li key={k}><span class="kind">{KIND_LABEL[kind]}</span><code>{code}</code></li>
            ))}
            {m.row.trace.map((t, k) => <li key={`t${k}`}><span class="kind">РНПТ</span><code>{t.rnpt}</code></li>)}
            {m.row.gos.map((g, k) => <li key={`g${k}`}><span class="kind">{g.system || 'ГИС'}</span><code>{g.ids.join(', ')}</code></li>)}
          </ol>
        </details>
      ))}
      <p class="field-hint">Коды правятся во вкладке XML. Если кодов нет, это не значит, что товар не маркируется: продавец мог их не передать.</p>
    </Section>
  );
}
