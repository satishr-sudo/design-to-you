import { describe, expect, it, vi } from 'vitest';
import '@theme/cart-drawer';
import { CartAddEvent } from '@theme/events';
import { DialogOpenEvent, DialogCloseEvent } from '@theme/dialog';

function makeCartDrawer(attrs = '') {
  document.body.innerHTML = `
    <cart-drawer-component ${attrs}>
      <dialog ref="dialog">
        <div class="cart-drawer__content"></div>
        <div class="cart-drawer__summary"></div>
      </dialog>
    </cart-drawer-component>
  `;
  return document.querySelector('cart-drawer-component');
}

describe('cart-drawer-component', () => {
  it('registers the custom element', () => {
    expect(customElements.get('cart-drawer-component')).toBeDefined();
  });

  describe('#handleCartAdd', () => {
    it('opens the drawer on a cart add event when auto-open is set', () => {
      const el = makeCartDrawer('auto-open');
      const showDialogSpy = vi.spyOn(el, 'showDialog').mockImplementation(() => {});

      document.dispatchEvent(new CartAddEvent({}, 'src', {}));

      expect(showDialogSpy).toHaveBeenCalled();
    });

    it('does not open the drawer when auto-open is absent', () => {
      const el = makeCartDrawer();
      const showDialogSpy = vi.spyOn(el, 'showDialog').mockImplementation(() => {});

      document.dispatchEvent(new CartAddEvent({}, 'src', {}));

      expect(showDialogSpy).not.toHaveBeenCalled();
    });

    it('stops listening for cart add events once disconnected', () => {
      const el = makeCartDrawer('auto-open');
      const showDialogSpy = vi.spyOn(el, 'showDialog').mockImplementation(() => {});
      el.disconnectedCallback();

      document.dispatchEvent(new CartAddEvent({}, 'src', {}));

      expect(showDialogSpy).not.toHaveBeenCalled();
    });
  });

  describe('#updateStickyState (via dialog:open)', () => {
    it('marks the summary as sticky when it takes up more than half the drawer height', () => {
      const el = makeCartDrawer();
      vi.spyOn(el.refs.dialog, 'getBoundingClientRect').mockReturnValue({ height: 100 });
      vi.spyOn(el.refs.dialog.querySelector('.cart-drawer__summary'), 'getBoundingClientRect').mockReturnValue({
        height: 60,
      });

      el.dispatchEvent(new DialogOpenEvent());

      expect(el.refs.dialog.getAttribute('cart-summary-sticky')).toBe('false');
    });

    it('marks the summary as not sticky when it takes up less than half the drawer height', () => {
      const el = makeCartDrawer();
      vi.spyOn(el.refs.dialog, 'getBoundingClientRect').mockReturnValue({ height: 100 });
      vi.spyOn(el.refs.dialog.querySelector('.cart-drawer__summary'), 'getBoundingClientRect').mockReturnValue({
        height: 20,
      });

      el.dispatchEvent(new DialogOpenEvent());

      expect(el.refs.dialog.getAttribute('cart-summary-sticky')).toBe('true');
    });

    it('sets sticky to false when there is no summary or content (e.g. empty cart)', () => {
      document.body.innerHTML = `
        <cart-drawer-component>
          <dialog ref="dialog"></dialog>
        </cart-drawer-component>
      `;
      const el = document.querySelector('cart-drawer-component');

      el.dispatchEvent(new DialogOpenEvent());

      expect(el.refs.dialog.getAttribute('cart-summary-sticky')).toBe('false');
    });
  });

  describe('history integration (mobile only)', () => {
    it('pushes cartDrawerOpen history state when opened on mobile', () => {
      globalThis.__setMediaMatches__('(min-width: 750px)', false); // mobile
      const el = makeCartDrawer();
      const pushStateSpy = vi.spyOn(history, 'pushState');

      el.dispatchEvent(new DialogOpenEvent());

      expect(pushStateSpy).toHaveBeenCalledWith({ cartDrawerOpen: true }, '');
    });

    it('does not push history state on desktop', () => {
      globalThis.__setMediaMatches__('(min-width: 750px)', true); // desktop
      const el = makeCartDrawer();
      const pushStateSpy = vi.spyOn(history, 'pushState');

      el.dispatchEvent(new DialogOpenEvent());

      expect(pushStateSpy).not.toHaveBeenCalled();
    });

    it('goes back in history when closed while cartDrawerOpen state is set', () => {
      globalThis.__setMediaMatches__('(min-width: 750px)', false);
      const el = makeCartDrawer();
      el.dispatchEvent(new DialogOpenEvent());
      const backSpy = vi.spyOn(history, 'back').mockImplementation(() => {});

      el.dispatchEvent(new DialogCloseEvent());

      expect(backSpy).toHaveBeenCalled();
    });

    it('clears a stale cartDrawerOpen history entry on connect', () => {
      history.pushState({ cartDrawerOpen: true }, '');
      const replaceStateSpy = vi.spyOn(history, 'replaceState');

      makeCartDrawer();

      expect(replaceStateSpy).toHaveBeenCalledWith(null, '');
      history.replaceState(null, ''); // cleanup for other tests
    });
  });

  describe('open / close', () => {
    it('open() calls showDialog()', () => {
      const el = makeCartDrawer();
      const showDialogSpy = vi.spyOn(el, 'showDialog').mockImplementation(() => {});

      el.open();

      expect(showDialogSpy).toHaveBeenCalled();
    });

    it('close() calls closeDialog()', () => {
      const el = makeCartDrawer();
      const closeDialogSpy = vi.spyOn(el, 'closeDialog').mockImplementation(() => Promise.resolve());

      el.close();

      expect(closeDialogSpy).toHaveBeenCalled();
    });
  });
});
