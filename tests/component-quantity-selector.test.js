import { describe, expect, it, vi } from 'vitest';
import '@theme/component-quantity-selector';

function makeSelector({ min = '1', max = null, step = '1', value = '1', cartQuantity = null } = {}) {
  document.body.innerHTML = `
    <quantity-selector-component>
      <button ref="minusButton">-</button>
      <input
        ref="quantityInput"
        type="number"
        min="${min}"
        ${max !== null ? `max="${max}"` : ''}
        step="${step}"
        value="${value}"
        ${cartQuantity !== null ? `data-cart-quantity="${cartQuantity}"` : ''}
      />
      <button ref="plusButton">+</button>
    </quantity-selector-component>
  `;
  return document.querySelector('quantity-selector-component');
}

describe('quantity-selector-component', () => {
  it('registers the custom element', () => {
    expect(customElements.get('quantity-selector-component')).toBeDefined();
  });

  describe('getValue / setValue', () => {
    it('reads and writes the input value', () => {
      const el = makeSelector({ value: '3' });
      expect(el.getValue()).toBe('3');

      el.setValue('7');
      expect(el.getValue()).toBe('7');
    });
  });

  describe('getCurrentValues', () => {
    it('parses min/max/step/value/cartQuantity with sensible defaults', () => {
      const el = makeSelector({ min: '2', max: '10', step: '2', value: '4', cartQuantity: '1' });
      expect(el.getCurrentValues()).toEqual({ min: 2, max: 10, step: 2, value: 4, cartQuantity: 1 });
    });

    it('defaults max to null and cartQuantity to 0 when absent', () => {
      const el = makeSelector({ min: '1', step: '1', value: '1' });
      expect(el.getCurrentValues()).toEqual({ min: 1, max: null, step: 1, value: 1, cartQuantity: 0 });
    });
  });

  describe('getEffectiveMax', () => {
    it('returns null when there is no max', () => {
      const el = makeSelector({ value: '1' });
      expect(el.getEffectiveMax()).toBeNull();
    });

    it('subtracts the cart quantity already in cart from the max', () => {
      const el = makeSelector({ max: '10', cartQuantity: '3' });
      expect(el.getEffectiveMax()).toBe(7);
    });

    it('never drops below the minimum, even if cart quantity exceeds max', () => {
      const el = makeSelector({ min: '1', max: '10', cartQuantity: '15' });
      expect(el.getEffectiveMax()).toBe(1);
    });
  });

  describe('canAddToCart', () => {
    it('allows adding when under the max', () => {
      const el = makeSelector({ max: '10', cartQuantity: '2', value: '3' });
      expect(el.canAddToCart()).toEqual({ canAdd: true, maxQuantity: 10, cartQuantity: 2, quantityToAdd: 3 });
    });

    it('disallows adding when it would exceed the max', () => {
      const el = makeSelector({ max: '10', cartQuantity: '8', value: '5' });
      const result = el.canAddToCart();
      expect(result.canAdd).toBe(false);
    });

    it('always allows adding when there is no max', () => {
      const el = makeSelector({ value: '1000' });
      expect(el.canAddToCart().canAdd).toBe(true);
    });
  });

  describe('updateQuantity', () => {
    it('increases the value by step', () => {
      const el = makeSelector({ value: '2', step: '1' });
      el.updateQuantity(1);
      expect(el.getValue()).toBe('3');
    });

    it('decreases the value by step', () => {
      const el = makeSelector({ value: '5', step: '1' });
      el.updateQuantity(-1);
      expect(el.getValue()).toBe('4');
    });

    it('does not go below the minimum', () => {
      const el = makeSelector({ min: '1', value: '1', step: '1' });
      el.updateQuantity(-1);
      expect(el.getValue()).toBe('1');
    });

    it('does not exceed the effective maximum', () => {
      const el = makeSelector({ max: '5', value: '5', step: '1' });
      el.updateQuantity(1);
      expect(el.getValue()).toBe('5');
    });

    it('dispatches a QuantitySelectorUpdateEvent with the new value', () => {
      const el = makeSelector({ value: '2', step: '1' });
      const handler = vi.fn();
      el.addEventListener('quantity-selector:update', handler);

      el.updateQuantity(1);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].detail.quantity).toBe(3);
    });
  });

  describe('increaseQuantity / decreaseQuantity', () => {
    it('increaseQuantity prevents default and increases the value', () => {
      const el = makeSelector({ value: '1' });
      const button = el.refs.plusButton;
      const event = new Event('click', { cancelable: true, bubbles: true });
      Object.defineProperty(event, 'target', { value: button });

      el.increaseQuantity(event);

      expect(event.defaultPrevented).toBe(true);
      expect(el.getValue()).toBe('2');
    });

    it('decreaseQuantity prevents default and decreases the value', () => {
      const el = makeSelector({ value: '3' });
      const button = el.refs.minusButton;
      const event = new Event('click', { cancelable: true, bubbles: true });
      Object.defineProperty(event, 'target', { value: button });

      el.decreaseQuantity(event);

      expect(el.getValue()).toBe('2');
    });

    it('does nothing when the event target is not an HTMLElement', () => {
      const el = makeSelector({ value: '3' });
      const event = new Event('click', { cancelable: true });
      Object.defineProperty(event, 'target', { value: null });

      expect(() => el.increaseQuantity(event)).not.toThrow();
      expect(el.getValue()).toBe('3');
    });
  });

  describe('setQuantity', () => {
    it('accepts a valid value aligned to the step', () => {
      const el = makeSelector({ min: '1', step: '1', value: '1' });
      const input = el.refs.quantityInput;
      input.value = '5';
      const event = new Event('blur', { cancelable: true });
      Object.defineProperty(event, 'target', { value: input });

      el.setQuantity(event);

      expect(input.value).toBe('5');
    });

    it('snaps to the max when the value exceeds it', () => {
      const el = makeSelector({ max: '5', value: '1' });
      const input = el.refs.quantityInput;
      input.value = '100';
      const event = new Event('blur', { cancelable: true });
      Object.defineProperty(event, 'target', { value: input });

      el.setQuantity(event);

      expect(input.value).toBe('5');
    });

    it('reports validity and keeps the misaligned value when the step is not respected', () => {
      const el = makeSelector({ min: '0', step: '2', value: '0' });
      const input = el.refs.quantityInput;
      const reportValiditySpy = vi.spyOn(input, 'reportValidity').mockReturnValue(false);
      input.value = '3'; // not a multiple of step 2 starting at min 0

      const event = new Event('blur', { cancelable: true });
      Object.defineProperty(event, 'target', { value: input });

      el.setQuantity(event);

      expect(input.value).toBe('3');
      expect(reportValiditySpy).toHaveBeenCalled();
    });

    it('treats a non-numeric value as 0 before clamping to the minimum', () => {
      const el = makeSelector({ min: '1', value: '1' });
      const input = el.refs.quantityInput;
      input.value = 'not-a-number';
      const event = new Event('blur', { cancelable: true });
      Object.defineProperty(event, 'target', { value: input });

      el.setQuantity(event);

      expect(input.value).toBe('1');
    });

    it('does nothing when the event target is not an HTMLInputElement', () => {
      const el = makeSelector({ value: '3' });
      const event = new Event('blur', { cancelable: true });
      Object.defineProperty(event, 'target', { value: document.createElement('div') });

      expect(() => el.setQuantity(event)).not.toThrow();
      expect(el.getValue()).toBe('3');
    });
  });

  describe('updateConstraints', () => {
    it('updates the min/max/step attributes on the input', () => {
      const el = makeSelector({ min: '1', max: '10', step: '1', value: '5' });

      el.updateConstraints('2', '20', '5');

      expect(el.refs.quantityInput.min).toBe('2');
      expect(el.refs.quantityInput.max).toBe('20');
      expect(el.refs.quantityInput.step).toBe('5');
    });

    it('removes the max attribute when max is falsy', () => {
      const el = makeSelector({ max: '10' });

      el.updateConstraints('1', null, '1');

      expect(el.refs.quantityInput.hasAttribute('max')).toBe(false);
    });

    it('snaps the current value down to the closest valid increment', () => {
      const el = makeSelector({ min: '0', value: '7' });

      el.updateConstraints('0', null, '5');

      expect(el.getValue()).toBe('5');
    });

    it('clamps the value within the new bounds', () => {
      const el = makeSelector({ min: '1', value: '50' });

      el.updateConstraints('1', '10', '1');

      expect(el.getValue()).toBe('10');
    });
  });

  describe('setCartQuantity', () => {
    it('sets the data-cart-quantity attribute and refreshes button state', () => {
      const el = makeSelector({ max: '5', value: '5' });

      el.setCartQuantity(3);

      expect(el.refs.quantityInput.getAttribute('data-cart-quantity')).toBe('3');
      // effective max = 5 - 3 = 2, value 5 clamps down to 2
      expect(el.getValue()).toBe('2');
    });
  });

  describe('button state management', () => {
    it('disables the minus button at the minimum value', () => {
      const el = makeSelector({ min: '1', value: '1' });
      expect(el.refs.minusButton.disabled).toBe(true);
    });

    it('enables the minus button above the minimum', () => {
      const el = makeSelector({ min: '1', value: '2' });
      expect(el.refs.minusButton.disabled).toBe(false);
    });

    it('disables the plus button at the effective maximum', () => {
      const el = makeSelector({ max: '5', value: '5' });
      expect(el.refs.plusButton.disabled).toBe(true);
    });

    it('respects server-disabled buttons and never re-enables them', () => {
      document.body.innerHTML = `
        <quantity-selector-component>
          <button ref="minusButton" disabled>-</button>
          <input ref="quantityInput" type="number" min="1" step="1" value="5" />
          <button ref="plusButton">+</button>
        </quantity-selector-component>
      `;
      const el = document.querySelector('quantity-selector-component');

      el.updateQuantity(1);

      expect(el.refs.minusButton.disabled).toBe(true);
    });
  });

  describe('quantityInput getter', () => {
    it('returns the quantity input ref', () => {
      const el = makeSelector();
      expect(el.quantityInput).toBe(el.refs.quantityInput);
    });
  });

  describe('selectInputValue', () => {
    it('selects the input text when it is the active element and the focus target', () => {
      const el = makeSelector({ value: '5' });
      const input = el.refs.quantityInput;
      input.focus();
      const selectSpy = vi.spyOn(input, 'select');
      const event = new Event('focus');
      Object.defineProperty(event, 'target', { value: input });

      el.selectInputValue(event);

      expect(selectSpy).toHaveBeenCalled();
    });

    it('does nothing when the target is not the active element', () => {
      const el = makeSelector({ value: '5' });
      const input = el.refs.quantityInput;
      const selectSpy = vi.spyOn(input, 'select');
      const event = new Event('focus');
      Object.defineProperty(event, 'target', { value: input });

      el.selectInputValue(event);

      expect(selectSpy).not.toHaveBeenCalled();
    });
  });
});
