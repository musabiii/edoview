import { isValidAccount, isValidBik, isValidCorrAccount, isValidInn, isValidKpp, isValidOgrnip } from '../lib/requisites.js';
import { addressKind, attr, ensure, kid, PARTY_KINDS, partyKind, path, removeEl, setPartyKind, setTextAddress } from '../lib/upd.js';
import { Attr, Field, Section, Segmented, useEdit } from '../ui.jsx';

const innUl = (v) => (/^\d{10}$/.test(v) ? (isValidInn(v) ? null : 'Неверная контрольная сумма ИНН') : 'ИНН организации — 10 цифр');
const innFl = (v) => (/^\d{12}$/.test(v) ? (isValidInn(v) ? null : 'Неверная контрольная сумма ИНН') : 'ИНН физлица/ИП — 12 цифр');
const kpp = (v) => (isValidKpp(v) ? null : 'КПП — 9 символов, например 770101001');
const ogrnip = (v) => (isValidOgrnip(v) ? null : 'ОГРНИП — 15 цифр с верной контрольной суммой');
const bik = (v) => (isValidBik(v) ? null : 'БИК — 9 цифр');

/** Пустые БанкРекв/СвБанк не оставляем в файле. */
function pruneBank(party) {
  const bank = kid(party, 'БанкРекв');
  if (!bank) return;
  const sv = kid(bank, 'СвБанк');
  if (sv && !sv.attributes.length) removeEl(sv);
  if (!bank.attributes.length && !bank.children.length) removeEl(bank);
}

function Fio({ owner, required }) {
  const fio = kid(owner, 'ФИО');
  const make = () => ensure(owner, 'ФИО');
  return (
    <div class="row">
      <Attr el={fio} make={make} name="Фамилия" label="Фамилия" required={required} />
      <Attr el={fio} make={make} name="Имя" label="Имя" required={required} />
      <Attr el={fio} make={make} name="Отчество" label="Отчество" />
    </div>
  );
}

function Identity({ party }) {
  const kind = partyKind(party);
  const el = path(party, 'ИдСв', kind);
  if (kind === 'СвЮЛУч') {
    return (
      <>
        <Attr el={el} name="НаимОрг" label="Наименование" required wide multiline />
        <div class="row">
          <Attr el={el} name="ИННЮЛ" label="ИНН" required check={innUl} kind="digits" maxLength={10} />
          <Attr el={el} name="КПП" label="КПП" check={kpp} kind="digits" maxLength={9} />
        </div>
      </>
    );
  }
  if (kind === 'СвИП') {
    return (
      <>
        <Fio owner={el} required />
        <div class="row">
          <Attr el={el} name="ИННФЛ" label="ИНН" required check={innFl} kind="digits" maxLength={12} />
          <Attr el={el} name="ОГРНИП" label="ОГРНИП" check={ogrnip} kind="digits" maxLength={15} />
          <Attr el={el} name="ДатаОГРНИП" label="Дата ОГРНИП" kind="date" />
        </div>
      </>
    );
  }
  if (kind === 'СвФЛУч') {
    return (
      <>
        <Fio owner={el} />
        <Attr el={el} name="ИННФЛ" label="ИНН" check={innFl} kind="digits" maxLength={12} />
      </>
    );
  }
  if (kind === 'СвИнНеУч') {
    return (
      <>
        <Attr el={el} name="Наим" label="Наименование" required wide />
        <div class="row">
          <Attr el={el} name="НаимСтран" label="Страна" required />
          <Attr el={el} name="КодСтр" label="Код страны (ОКСМ)" required kind="digits" maxLength={3} />
          <Attr el={el} name="Идентиф" label="Идентификатор" />
        </div>
      </>
    );
  }
  return <p class="field-hint">Нет сведений об участнике (ИдСв).</p>;
}

/** Структурированный адрес одной строкой — так же, как в печатной форме (common.xslt). */
function structuredAddress(party) {
  const a = kid(party, 'Адрес')?.firstElementChild;
  if (!a) return '';
  const out = [];
  const push = (v, prefix = '') => v && out.push(prefix + v);
  if (a.localName === 'АдрРФ') {
    for (const n of ['Индекс', 'НаимРегион', 'Район', 'Город', 'НаселПункт', 'Улица']) push(attr(a, n));
    push(attr(a, 'Дом'), 'д. ');
    push(attr(a, 'Корпус'), 'корп. ');
    push(attr(a, 'Кварт'), 'кв. ');
    push(attr(a, 'ИныеСвед'));
  } else {
    push(attr(a, 'Индекс'));
    push(kid(a, 'НаимРегион')?.textContent);
    for (const c of a.children) {
      const n = c.localName;
      if (n === 'МуниципРайон' || n === 'ГородСелПоселен') push(attr(c, 'Наим'));
      else if (n === 'НаселенПункт') push(`${attr(c, 'Вид')} ${attr(c, 'Наим')}`.trim());
      else if (n === 'ЭлПланСтруктур' || n === 'ЭлУлДорСети') push(`${attr(c, 'Тип')} ${attr(c, 'Наим')}`.trim());
      else if (n === 'ЗемелУчасток') push(c.textContent, 'уч. ');
      else if (n === 'Здание' || n === 'ПомещЗдания' || n === 'ПомещКвартиры') push(`${attr(c, 'Тип')} ${attr(c, 'Номер')}`.trim());
    }
  }
  return out.join(', ');
}

function Address({ party }) {
  const edit = useEdit();
  const kind = addressKind(party);
  if (kind === 'АдрРФ' || kind === 'АдрГАР') {
    return (
      <Field label={`Адрес (${kind === 'АдрГАР' ? 'по ГАР' : 'структурированный'})`} wide hint="Структурированный адрес правится только как текст: кнопка заменит его текстовым (АдрИнф).">
        <div class="readonly">{structuredAddress(party)}</div>
        <button type="button" class="small" onClick={() => edit(() => setTextAddress(party, structuredAddress(party)))}>
          Заменить текстовым адресом
        </button>
      </Field>
    );
  }
  const inf = path(party, 'Адрес', 'АдрИнф');
  return (
    <>
      <Attr
        el={inf}
        make={() => {
          setTextAddress(party, '');
          return path(party, 'Адрес', 'АдрИнф');
        }}
        name="АдрТекст"
        label="Адрес"
        wide
        multiline
      />
      {inf && attr(inf, 'КодСтр') !== '643' && (
        <div class="row">
          <Attr el={inf} name="КодСтр" label="Код страны" required kind="digits" maxLength={3} />
          <Attr el={inf} name="НаимСтран" label="Страна" required />
        </div>
      )}
    </>
  );
}

function Bank({ party }) {
  const bank = kid(party, 'БанкРекв');
  const sv = kid(bank, 'СвБанк');
  const b = attr(sv, 'БИК');
  const makeBank = () => ensure(party, 'БанкРекв');
  const makeSv = () => ensure(party, 'БанкРекв', 'СвБанк');
  const after = () => pruneBank(party);
  return (
    <>
      <div class="row">
        <Attr
          el={bank} make={makeBank} after={after} name="НомерСчета" label="Расчётный счёт" kind="digits" maxLength={20}
          check={(v) => (!/^\d{20}$/.test(v) ? 'Счёт — 20 цифр' : isValidBik(b) && !isValidAccount(v, b) ? 'Счёт не сходится с БИК (контрольный ключ)' : null)}
        />
        <Attr el={sv} make={makeSv} after={after} name="БИК" label="БИК" kind="digits" maxLength={9} check={bik} />
      </div>
      <div class="row">
        <Attr el={sv} make={makeSv} after={after} name="НаимБанк" label="Банк" />
        <Attr
          el={sv} make={makeSv} after={after} name="КорСчет" label="Корр. счёт" kind="digits" maxLength={20}
          check={(v) => (!/^\d{20}$/.test(v) ? 'Корр. счёт — 20 цифр' : isValidBik(b) && !isValidCorrAccount(v, b) ? 'Корр. счёт не сходится с БИК' : null)}
        />
      </div>
    </>
  );
}

export function Party({ party, title }) {
  const edit = useEdit();
  const kind = partyKind(party);
  return (
    <Section title={title} badge={PARTY_KINDS[kind]}>
      <Segmented
        value={kind}
        options={Object.entries(PARTY_KINDS)}
        onChange={(k) => k !== kind && edit(() => setPartyKind(party, k))}
      />
      <Identity party={party} />
      <Address party={party} />
      <h3>Банковские реквизиты</h3>
      <Bank party={party} />
    </Section>
  );
}
