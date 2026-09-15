import { describe, expect, it, vi } from 'vitest';
import { VariantSelectedEvent } from '@theme/events';

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
});
