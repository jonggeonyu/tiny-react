import { describe, expect, it } from 'vitest';

describe('테스트 환경', () => {
  it('DOM 요소와 텍스트 노드를 만들 수 있다', () => {
    const element = document.createElement('p');
    element.appendChild(document.createTextNode('안녕'));

    expect(element.outerHTML).toBe('<p>안녕</p>');
  });

  it('template으로 HTML 문자열을 파싱할 수 있다', () => {
    const template = document.createElement('template');
    template.innerHTML = '<ul id="list"><li>사과</li></ul>';

    expect(template.content.firstChild.nodeName).toBe('UL');
    expect(template.content.querySelector('li').textContent).toBe('사과');
  });
});
