import { describe, expect, it } from 'vitest';
import '@theme/product-price';
import { VariantUpdateEvent } from '@theme/events';

function makeProductPrice({ blockId = 'block-1' } = {}) {
  document.body.innerHTML = `
    <div class="shopify-section" data-product-id="123">
      <product-price data-product-id="123" data-block-id="${blockId}">
        <div ref="priceContainer">Old price</div>
      </product-price>
    </div>
  `;
  return {
    section: document.querySelector('.shopify-section'),
    price: document.querySelector('product-price'),
  };
}

function buildUpdatedHtml({ blockId = 'block-1', priceHtml = '<span>New price</span>', noteHtml = null }) {
  const html = document.implementation.createHTMLDocument('');
  html.body.innerHTML = `
    <product-price data-block-id="${blockId}">
      <div ref="priceContainer">${priceHtml}</div>
      ${noteHtml ? `<div ref="volumePricingNote">${noteHtml}</div>` : ''}
    </product-price>
  `;
  return html;
}

describe('product-price', () => {
  it('registers the custom element', () => {
    expect(customElements.get('product-price')).toBeDefined();
  });

  it('replaces the price container with the new markup from the event', () => {
    const { section, price } = makeProductPrice();
    const newHtml = buildUpdatedHtml({ priceHtml: '<span class="new">$20.00</span>' });

    const event = new VariantUpdateEvent({ id: 'v1' }, 'source', { html: newHtml, productId: '123' });
    Object.defineProperty(event, 'target', { value: section });
    section.dispatchEvent(event);

    expect(price.querySelector('[ref="priceContainer"]').innerHTML).toContain('$20.00');
  });

  it('adds a volume pricing note that did not previously exist', () => {
    const { section, price } = makeProductPrice();
    const newHtml = buildUpdatedHtml({ noteHtml: '<p>Buy 3+ and save</p>' });

    const event = new VariantUpdateEvent({ id: 'v1' }, 'source', { html: newHtml, productId: '123' });
    Object.defineProperty(event, 'target', { value: section });
    section.dispatchEvent(event);

    expect(price.querySelector('[ref="volumePricingNote"]')).not.toBeNull();
    expect(price.querySelector('[ref="volumePricingNote"]').textContent).toBe('Buy 3+ and save');
  });

  it('removes an existing volume pricing note when the update has none', () => {
    document.body.innerHTML = `
      <div class="shopify-section" data-product-id="123">
        <product-price data-product-id="123" data-block-id="block-1">
          <div ref="priceContainer">Old price</div>
          <div ref="volumePricingNote">Old note</div>
        </product-price>
      </div>
    `;
    const section = document.querySelector('.shopify-section');
    const price = document.querySelector('product-price');
    const newHtml = buildUpdatedHtml({});

    const event = new VariantUpdateEvent({ id: 'v1' }, 'source', { html: newHtml, productId: '123' });
    Object.defineProperty(event, 'target', { value: section });
    section.dispatchEvent(event);

    expect(price.querySelector('[ref="volumePricingNote"]')).toBeNull();
  });

  it('replaces an existing volume pricing note with the new one', () => {
    document.body.innerHTML = `
      <div class="shopify-section" data-product-id="123">
        <product-price data-product-id="123" data-block-id="block-1">
          <div ref="priceContainer">Old price</div>
          <div ref="volumePricingNote">Old note</div>
        </product-price>
      </div>
    `;
    const section = document.querySelector('.shopify-section');
    const price = document.querySelector('product-price');
    const newHtml = buildUpdatedHtml({ noteHtml: 'New note' });

    const event = new VariantUpdateEvent({ id: 'v1' }, 'source', { html: newHtml, productId: '123' });
    Object.defineProperty(event, 'target', { value: section });
    section.dispatchEvent(event);

    expect(price.querySelector('[ref="volumePricingNote"]').textContent).toBe('New note');
  });

  it('ignores the update when there is no matching product-price block in the new html', () => {
    const { section, price } = makeProductPrice({ blockId: 'block-1' });
    const newHtml = buildUpdatedHtml({ blockId: 'different-block' });
    const originalHtml = price.innerHTML;

    const event = new VariantUpdateEvent({ id: 'v1' }, 'source', { html: newHtml, productId: '123' });
    Object.defineProperty(event, 'target', { value: section });
    section.dispatchEvent(event);

    expect(price.innerHTML).toBe(originalHtml);
  });

  it('ignores updates targeting a different product id', () => {
    const { price } = makeProductPrice();
    const otherSection = document.createElement('div');
    otherSection.dataset.productId = '999';
    const newHtml = buildUpdatedHtml({ priceHtml: 'SHOULD-NOT-APPLY' });
    const originalHtml = price.innerHTML;

    const event = new VariantUpdateEvent({ id: 'v1' }, 'source', { html: newHtml, productId: '999' });
    Object.defineProperty(event, 'target', { value: otherSection });
    otherSection.dispatchEvent(event);

    expect(price.innerHTML).toBe(originalHtml);
  });

  it('stops listening for updates once removed from the DOM', () => {
    const { section, price } = makeProductPrice();
    price.remove();

    const newHtml = buildUpdatedHtml({ priceHtml: 'SHOULD-NOT-APPLY' });
    const event = new VariantUpdateEvent({ id: 'v1' }, 'source', { html: newHtml, productId: '123' });
    Object.defineProperty(event, 'target', { value: section });

    expect(() => section.dispatchEvent(event)).not.toThrow();
    expect(price.innerHTML).not.toContain('SHOULD-NOT-APPLY');
  });
});
