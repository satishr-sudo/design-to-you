import { describe, expect, it, vi } from 'vitest';
import { VariantUpdateEvent } from '@theme/events';

const { morphMock } = vi.hoisted(() => ({ morphMock: vi.fn() }));
vi.mock('@theme/morph', () => ({ morph: morphMock }));

await import('@theme/product-inventory');

function makeInventory({ productId = '123' } = {}) {
  document.body.innerHTML = `
    <div class="shopify-section" data-product-id="${productId}">
      <product-inventory data-product-id="${productId}"><span>In stock</span></product-inventory>
    </div>
  `;
  return {
    section: document.querySelector('.shopify-section'),
    inventory: document.querySelector('product-inventory'),
  };
}

function buildUpdatedHtml(innerHtml = '<span>Out of stock</span>') {
  const html = document.implementation.createHTMLDocument('');
  html.body.innerHTML = `<product-inventory>${innerHtml}</product-inventory>`;
  return html;
}

describe('product-inventory', () => {
  it('registers the custom element', () => {
    expect(customElements.get('product-inventory')).toBeDefined();
  });

  it('morphs its content with the new product-inventory markup on a matching variant update', () => {
    morphMock.mockClear();
    const { section, inventory } = makeInventory();
    const newHtml = buildUpdatedHtml('<span>Only 2 left</span>');

    const event = new VariantUpdateEvent({ id: 'v1' }, 'source', { html: newHtml, productId: '123' });
    Object.defineProperty(event, 'target', { value: section });
    section.dispatchEvent(event);

    expect(morphMock).toHaveBeenCalledTimes(1);
    const [target, newNode, options] = morphMock.mock.calls[0];
    expect(target).toBe(inventory);
    expect(newNode.tagName.toLowerCase()).toBe('product-inventory');
    expect(options).toEqual({ childrenOnly: true });
  });

  it('does not morph when the new html has no product-inventory element', () => {
    morphMock.mockClear();
    const { section } = makeInventory();
    const html = document.implementation.createHTMLDocument('');
    html.body.innerHTML = '<div>no inventory here</div>';

    const event = new VariantUpdateEvent({ id: 'v1' }, 'source', { html, productId: '123' });
    Object.defineProperty(event, 'target', { value: section });
    section.dispatchEvent(event);

    expect(morphMock).not.toHaveBeenCalled();
  });

  it('ignores updates targeting a different product id', () => {
    morphMock.mockClear();
    makeInventory({ productId: '123' });
    const otherSection = document.createElement('div');
    otherSection.dataset.productId = '999';
    const newHtml = buildUpdatedHtml();

    const event = new VariantUpdateEvent({ id: 'v1' }, 'source', { html: newHtml, productId: '999' });
    Object.defineProperty(event, 'target', { value: otherSection });
    otherSection.dispatchEvent(event);

    expect(morphMock).not.toHaveBeenCalled();
  });

  it('stops listening for updates once removed from the DOM', () => {
    morphMock.mockClear();
    const { section, inventory } = makeInventory();
    inventory.remove();

    const newHtml = buildUpdatedHtml();
    const event = new VariantUpdateEvent({ id: 'v1' }, 'source', { html: newHtml, productId: '123' });
    Object.defineProperty(event, 'target', { value: section });

    expect(() => section.dispatchEvent(event)).not.toThrow();
    expect(morphMock).not.toHaveBeenCalled();
  });

  it('adopts a newProduct id from combined listings before comparing target ids', () => {
    morphMock.mockClear();
    document.body.innerHTML = `
      <div class="shopify-section" data-product-id="456">
        <product-inventory data-product-id="123"><span>In stock</span></product-inventory>
      </div>
    `;
    const section = document.querySelector('.shopify-section');
    const newHtml = buildUpdatedHtml('<span>Updated</span>');

    const event = new VariantUpdateEvent({ id: 'v1' }, 'source', {
      html: newHtml,
      productId: '456',
      newProduct: { id: '456', url: '/products/new' },
    });
    Object.defineProperty(event, 'target', { value: section });
    section.dispatchEvent(event);

    expect(morphMock).toHaveBeenCalledTimes(1);
    expect(document.querySelector('product-inventory').dataset.productId).toBe('456');
  });
});
