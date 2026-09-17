import { afterEach, describe, expect, it, vi } from 'vitest';
import { CartUpdateEvent, VariantSelectedEvent, VariantUpdateEvent } from '@theme/events';

const { morphMock } = vi.hoisted(() => ({ morphMock: vi.fn() }));
vi.mock('@theme/morph', () => ({ morph: morphMock }));
// variant-picker.js is heavy (morph/utilities/dialog-adjacent DOM work) and is not exercised by
// the QuickAddComponent behavior under test here, so it is mocked to keep this file focused.
vi.mock('@theme/variant-picker', () => ({ default: class {} }));

const { QuickAddComponent } = await import('@theme/quick-add');

function makeQuickAdd({ productOptionsCount = '2' } = {}) {
  document.body.innerHTML = `
    <product-card>
      <a class="product-card-link" href="/products/widget"></a>
      <quick-add-component data-product-options-count="${productOptionsCount}"></quick-add-component>
    </product-card>
  `;
  const productCard = document.querySelector('product-card');
  // Minimal stand-in for ProductCard's own API used by QuickAddComponent.
  productCard.getProductCardLink = () => productCard.querySelector('.product-card-link');
  productCard.getSelectedVariantId = () => null;
  return {
    productCard,
    quickAdd: document.querySelector('quick-add-component'),
  };
}

describe('quick-add-component', () => {
  it('registers the custom element', () => {
    expect(customElements.get('quick-add-component')).toBeDefined();
  });

  describe('#updateQuickAddButtonState (via variant:selected)', () => {
    it('sets data-quick-add-button to "add" when the product has a single option', () => {
      const { quickAdd, productCard } = makeQuickAdd({ productOptionsCount: '1' });
      const event = new VariantSelectedEvent({ id: 'v1' });
      Object.defineProperty(event, 'target', { value: productCard });

      document.dispatchEvent(event);

      expect(quickAdd.getAttribute('data-quick-add-button')).toBe('add');
    });

    it('sets data-quick-add-button to "choose" when the product has multiple options', () => {
      const { quickAdd, productCard } = makeQuickAdd({ productOptionsCount: '2' });
      const event = new VariantSelectedEvent({ id: 'v1' });
      Object.defineProperty(event, 'target', { value: productCard });

      document.dispatchEvent(event);

      expect(quickAdd.getAttribute('data-quick-add-button')).toBe('choose');
    });

    it('ignores events triggered from a different product card', () => {
      const { quickAdd } = makeQuickAdd({ productOptionsCount: '1' });
      const otherCard = document.createElement('product-card');
      document.body.appendChild(otherCard);

      const event = new VariantSelectedEvent({ id: 'v1' });
      Object.defineProperty(event, 'target', { value: otherCard });
      document.dispatchEvent(event);

      expect(quickAdd.hasAttribute('data-quick-add-button')).toBe(false);
    });

    it('ignores events whose target is not an HTMLElement', () => {
      const { quickAdd } = makeQuickAdd();
      const event = new VariantSelectedEvent({ id: 'v1' });
      Object.defineProperty(event, 'target', { value: null });

      expect(() => document.dispatchEvent(event)).not.toThrow();
      expect(quickAdd.hasAttribute('data-quick-add-button')).toBe(false);
    });

    it('stops reacting to variant:selected events once disconnected', () => {
      const { quickAdd, productCard } = makeQuickAdd({ productOptionsCount: '1' });
      quickAdd.disconnectedCallback();

      const event = new VariantSelectedEvent({ id: 'v1' });
      Object.defineProperty(event, 'target', { value: productCard });
      document.dispatchEvent(event);

      // Regression test: previously the listener was added and removed with two separate
      // `.bind(this)` calls, producing different function references, so removeEventListener
      // never actually detached the handler and this assertion would have failed (the button
      // state would still update after "disconnecting").
      expect(quickAdd.hasAttribute('data-quick-add-button')).toBe(false);
    });
  });

  describe('productPageUrl', () => {
    it('returns the product card link href when it already has a variant param', () => {
      const { quickAdd, productCard } = makeQuickAdd();
      productCard.querySelector('.product-card-link').href = 'https://shop.test/products/widget?variant=123';

      expect(quickAdd.productPageUrl).toBe('https://shop.test/products/widget?variant=123');
    });

    it('appends the selected variant id from the product card when available', () => {
      const { quickAdd, productCard } = makeQuickAdd();
      productCard.querySelector('.product-card-link').href = 'https://shop.test/products/widget';
      productCard.getSelectedVariantId = () => '456';

      expect(quickAdd.productPageUrl).toBe('https://shop.test/products/widget?variant=456');
    });

    it('returns an empty string when there is no product card link', () => {
      document.body.innerHTML = '<quick-add-component></quick-add-component>';
      const quickAdd = document.querySelector('quick-add-component');

      expect(quickAdd.productPageUrl).toBe('');
    });
  });

  describe('fetchProductPage', () => {
    it('returns null for an empty url without calling fetch', async () => {
      const { quickAdd } = makeQuickAdd();
      globalThis.fetch = vi.fn();

      const result = await quickAdd.fetchProductPage('');

      expect(result).toBeNull();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('parses a successful response into a Document', async () => {
      const { quickAdd } = makeQuickAdd();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<div data-product-grid-content>Grid</div>'),
      });

      const result = await quickAdd.fetchProductPage('/products/widget');

      expect(result.querySelector('[data-product-grid-content]')).not.toBeNull();
    });

    it('throws a descriptive error on a non-ok response', async () => {
      const { quickAdd } = makeQuickAdd();
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      await expect(quickAdd.fetchProductPage('/products/widget')).rejects.toThrow('HTTP error 500');
    });

    it('returns null when the fetch is aborted', async () => {
      const { quickAdd } = makeQuickAdd();
      const abortError = new DOMException('aborted', 'AbortError');
      globalThis.fetch = vi.fn().mockRejectedValue(abortError);

      const result = await quickAdd.fetchProductPage('/products/widget');

      expect(result).toBeNull();
    });

    it('re-throws non-abort errors', async () => {
      const { quickAdd } = makeQuickAdd();
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

      await expect(quickAdd.fetchProductPage('/products/widget')).rejects.toThrow('network down');
    });

    it('aborts a previous in-flight request when called again', async () => {
      const { quickAdd } = makeQuickAdd();
      const signals = [];
      globalThis.fetch = vi.fn((url, { signal }) => {
        signals.push(signal);
        return new Promise(() => {});
      });

      quickAdd.fetchProductPage('/a');
      quickAdd.fetchProductPage('/b');

      expect(signals[0].aborted).toBe(true);
      expect(signals[1].aborted).toBe(false);
    });
  });

  describe('updateQuickAddModal', () => {
    function makeModalContent() {
      const modalContent = document.createElement('div');
      modalContent.id = 'quick-add-modal-content';
      document.body.appendChild(modalContent);
      return modalContent;
    }

    afterEach(() => {
      globalThis.__setMediaMatches__('(min-width: 750px)', false);
    });

    it('morphs the product grid directly on desktop, without reorganizing it', async () => {
      globalThis.__setMediaMatches__('(min-width: 750px)', true);
      const { quickAdd } = makeQuickAdd();
      makeModalContent();
      const productGrid = document.createElement('div');
      productGrid.innerHTML = '<div class="product-details">Details</div>';

      await quickAdd.updateQuickAddModal(productGrid);

      expect(morphMock).toHaveBeenCalledWith(document.getElementById('quick-add-modal-content'), productGrid);
      expect(productGrid.querySelector('.product-details')).not.toBeNull();
    });

    it('reorganizes the grid into a mobile header before morphing when below the desktop breakpoint', async () => {
      globalThis.__setMediaMatches__('(min-width: 750px)', false);
      const { quickAdd, productCard } = makeQuickAdd();
      productCard.querySelector('.product-card-link').href = 'https://shop.test/products/widget';
      quickAdd.dataset.productTitle = 'Cool Widget';
      makeModalContent();

      const productGrid = document.createElement('div');
      productGrid.innerHTML = `
        <div class="product-details">Details</div>
        <variant-picker></variant-picker>
        <product-price>$10</product-price>
        <product-form-component></product-form-component>
      `;

      await quickAdd.updateQuickAddModal(productGrid);

      expect(productGrid.querySelector('.product-details')).toBeNull();
      const header = productGrid.querySelector('.product-header');
      expect(header).not.toBeNull();
      const titleLink = header.querySelector('a');
      expect(titleLink.textContent).toBe('Cool Widget');
      expect(titleLink.href).toBe('https://shop.test/products/widget');
      expect(header.querySelector('product-price')).not.toBeNull();
      expect(productGrid.querySelector('variant-picker')).not.toBeNull();
      expect(productGrid.querySelector('product-form-component')).not.toBeNull();
      expect(morphMock).toHaveBeenCalledWith(document.getElementById('quick-add-modal-content'), productGrid);
    });

    it('does nothing when there is no modal content in the document', async () => {
      const { quickAdd } = makeQuickAdd();
      const productGrid = document.createElement('div');

      await quickAdd.updateQuickAddModal(productGrid);

      expect(morphMock).not.toHaveBeenCalled();
    });

    it('does nothing when there is no product grid to render', async () => {
      const { quickAdd } = makeQuickAdd();
      makeModalContent();

      await quickAdd.updateQuickAddModal(null);

      expect(morphMock).not.toHaveBeenCalled();
    });

    describe('variant selection syncing', () => {
      it('checks the matching variant radio in the (already-morphed) modal content and fires a change event', async () => {
        const { quickAdd, productCard } = makeQuickAdd();
        productCard.getSelectedVariantId = () => '789';
        const modalContent = makeModalContent();
        modalContent.innerHTML = `
          <input type="radio" data-variant-id="123" />
          <input type="radio" data-variant-id="789" />
        `;
        const target = modalContent.querySelector('[data-variant-id="789"]');
        const changeSpy = vi.fn();
        target.addEventListener('change', changeSpy);

        await quickAdd.updateQuickAddModal(document.createElement('div'));

        expect(target.checked).toBe(true);
        expect(changeSpy).toHaveBeenCalledTimes(1);
      });

      it('does not touch inputs when there is no selected variant', async () => {
        const { quickAdd, productCard } = makeQuickAdd();
        productCard.getSelectedVariantId = () => null;
        const modalContent = makeModalContent();
        modalContent.innerHTML = '<input type="radio" data-variant-id="123" />';

        await expect(quickAdd.updateQuickAddModal(document.createElement('div'))).resolves.toBeUndefined();

        expect(modalContent.querySelector('[data-variant-id="123"]').checked).toBe(false);
      });
    });
  });

  describe('handleClick', () => {
    function makeQuickAddDialog() {
      const dialog = document.createElement('quick-add-dialog');
      dialog.id = 'quick-add-dialog';
      dialog.innerHTML = '<dialog ref="dialog"></dialog>';
      document.body.appendChild(dialog);
      return dialog;
    }

    function clickEvent() {
      return new Event('click', { cancelable: true });
    }

    it('fetches, caches and renders the product grid, then opens the dialog', async () => {
      const { quickAdd, productCard } = makeQuickAdd();
      productCard.querySelector('.product-card-link').href = 'https://shop.test/products/widget';
      const modalContent = document.createElement('div');
      modalContent.id = 'quick-add-modal-content';
      modalContent.innerHTML = '<variant-picker></variant-picker>';
      // variant-picker.js is mocked, so its custom element is never registered; stub the one
      // method QuickAddComponent calls on it directly, as makeQuickAdd() does for ProductCard.
      modalContent.querySelector('variant-picker').updateVariantPicker = vi.fn();
      document.body.appendChild(modalContent);
      const dialog = makeQuickAddDialog();
      const showDialogSpy = vi.spyOn(dialog, 'showDialog');
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<div data-product-grid-content><p>Grid</p></div>'),
      });

      await quickAdd.handleClick(clickEvent());

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(morphMock).toHaveBeenCalled();
      expect(showDialogSpy).toHaveBeenCalledTimes(1);

      // A second click for the same product page URL should reuse the cached content.
      await quickAdd.handleClick(clickEvent());
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(showDialogSpy).toHaveBeenCalledTimes(2);
    });

    it('still opens the dialog when the fetched page has no product grid content', async () => {
      const { quickAdd, productCard } = makeQuickAdd();
      productCard.querySelector('.product-card-link').href = 'https://shop.test/products/widget';
      const dialog = makeQuickAddDialog();
      const showDialogSpy = vi.spyOn(dialog, 'showDialog');
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<div>No grid here</div>'),
      });

      await quickAdd.handleClick(clickEvent());

      expect(morphMock).not.toHaveBeenCalled();
      expect(showDialogSpy).toHaveBeenCalledTimes(1);
    });

    it('clears cached content on a cart update', async () => {
      const { quickAdd, productCard } = makeQuickAdd();
      productCard.querySelector('.product-card-link').href = 'https://shop.test/products/widget';
      const modalContent = document.createElement('div');
      modalContent.id = 'quick-add-modal-content';
      modalContent.innerHTML = '<variant-picker></variant-picker>';
      modalContent.querySelector('variant-picker').updateVariantPicker = vi.fn();
      document.body.appendChild(modalContent);
      makeQuickAddDialog();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<div data-product-grid-content><p>Grid</p></div>'),
      });

      await quickAdd.handleClick(clickEvent());
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      document.dispatchEvent(new CartUpdateEvent({}, 'src'));

      await quickAdd.handleClick(clickEvent());
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('quick-add-dialog', () => {
    function makeQuickAddDialogWithLinks() {
      document.body.innerHTML = `
        <quick-add-dialog id="quick-add-dialog">
          <dialog ref="dialog">
            <div class="view-product-title"><a href="/old"></a></div>
            <div class="product-header"><a href="/old-mobile"></a></div>
          </dialog>
        </quick-add-dialog>
      `;
      return document.querySelector('quick-add-dialog');
    }

    it('registers the custom element', () => {
      expect(customElements.get('quick-add-dialog')).toBeDefined();
    });

    describe('cart:update handling', () => {
      it('closes the dialog when the cart update succeeds', () => {
        const dialog = makeQuickAddDialogWithLinks();
        const closeSpy = vi.spyOn(dialog, 'closeDialog').mockImplementation(() => {});

        dialog.dispatchEvent(new CartUpdateEvent({}, 'src', { didError: false }));

        expect(closeSpy).toHaveBeenCalledTimes(1);
      });

      it('leaves the dialog open when the cart update fails', () => {
        const dialog = makeQuickAddDialogWithLinks();
        const closeSpy = vi.spyOn(dialog, 'closeDialog').mockImplementation(() => {});

        dialog.dispatchEvent(new CartUpdateEvent({}, 'src', { didError: true }));

        expect(closeSpy).not.toHaveBeenCalled();
      });
    });

    describe('variant:update handling', () => {
      it('syncs the "view more details" and mobile title links to the new variant URL', () => {
        const dialog = makeQuickAddDialogWithLinks();
        const html = new DOMParser().parseFromString(
          '<div class="view-product-title"><a href="/products/widget?variant=456"></a></div>',
          'text/html'
        );

        dialog.dispatchEvent(new VariantUpdateEvent({ id: '456' }, 'src', { html, productId: 'p1' }));

        expect(dialog.querySelector('.view-product-title a').href).toContain('/products/widget?variant=456');
        expect(dialog.querySelector('.product-header a').href).toContain('/products/widget?variant=456');
      });

      it('leaves existing links untouched when the new markup has no title link', () => {
        const dialog = makeQuickAddDialogWithLinks();
        const html = new DOMParser().parseFromString('<div>no title here</div>', 'text/html');

        dialog.dispatchEvent(new VariantUpdateEvent({ id: '456' }, 'src', { html, productId: 'p1' }));

        expect(dialog.querySelector('.view-product-title a').getAttribute('href')).toBe('/old');
        expect(dialog.querySelector('.product-header a').getAttribute('href')).toBe('/old-mobile');
      });
    });
  });
});
