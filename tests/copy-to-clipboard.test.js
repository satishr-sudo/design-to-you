import { describe, expect, it, vi } from 'vitest';
import '@theme/copy-to-clipboard';

describe('copy-to-clipboard-component', () => {
  it('registers the custom element', () => {
    expect(customElements.get('copy-to-clipboard-component')).toBeDefined();
  });

  it('copies the text-to-copy attribute to the clipboard', () => {
    document.body.innerHTML = `
      <copy-to-clipboard-component text-to-copy="HELLO-CODE">
        <span ref="copySuccessMessage" class="visually-hidden">Copied!</span>
      </copy-to-clipboard-component>
    `;
    const el = document.querySelector('copy-to-clipboard-component');

    el.copyToClipboard();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('HELLO-CODE');
  });

  it('reveals the success message ref after copying', () => {
    document.body.innerHTML = `
      <copy-to-clipboard-component text-to-copy="ABC">
        <span ref="copySuccessMessage" class="visually-hidden">Copied!</span>
      </copy-to-clipboard-component>
    `;
    const el = document.querySelector('copy-to-clipboard-component');

    el.copyToClipboard();

    expect(el.refs.copySuccessMessage.classList.contains('visually-hidden')).toBe(false);
  });

  it('does nothing when there is no text-to-copy attribute', () => {
    document.body.innerHTML = `<copy-to-clipboard-component></copy-to-clipboard-component>`;
    const el = document.querySelector('copy-to-clipboard-component');

    el.copyToClipboard();

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('does not throw when there is no success message ref', () => {
    document.body.innerHTML = `<copy-to-clipboard-component text-to-copy="X"></copy-to-clipboard-component>`;
    const el = document.querySelector('copy-to-clipboard-component');

    expect(() => el.copyToClipboard()).not.toThrow();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('X');
  });
});
