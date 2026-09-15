import { describe, expect, it, vi } from 'vitest';
import { Component, DeclarativeShadowElement } from '@theme/component';

if (!customElements.get('test-component')) {
  customElements.define('test-component', class extends Component {});
}

if (!customElements.get('test-required-refs-component')) {
  customElements.define(
    'test-required-refs-component',
    class extends Component {
      requiredRefs = ['missingRef'];
    }
  );
}

if (!customElements.get('test-shadow-component')) {
  customElements.define('test-shadow-component', class extends DeclarativeShadowElement {});
}

/** Flush the microtask/requestIdleCallback queue used by Component#connectedCallback. */
function flushIdle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Component refs', () => {
  it('collects descendant elements annotated with a ref attribute', async () => {
    document.body.innerHTML = `
      <test-component>
        <button ref="myButton">Click</button>
        <span ref="myText">Hello</span>
      </test-component>
    `;
    const el = document.querySelector('test-component');

    expect(el.refs.myButton).toBeInstanceOf(HTMLButtonElement);
    expect(el.refs.myText).toBeInstanceOf(HTMLSpanElement);
  });

  it('collects array refs when the ref name ends with []', async () => {
    document.body.innerHTML = `
      <test-component>
        <li ref="items[]">1</li>
        <li ref="items[]">2</li>
        <li ref="items[]">3</li>
      </test-component>
    `;
    const el = document.querySelector('test-component');

    expect(Array.isArray(el.refs.items)).toBe(true);
    expect(el.refs.items).toHaveLength(3);
  });

  it('does not collect refs that belong to a nested component', async () => {
    if (!customElements.get('test-nested-component')) {
      customElements.define('test-nested-component', class extends Component {});
    }
    document.body.innerHTML = `
      <test-component>
        <button ref="outer">Outer</button>
        <test-nested-component>
          <button ref="inner">Inner</button>
        </test-nested-component>
      </test-component>
    `;
    const outer = document.querySelector('test-component');
    const inner = document.querySelector('test-nested-component');

    expect(outer.refs.outer).toBeInstanceOf(HTMLElement);
    expect(outer.refs.inner).toBeUndefined();
    expect(inner.refs.inner).toBeInstanceOf(HTMLElement);
  });

  it('throws a descriptive error when a required ref is missing', () => {
    // Call connectedCallback directly (rather than via innerHTML/appendChild) because custom
    // element reaction callbacks report their exceptions asynchronously instead of throwing
    // synchronously to the caller that triggered the upgrade.
    const el = document.createElement('test-required-refs-component');

    expect(() => el.connectedCallback()).toThrow(/Required ref "missingRef" not found/);
  });

  it('updatedCallback re-syncs refs after external DOM mutation', () => {
    document.body.innerHTML = '<test-component><button ref="a">A</button></test-component>';
    const el = document.querySelector('test-component');
    expect(el.refs.a).toBeDefined();

    const newButton = document.createElement('button');
    newButton.setAttribute('ref', 'b');
    el.appendChild(newButton);

    el.updatedCallback();

    expect(el.refs.b).toBeInstanceOf(HTMLButtonElement);
  });
});

describe('Component.roots', () => {
  it('returns just the element itself when there is no shadow root', () => {
    document.body.innerHTML = '<test-component></test-component>';
    const el = document.querySelector('test-component');

    expect(el.roots).toEqual([el]);
  });
});

describe('DeclarativeShadowElement', () => {
  it('does nothing when there is no declarative shadow root template', () => {
    document.body.innerHTML = '<test-shadow-component></test-shadow-component>';
    const el = document.querySelector('test-shadow-component');

    expect(el.shadowRoot).toBeNull();
  });
});

describe('declarative event delegation (on:click etc.)', () => {
  it('invokes the named method on the closest component when the declared event fires', () => {
    if (!customElements.get('test-click-component')) {
      customElements.define(
        'test-click-component',
        class extends Component {
          handleClick = vi.fn();
        }
      );
    }

    document.body.innerHTML = `
      <test-click-component>
        <button on:click="/handleClick">Click</button>
      </test-click-component>
    `;
    const el = document.querySelector('test-click-component');
    const button = document.querySelector('button');

    button.click();

    expect(el.handleClick).toHaveBeenCalledTimes(1);
    expect(el.handleClick.mock.calls[0][0]).toBeInstanceOf(Event);
  });

  it('parses query-string style data from the attribute value and passes it as the first argument', () => {
    if (!customElements.get('test-click-data-component')) {
      customElements.define(
        'test-click-data-component',
        class extends Component {
          handleClick = vi.fn();
        }
      );
    }

    document.body.innerHTML = `
      <test-click-data-component>
        <button on:click="/handleClick?foo=bar&count=3">Click</button>
      </test-click-data-component>
    `;
    document.querySelector('button').click();

    const el = document.querySelector('test-click-data-component');
    expect(el.handleClick).toHaveBeenCalledWith({ foo: 'bar', count: 3 }, expect.any(Event));
  });

  it('does not throw when the target method does not exist', () => {
    document.body.innerHTML = `
      <test-component>
        <button on:click="/doesNotExist">Click</button>
      </test-component>
    `;

    expect(() => document.querySelector('button').click()).not.toThrow();
  });

  it('logs and swallows errors thrown by the invoked handler', () => {
    if (!customElements.get('test-click-throw-component')) {
      customElements.define(
        'test-click-throw-component',
        class extends Component {
          handleClick() {
            throw new Error('boom');
          }
        }
      );
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    document.body.innerHTML = `
      <test-click-throw-component>
        <button on:click="/handleClick">Click</button>
      </test-click-throw-component>
    `;

    expect(() => document.querySelector('button').click()).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
  });
});
