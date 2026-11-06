/**
 * Virtual DOM의 기록을 리스트와 현재 위치를 가리키는 포인터로 관리한다.
 * Virtual DOM은 만든 뒤 수정하지 않는 값이므로 복사하지 않고 받은 객체를 그대로 저장하고 돌려준다.
 * 같은 내용인지는 판단하지 않는다. 변경이 없을 때 저장하지 않는 일은 호출하는 쪽이 맡는다.
 */
export class StateHistory {
  /** 저장한 Virtual DOM 목록이다. */
  #entries = [];

  /** 현재 항목의 번호이다. 저장한 항목이 없으면 `-1`이다. */
  #pointer = -1;

  /**
   * Virtual DOM을 저장하고 현재 위치로 삼는다.
   * 뒤로 간 상태에서 저장하면 포인터 뒤의 기록은 지워져서 다시 앞으로 갈 수 없다.
   *
   * @param {VNode} vdom 저장할 Virtual DOM
   * @returns {void}
   */
  push(vdom) {
    this.#entries.length = this.#pointer + 1;
    this.#entries.push(vdom);
    this.#pointer = this.#entries.length - 1;
  }

  /**
   * 현재 위치의 Virtual DOM을 돌려준다. 포인터는 옮기지 않는다.
   *
   * @returns {VNode | undefined} 현재 Virtual DOM. 저장한 항목이 없으면 `undefined`이다.
   */
  current() {
    return this.#entries[this.#pointer];
  }

  /**
   * 포인터를 이전 항목으로 옮기고 그 값을 돌려준다.
   *
   * @returns {VNode | null} 이전 Virtual DOM. 이전 항목이 없으면 `null`이고 포인터는 그대로이다.
   */
  back() {
    if (this.#pointer <= 0) {
      return null;
    }

    this.#pointer -= 1;

    return this.current();
  }

  /**
   * 포인터를 다음 항목으로 옮기고 그 값을 돌려준다.
   *
   * @returns {VNode | null} 다음 Virtual DOM. 다음 항목이 없으면 `null`이고 포인터는 그대로이다.
   */
  forward() {
    if (this.#pointer >= this.#entries.length - 1) {
      return null;
    }

    this.#pointer += 1;

    return this.current();
  }
}
