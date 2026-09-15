import { describe, expect, it, vi } from 'vitest';
import { VariantUpdateEvent } from '@theme/events';

const { morphMock } = vi.hoisted(() => ({ morphMock: vi.fn() }));
vi.mock('@theme/morph', () => ({ morph: morphMock }));

await import('@theme/local-pickup');

function makeLocalPickup({ productUrl = '/products/widget', sectionId = 'sec-1' } = {}) {
  document.body.innerHTML = `
    <div class="shopify-section">
      <local-pickup data-product-url="${productUrl}" data-section-id="${sectionId}" hidden></local-pickup>
    </div>
  `;
  return {
    section: document.querySelector('.shopify-section'),
    pickup: document.querySelector('local-pickup'),
  };
}

function dispatchVariantUpdate(section, resource, data = {}) {
  const event = new VariantUpdateEvent(resource, 'source', { html: document, productId: 'p1', ...data });
  Object.defineProperty(event, 'target', { value: section });
  section.dispatchEvent(event);
  return event;
}

/** Flushes all pending microtasks (promise chains), unlike a fixed number of `await Promise.resolve()` hops. */
function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('local-pickup', () => {
  it('registers the custom element', () => {
    expect(customElements.get('local-pickup')).toBeDefined();
  });

  it('reveals itself and fetches availability when an available variant is selected', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ text: () => Promise.resolve('<local-pickup data-variant-id="v1">Pickup available</local-pickup>') });
    const { section, pickup } = makeLocalPickup();

    dispatchVariantUpdate(section, { id: 'v1', available: true });
    await flushPromises();

    expect(pickup.hasAttribute('hidden')).toBe(false);
    expect(pickup.dataset.variantId).toBe('v1');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/products/widget?variant=v1&section_id=sec-1',
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it('hides itself when the selected variant is unavailable', () => {
    const { section, pickup } = makeLocalPickup();
    pickup.removeAttribute('hidden');

    dispatchVariantUpdate(section, { id: 'v2', available: false });

    expect(pickup.hasAttribute('hidden')).toBe(true);
  });

  it('hides itself when there is no resource on the event', () => {
    const { section, pickup } = makeLocalPickup();
    pickup.removeAttribute('hidden');

    dispatchVariantUpdate(section, null);

    expect(pickup.hasAttribute('hidden')).toBe(true);
  });

  it('does nothing when the variant id has not changed', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ text: () => Promise.resolve('') });
    const { section, pickup } = makeLocalPickup();
    pickup.dataset.variantId = 'v1';

    dispatchVariantUpdate(section, { id: 'v1', available: true });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('hides itself when the fetch resolves with no matching local-pickup markup', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ text: () => Promise.resolve('<div>no pickup</div>') });
    const { section, pickup } = makeLocalPickup();

    dispatchVariantUpdate(section, { id: 'v3', available: true });
    await flushPromises();

    expect(pickup.hasAttribute('hidden')).toBe(true);
  });

  it('hides itself when the fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));
    const { section, pickup } = makeLocalPickup();

    dispatchVariantUpdate(section, { id: 'v4', available: true });
    await flushPromises();

    expect(pickup.hasAttribute('hidden')).toBe(true);
  });

  it('adopts the new product url from a combined-listing update', () => {
    const { section, pickup } = makeLocalPickup();

    dispatchVariantUpdate(section, null, { newProduct: { id: 'p2', url: '/products/new-widget' } });

    expect(pickup.dataset.productUrl).toBe('/products/new-widget');
  });

  it('stops listening for updates once removed from the DOM', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ text: () => Promise.resolve('') });
    const { section, pickup } = makeLocalPickup();
    pickup.remove();

    expect(() => dispatchVariantUpdate(section, { id: 'v5', available: true })).not.toThrow();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('calls the base Component disconnectedCallback to clean up its ref mutation observer', () => {
    const { pickup } = makeLocalPickup();
    // Regression test: previously connectedCallback overwrote `this.disconnectedCallback` with an
    // instance property, which shadowed Component.prototype.disconnectedCallback entirely and
    // silently skipped the base class's own cleanup (disconnecting its MutationObserver).
    const mutationObserverDisconnectSpy = vi.spyOn(MutationObserver.prototype, 'disconnect');

    pickup.disconnectedCallback();

    expect(mutationObserverDisconnectSpy).toHaveBeenCalled();
  });
});
