const allowedTags = new Set(['div', 'section', 'p', 'span', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'input', 'textarea', 'select', 'option', 'button', 'label']);
const commonAttributes = new Set(['id', 'class', 'title', 'style']);
const elementAttributes = {
  input: new Set(['type', 'value', 'placeholder', 'checked', 'name', 'disabled']),
  textarea: new Set(['placeholder', 'name', 'disabled']),
  select: new Set(['name', 'disabled', 'multiple']),
  option: new Set(['value', 'selected', 'disabled']),
  button: new Set(['type', 'value', 'name', 'disabled']),
  label: new Set(['for']),
};

const colors = /^(?:black|white|red|green|blue|gray|yellow|orange|purple|transparent|#[0-9a-f]{3}|#[0-9a-f]{6})$/i;
const length = /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)px)$/i;
const styleValues = {
  color: colors,
  'background-color': colors,
  'font-size': length,
  width: length,
  height: length,
  margin: length,
  padding: length,
  'font-weight': /^(?:normal|bold)$/i,
  'text-align': /^(?:left|center|right)$/i,
  display: /^(?:block|inline|inline-block|none)$/i,
  'white-space': /^(?:normal|pre|pre-wrap)$/i,
};

function validateStyle(style) {
  for (const declaration of style.split(';')) {
    if (/^[ \t\n\r\f]*$/.test(declaration)) {
      continue;
    }
    const match = /^[ \t\n\r\f]*([a-z-]+)[ \t\n\r\f]*:[ \t\n\r\f]*([^:]+?)[ \t\n\r\f]*$/i.exec(declaration);
    const rule = match && styleValues[match[1].toLowerCase()];
    if (!rule || !rule.test(match[2])) {
      throw new Error('지원하지 않는 스타일이 있습니다.');
    }
  }
}

function readAttributes(node) {
  const attributes = Object.create(null);
  for (const { name, value } of node.attributes) {
    if (!commonAttributes.has(name) && !elementAttributes[node.localName]?.has(name)) {
      throw new Error(`지원하지 않는 속성입니다: ${name}`);
    }
    if (name === 'style') {
      validateStyle(value);
    }
    if (node.localName === 'input' && name === 'type' && !['text', 'checkbox', 'radio'].includes(value.replace(/[A-Z]/g, (letter) => letter.toLowerCase()))) {
      throw new Error(`지원하지 않는 input 유형입니다: ${value}`);
    }
    attributes[name] = value;
  }
  return Object.freeze(attributes);
}

function readFormState(node) {
  if (node.localName === 'input') {
    if (node.type === 'checkbox' || node.type === 'radio') {
      return Object.freeze({ checked: node.checked });
    }
    return Object.freeze({ value: node.value });
  }
  if (node.localName === 'textarea') {
    return Object.freeze({ value: node.value });
  }
  if (node.localName === 'option') {
    return Object.freeze({ selected: node.selected });
  }
  return null;
}

function convertNode(node) {
  if (node.nodeType === 8) {
    throw new Error('주석은 지원하지 않습니다.');
  }
  if (node.nodeType === 3) {
    return Object.freeze({ type: 'text', tag: null, attributes: Object.freeze({}), text: node.data, children: Object.freeze([]), formState: null });
  }
  if (node.nodeType !== 1 || !allowedTags.has(node.localName)) {
    throw new Error(`지원하지 않는 노드입니다: ${node.localName || node.nodeType}`);
  }
  const attributes = readAttributes(node);
  const children = Object.freeze(Array.from(node.childNodes, convertNode));
  return Object.freeze({ type: 'element', tag: node.localName, attributes, text: null, children, formState: readFormState(node) });
}

export function createVirtualRoot(container) {
  const children = Object.freeze(Array.from(container.childNodes, convertNode));
  return Object.freeze({ type: 'root', tag: null, attributes: Object.freeze({}), text: null, children, formState: null });
}
