export function renderVirtualRoot(root, document) {
  const fragment = document.createDocumentFragment();
  const states = [];
  const selects = [];

  function renderNode(node) {
    if (node.type === 'text') {
      return document.createTextNode(node.text);
    }
    const element = document.createElement(node.tag);
    for (const [name, value] of Object.entries(node.attributes)) {
      element.setAttribute(name, value);
    }
    for (const child of node.children) {
      element.appendChild(renderNode(child));
    }
    if (node.formState) {
      states.push([element, node.formState]);
    }
    if (node.tag === 'select') {
      selects.push(element);
    }
    return element;
  }

  for (const child of root.children) {
    fragment.appendChild(renderNode(child));
  }
  for (const [element, state] of states) {
    for (const [property, value] of Object.entries(state)) {
      element[property] = value;
    }
  }
  const optionStates = new Map(states);
  for (const select of selects) {
    if (!select.multiple) {
      const selectedIndex = Array.from(select.options).findIndex((option) => optionStates.get(option)?.selected);
      select.selectedIndex = selectedIndex;
    }
  }
  return fragment;
}
