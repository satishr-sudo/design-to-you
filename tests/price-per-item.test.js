import { describe, expect, it } from 'vitest';
import '@theme/price-per-item';
import { ThemeEvents, QuantitySelectorUpdateEvent } from '@theme/events';

function makePricePerItem({
  minQuantity = '1',
  variantPrice = '$10.00 USD',
  priceBreaks = null,
  atText = 'at',
  eachText = 'each',
  quantityValue = '1',
  cartQuantity = '0',
} = {}) {
  document.body.innerHTML = `
    <product-form-component>
      <input type="number" name="quantity" value="${quantityValue}" data-cart-quantity="${cartQuantity}" />
      <price-per-item
        data-min-quantity="${minQuantity}"
        data-variant-price="${variantPrice}"
        ${priceBreaks ? `data-price-breaks='${JSON.stringify(priceBreaks)}'` : ''}
        data-at-text="${atText}"
        data-each-text="${eachText}"
      >
        <span ref="pricePerItemText"></span>
      </price-per-item>
    </product-form-component>
  `;
  return {
    form: document.querySelector('product-form-component'),
    input: document.querySelector('input[name="quantity"]'),
    priceEl: document.querySelector('price-per-item'),
  };
}

describe('price-per-item', () => {
  it('registers the custom element', () => {
    expect(customElements.get('price-per-item')).toBeDefined();
  });

  it('displays the base variant price when quantity meets only the base tier', () => {
    const { priceEl } = makePricePerItem({ minQuantity: '1', variantPrice: '$10.00 USD', quantityValue: '1' });

    expect(priceEl.refs.pricePerItemText.innerHTML).toBe('at $10.00 USD/each');
  });

  it('applies a volume price break once the quantity threshold is met', () => {
    const { priceEl } = makePricePerItem({
      minQuantity: '1',
      variantPrice: '$10.00 USD',
      priceBreaks: [{ quantity: 5, price: '$8.00 USD' }],
      quantityValue: '5',
    });

    expect(priceEl.refs.pricePerItemText.innerHTML).toBe('at $8.00 USD/each');
  });

  it('falls back to the lowest tier when quantity does not meet any threshold', () => {
    const { priceEl } = makePricePerItem({
      minQuantity: '1',
      variantPrice: '$10.00 USD',
      priceBreaks: [{ quantity: 10, price: '$7.00 USD' }],
      quantityValue: '1',
    });

    // Sorted descending: [10 -> $7, 1 -> $10]; quantity 1 matches the base tier directly here,
    // but confirms the "find first tier the quantity satisfies" logic picks the base tier.
    expect(priceEl.refs.pricePerItemText.innerHTML).toBe('at $10.00 USD/each');
  });

  it('accounts for quantity already in the cart', () => {
    const { priceEl } = makePricePerItem({
      minQuantity: '1',
      variantPrice: '$10.00 USD',
      priceBreaks: [{ quantity: 5, price: '$8.00 USD' }],
      quantityValue: '2',
      cartQuantity: '3',
    });

    // cart (3) + input (2) = 5, meets the volume tier
    expect(priceEl.refs.pricePerItemText.innerHTML).toBe('at $8.00 USD/each');
  });

  it('ignores price breaks with a missing quantity or price', () => {
    const { priceEl } = makePricePerItem({
      variantPrice: '$10.00 USD',
      priceBreaks: [
        { quantity: 5, price: '' },
        { quantity: 0, price: '$1.00' },
      ],
      quantityValue: '5',
    });

    expect(priceEl.refs.pricePerItemText.innerHTML).toBe('at $10.00 USD/each');
  });

  it('updates the price when a quantity-selector event fires from within the same form', () => {
    const { form, input, priceEl } = makePricePerItem({
      variantPrice: '$10.00 USD',
      priceBreaks: [{ quantity: 5, price: '$8.00 USD' }],
      quantityValue: '1',
    });

    input.value = '5';
    const event = new QuantitySelectorUpdateEvent(5);
    Object.defineProperty(event, 'target', { value: input });
    form.dispatchEvent(event);
    document.dispatchEvent(event);

    expect(priceEl.refs.pricePerItemText.innerHTML).toBe('at $8.00 USD/each');
  });

  it('ignores a quantity-selector event triggered from outside its own form', () => {
    const { priceEl } = makePricePerItem({
      variantPrice: '$10.00 USD',
      priceBreaks: [{ quantity: 5, price: '$8.00 USD' }],
      quantityValue: '1',
    });
    const outsideInput = document.createElement('input');
    document.body.appendChild(outsideInput);

    const event = new QuantitySelectorUpdateEvent(5);
    Object.defineProperty(event, 'target', { value: outsideInput });
    document.dispatchEvent(event);

    expect(priceEl.refs.pricePerItemText.innerHTML).toBe('at $10.00 USD/each');
  });

  it('refreshes the price display on cart update events', () => {
    const { input, priceEl } = makePricePerItem({
      variantPrice: '$10.00 USD',
      priceBreaks: [{ quantity: 5, price: '$8.00 USD' }],
      quantityValue: '1',
    });

    input.value = '5';
    document.dispatchEvent(new Event(ThemeEvents.cartUpdate));

    expect(priceEl.refs.pricePerItemText.innerHTML).toBe('at $8.00 USD/each');
  });

  it('does nothing when there is no price-per-item text ref content available', () => {
    document.body.innerHTML = `
      <product-form-component>
        <price-per-item data-variant-price="$10.00" data-at-text="at" data-each-text="each"></price-per-item>
      </product-form-component>
    `;
    expect(() => document.dispatchEvent(new Event(ThemeEvents.cartUpdate))).not.toThrow();
  });

  it('stops reacting to events after being disconnected', () => {
    const { input, priceEl } = makePricePerItem({
      variantPrice: '$10.00 USD',
      priceBreaks: [{ quantity: 5, price: '$8.00 USD' }],
      quantityValue: '1',
    });

    priceEl.disconnectedCallback();
    input.value = '5';
    document.dispatchEvent(new Event(ThemeEvents.cartUpdate));

    expect(priceEl.refs.pricePerItemText.innerHTML).toBe('at $10.00 USD/each');
  });
});
