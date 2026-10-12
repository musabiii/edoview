// Форматирование XML по синтаксическому дереву lezer. Значения атрибутов, текст, ссылки
// на символы (&#x…;), комментарии и инструкции переносятся из исходника как есть —
// меняются только отступы и переносы между элементами.

import { xmlLanguage } from '@codemirror/lang-xml';

const TEXTUAL = new Set(['Text', 'EntityReference', 'CharacterReference']);
const RAW = new Set(['Comment', 'ProcessingInst', 'Cdata', 'DoctypeDecl']);

function children(node) {
  const out = [];
  for (let c = node.firstChild; c; c = c.nextSibling) out.push(c);
  return out;
}

/** Первая синтаксическая ошибка: позиция или null. */
function firstError(tree) {
  let pos = null;
  tree.iterate({
    enter(n) {
      if (pos !== null) return false;
      if (n.type.isError || n.name === 'MismatchedCloseTag' || n.name === 'MissingCloseTag') pos = n.from;
      return undefined;
    },
  });
  return pos;
}

/**
 * @param {string} text
 * @param {{indent?: string, width?: number}} [opts]  width — длина строки, после которой атрибуты переносятся
 * @returns {string}
 * @throws {Error & {pos?: number}} если XML не разобрался без ошибок
 */
export function formatXml(text, { indent = '  ', width = 120 } = {}) {
  const tree = xmlLanguage.parser.parse(text);
  const err = firstError(tree);
  if (err !== null) {
    const line = text.slice(0, err).split('\n').length;
    throw Object.assign(new Error(`Не форматирую: в XML ошибка (строка ${line}). Сначала исправьте её.`), { pos: err });
  }

  const lines = [];
  const slice = (n) => text.slice(n.from, n.to);

  function tagHead(tag, pad) {
    const nodes = children(tag);
    const name = slice(nodes.find((n) => n.name === 'TagName'));
    const attrs = nodes.filter((n) => n.name === 'Attribute').map((a) => {
      const parts = children(a);
      const an = parts.find((p) => p.name === 'AttributeName');
      const av = parts.find((p) => p.name === 'AttributeValue');
      return av ? `${slice(an)}=${slice(av)}` : slice(a);
    });
    return { name, attrs, pad };
  }

  /** «<Имя а="1" б="2"» + конец; длинные строки — по атрибуту на строку. */
  function renderTag({ name, attrs, pad }, end) {
    const one = `${pad}<${name}${attrs.map((a) => ` ${a}`).join('')}${end}`;
    if (one.length <= width || attrs.length < 2) return [one];
    const cont = pad + indent + indent;
    return [`${pad}<${name} ${attrs[0]}`, ...attrs.slice(1, -1).map((a) => cont + a), `${cont}${attrs.at(-1)}${end}`];
  }

  function textRun(nodes) {
    return text.slice(nodes[0].from, nodes.at(-1).to).trim();
  }

  function element(node, depth) {
    const pad = indent.repeat(depth);
    const parts = children(node);
    const open = parts[0];
    if (open.name === 'SelfClosingTag') {
      lines.push(...renderTag(tagHead(open, pad), '/>'));
      return;
    }
    const head = tagHead(open, pad);
    const body = parts.slice(1, parts.at(-1)?.name === 'CloseTag' ? -1 : undefined);

    // Только текст: в одну строку <Имя>текст</Имя>.
    if (body.every((n) => TEXTUAL.has(n.name))) {
      const t = body.length ? textRun(body) : '';
      if (!t) {
        lines.push(...renderTag(head, '/>'));
        return;
      }
      const tag = renderTag(head, '>');
      tag[tag.length - 1] += `${t}</${head.name}>`;
      lines.push(...tag);
      return;
    }

    lines.push(...renderTag(head, '>'));
    content(body, depth + 1);
    lines.push(`${pad}</${head.name}>`);
  }

  function content(nodes, depth) {
    const pad = indent.repeat(depth);
    let run = [];
    const flush = () => {
      if (run.length) {
        const t = textRun(run);
        if (t) lines.push(pad + t);
        run = [];
      }
    };
    for (const n of nodes) {
      if (TEXTUAL.has(n.name)) {
        run.push(n);
        continue;
      }
      flush();
      if (n.name === 'Element') element(n, depth);
      else if (RAW.has(n.name)) lines.push(pad + slice(n).trim());
    }
    flush();
  }

  content(children(tree.topNode), 0);
  return `${lines.join('\n')}\n`;
}
