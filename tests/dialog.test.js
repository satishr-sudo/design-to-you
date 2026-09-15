import { describe, expect, it, vi } from 'vitest';
import { DialogComponent, DialogOpenEvent, DialogCloseEvent } from '@theme/dialog';

function makeDialog(attrs = '') {
  document.body.innerHTML = `
    <dialog-component ${attrs}>
      <dialog ref="dialog"></dialog>
    </dialog-component>
  `;
  return document.querySelector('dialog-component');
}

describe('DialogComponent', () => {
  it('registers the dialog-component custom element', () => {
    expect(customElements.get('dialog-component')).toBeDefined();
  });

  describe('showDialog', () => {
    it('opens the dialog and dispatches a DialogOpenEvent', async () => {
      const el = makeDialog();
      const handler = vi.fn();
      el.addEventListener(DialogOpenEvent.eventName, handler);

      el.showDialog();
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(el.refs.dialog.open).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the dialog is already open', async () => {
      const el = makeDialog();
      el.refs.dialog.setAttribute('open', '');
      const handler = vi.fn();
      el.addEventListener(DialogOpenEvent.eventName, handler);

      el.showDialog();
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('closeDialog', () => {
    it('closes the dialog and dispatches a DialogCloseEvent', async () => {
      const el = makeDialog();
      el.showDialog();
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const handler = vi.fn();
      el.addEventListener(DialogCloseEvent.eventName, handler);

      await el.closeDialog();

      expect(el.refs.dialog.open).toBe(false);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the dialog is already closed', async () => {
      const el = makeDialog();
      const handler = vi.fn();
      el.addEventListener(DialogCloseEvent.eventName, handler);

      await el.closeDialog();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('toggleDialog', () => {
    it('opens a closed dialog', async () => {
      const el = makeDialog();
      el.toggleDialog();
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(el.refs.dialog.open).toBe(true);
    });

    it('closes an open dialog', async () => {
      const el = makeDialog();
      el.showDialog();
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // toggleDialog() does not await closeDialog() itself (fire-and-forget), so wait a tick
      // for the close animation's promise chain to settle.
      el.toggleDialog();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(el.refs.dialog.open).toBe(false);
    });
  });

  describe('minWidth / maxWidth', () => {
    it('reads dialog-active-min-width and dialog-active-max-width attributes', () => {
      const el = makeDialog('dialog-active-min-width="500" dialog-active-max-width="900"');
      expect(el.minWidth).toBe(500);
      expect(el.maxWidth).toBe(900);
    });

    it('defaults to 0 when the attributes are absent', () => {
      const el = makeDialog();
      expect(el.minWidth).toBe(0);
      expect(el.maxWidth).toBe(0);
    });
  });

  describe('closing on outside click / Escape', () => {
    it('closes the dialog when clicking outside of it', async () => {
      const el = makeDialog();
      el.showDialog();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      vi.spyOn(el.refs.dialog, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        right: 100,
        top: 0,
        bottom: 100,
      });

      const clickEvent = new MouseEvent('click', { bubbles: true, clientX: 500, clientY: 500 });
      Object.defineProperty(clickEvent, 'target', { value: el.refs.dialog });
      el.dispatchEvent(clickEvent);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(el.refs.dialog.open).toBe(false);
    });

    it('closes the dialog when Escape is pressed', async () => {
      const el = makeDialog();
      el.showDialog();
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const keyEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      el.dispatchEvent(keyEvent);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(el.refs.dialog.open).toBe(false);
    });

    it('ignores other keys', async () => {
      const el = makeDialog();
      el.showDialog();
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const keyEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      el.dispatchEvent(keyEvent);

      expect(el.refs.dialog.open).toBe(true);
    });
  });
});
