import { describe, expect, it } from 'vitest';
import '@theme/product-sku';
import { ThemeEvents, VariantUpdateEvent } from '@theme/events';

function makeSkuComponent(productId) {
  document.body.innerHTML = `
    <div id="ProductInformation-1" data-product-id="${productId}">
      <product-sku-component data-product-id="${productId}">
        <div ref="skuContainer">
          <span ref="sku"></span>
        </div>
      </product-sku-component>
    </div>
  `;
  return {
    section: document.getElementById('ProductInformation-1'),
    sku: document.querySelector('product-sku-component'),
  };
}

function fireVariantUpdate(section, target, variant, detail) {
  const event = new VariantUpdateEvent(variant, 'source', detail);
  Object.defineProperty(event, 'target', { value: target });
  section.dispatchEvent(event);
  return event;
}

describe('product-sku-component', () => {
  it('registers the custom element', () => {
    expect(customElements.get('product-sku-component')).toBeDefined();
  });

  it('shows the sku and updates its text when a matching variant update event fires', () => {
    const { section, sku } = makeSkuComponent('123');

    fireVariantUpdate(section, section, { id: 'v1', available: true, sku: 'ABC-123' }, { html: document, productId: '123' });

    expect(sku.style.display).toBe('block');
    expect(sku.refs.sku.textContent).toBe('ABC-123');
  });

  it('hides the component when the variant has no sku', () => {
    const { section, sku } = makeSkuComponent('123');

    fireVariantUpdate(section, section, { id: 'v1', available: true, sku: '' }, { html: document, productId: '123' });

    expect(sku.style.display).toBe('none');
    expect(sku.refs.sku.textContent).toBe('');
  });

  it('ignores updates for a different product id', () => {
    const { section, sku } = makeSkuComponent('123');
    const otherProduct = document.createElement('div');
    otherProduct.dataset.productId = '999';

    fireVariantUpdate(section, otherProduct, { id: 'v1', sku: 'SHOULD-NOT-APPLY' }, { html: document, productId: '999' });

    expect(sku.refs.sku.textContent).toBe('');
  });

  it('adopts the new product id and updates the sku when the target already reflects the new product', () => {
    // In a combined-listing swap, the section wrapper (event.target) is re-rendered with the new
    // product's id before this listener runs; the component must adopt that id on itself to match.
    document.body.innerHTML = `
      <div id="ProductInformation-1" data-product-id="456">
        <product-sku-component data-product-id="123">
          <div ref="skuContainer"><span ref="sku"></span></div>
        </product-sku-component>
      </div>
    `;
    const section = document.getElementById('ProductInformation-1');
    const sku = document.querySelector('product-sku-component');

    fireVariantUpdate(section, section, { id: 'v2', sku: 'NEW-SKU' }, {
      html: document,
      productId: '456',
      newProduct: { id: '456', url: '/products/new' },
    });

    expect(sku.dataset.productId).toBe('456');
    expect(sku.refs.sku.textContent).toBe('NEW-SKU');
  });

  it('adopts the new product id but skips the sku update when the target does not yet match it', () => {
    const { section, sku } = makeSkuComponent('123');

    fireVariantUpdate(section, section, { id: 'v2', sku: 'SHOULD-NOT-APPLY' }, {
      html: document,
      productId: '456',
      newProduct: { id: '456', url: '/products/new' },
    });

    expect(sku.dataset.productId).toBe('456');
    expect(sku.refs.sku.textContent).toBe('');
  });

  it('stops listening after being disconnected', () => {
    const { section, sku } = makeSkuComponent('123');
    sku.remove();

    const event = new VariantUpdateEvent({ id: 'v1', sku: 'SHOULD-NOT-APPLY' }, 'source', {
      html: document,
      productId: '123',
    });
    Object.defineProperty(event, 'target', { value: section });

    expect(() => section.dispatchEvent(event)).not.toThrow();
    expect(sku.refs.sku.textContent).toBe('');
  });

  it('does not throw when there is no matching ProductInformation/QuickAdd/product-card ancestor', () => {
    document.body.innerHTML = `
      <product-sku-component>
        <div ref="skuContainer"><span ref="sku"></span></div>
      </product-sku-component>
    `;
    expect(document.querySelector('product-sku-component')).toBeTruthy();
  });
});
