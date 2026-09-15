import { beforeEach, describe, expect, it } from 'vitest';
import '@theme/auto-close-details';

function setInnerWidth(width) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
}

describe('auto-close-details', () => {
  beforeEach(() => {
    setInnerWidth(1024); // desktop by default
  });

  it('closes an open details element matching the current breakpoint when clicking outside it', () => {
    document.body.innerHTML = `
      <details data-auto-close-details="desktop" open>
        <summary>Menu</summary>
        <div id="content">content</div>
      </details>
      <button id="outside">Outside</button>
    `;
    document.getElementById('outside').click();

    expect(document.querySelector('details').hasAttribute('open')).toBe(false);
  });

  it('does not close the details element when the click happens inside it', () => {
    // Click a plain child element rather than <summary>, since clicking <summary> itself
    // triggers the browser's own native open/close toggle independent of this script.
    document.body.innerHTML = `
      <details data-auto-close-details="desktop" open>
        <summary>Menu</summary>
        <div id="inside">content</div>
      </details>
    `;
    document.getElementById('inside').click();

    expect(document.querySelector('details').hasAttribute('open')).toBe(true);
  });

  it('only closes details elements that declare the current breakpoint', () => {
    setInnerWidth(400); // mobile
    document.body.innerHTML = `
      <details id="desktop-only" data-auto-close-details="desktop" open></details>
      <details id="mobile-only" data-auto-close-details="mobile" open></details>
      <button id="outside">Outside</button>
    `;
    document.getElementById('outside').click();

    expect(document.getElementById('desktop-only').hasAttribute('open')).toBe(true);
    expect(document.getElementById('mobile-only').hasAttribute('open')).toBe(false);
  });

  it('supports declaring both breakpoints on the same element', () => {
    document.body.innerHTML = `
      <details data-auto-close-details="mobile desktop" open></details>
      <button id="outside">Outside</button>
    `;
    document.getElementById('outside').click();

    expect(document.querySelector('details').hasAttribute('open')).toBe(false);
  });

  it('ignores details elements without the data-auto-close-details attribute', () => {
    document.body.innerHTML = `
      <details open></details>
      <button id="outside">Outside</button>
    `;
    document.getElementById('outside').click();

    expect(document.querySelector('details').hasAttribute('open')).toBe(true);
  });

  it('ignores details elements that are already closed', () => {
    document.body.innerHTML = `
      <details data-auto-close-details="desktop"></details>
      <button id="outside">Outside</button>
    `;

    expect(() => document.getElementById('outside').click()).not.toThrow();
    expect(document.querySelector('details').hasAttribute('open')).toBe(false);
  });
});
