import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { morphSectionMock } = vi.hoisted(() => ({
  morphSectionMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@theme/section-renderer', () => ({
  morphSection: morphSectionMock,
}));

await import('@theme/cart-discount');
const { ThemeEvents } = await import('@theme/events');

function makeCartDiscount({ sectionId = 'cart-summary', existingCodes = [] } = {}) {
  const pills = existingCodes
    .map(
      (code) => `
        <li class="cart-discount__pill" data-discount-code="${code}">
          <button type="button" class="cart-discount__pill-remove"></button>
        </li>`
    )
    .join('');

  document.body.innerHTML = `
    <cart-discount-component data-section-id="${sectionId}">
      <form class="cart-discount__form">
        <input type="text" name="discount" />
        <button type="submit">Apply</button>
      </form>
      <div class="cart-discount__error hidden" ref="cartDiscountError">
        <small ref="cartDiscountErrorDiscountCode" class="hidden"></small>
        <small ref="cartDiscountErrorShipping" class="hidden"></small>
      </div>
      <ul class="cart-discount__codes">${pills}</ul>
    </cart-discount-component>
  `;

  const el = document.querySelector('cart-discount-component');
  return {
    el,
    form: document.querySelector('form'),
    discountInput: document.querySelector('input[name="discount"]'),
  };
}

function submitEventFor(form) {
  const event = new Event('submit', { cancelable: true });
  Object.defineProperty(event, 'target', { value: form });
  return event;
}

function clickEventFor(target) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

function jsonResponse(body) {
  return { json: () => Promise.resolve(body) };
}

describe('cart-discount-component', () => {
  beforeEach(() => {
    globalThis.Theme = { routes: { cart_update_url: '/cart/update.js' } };
    morphSectionMock.mockClear();
  });

  it('registers the custom element', () => {
    expect(customElements.get('cart-discount-component')).toBeDefined();
  });

  describe('applyDiscount', () => {
    it('sends the new code combined with existing codes and morphs the section on success', async () => {
      const { el, form, discountInput } = makeCartDiscount({ existingCodes: ['EXISTING10'] });
      discountInput.value = 'SAVE20';
      globalThis.fetch = vi.fn().mockResolvedValue(
        jsonResponse({
          discount_codes: [{ code: 'SAVE20', applicable: true }],
          sections: { 'cart-summary': '<div id="shopify-section-cart-summary"></div>' },
        })
      );
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

      await el.applyDiscount(submitEventFor(form));

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = globalThis.fetch.mock.calls[0];
      expect(url).toBe('/cart/update.js');
      expect(JSON.parse(options.body)).toEqual({
        discount: 'EXISTING10,SAVE20',
        sections: ['cart-summary'],
      });
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: ThemeEvents.discountUpdate }));
      expect(morphSectionMock).toHaveBeenCalledWith('cart-summary', '<div id="shopify-section-cart-summary"></div>');
    });

    it('does nothing if the code is already applied', async () => {
      const { el, form, discountInput } = makeCartDiscount({ existingCodes: ['SAVE20'] });
      discountInput.value = 'SAVE20';
      globalThis.fetch = vi.fn();

      await el.applyDiscount(submitEventFor(form));

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('does nothing if the submitted form has no discount input', async () => {
      const { el } = makeCartDiscount();
      const emptyForm = document.createElement('form');
      globalThis.fetch = vi.fn();

      await el.applyDiscount(submitEventFor(emptyForm));

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('shows the discount code error and clears the input when the code is not applicable', async () => {
      const { el, form, discountInput } = makeCartDiscount();
      discountInput.value = 'BADCODE';
      globalThis.fetch = vi.fn().mockResolvedValue(
        jsonResponse({
          discount_codes: [{ code: 'BADCODE', applicable: false }],
        })
      );

      await el.applyDiscount(submitEventFor(form));

      expect(discountInput.value).toBe('');
      expect(el.refs.cartDiscountError.classList.contains('hidden')).toBe(false);
      expect(el.refs.cartDiscountErrorDiscountCode.classList.contains('hidden')).toBe(false);
      expect(el.refs.cartDiscountErrorShipping.classList.contains('hidden')).toBe(true);
      expect(morphSectionMock).not.toHaveBeenCalled();
    });

    it('shows the shipping discount error when the code only unlocks free shipping without changing applied codes', async () => {
      // Submitting a differently-cased variant of an already-applied code isn't caught by the
      // exact-string dedupe check above, but the server still reports the same set of codes as
      // before - meaning nothing new was actually added, only (potentially) shipping eligibility.
      const { el, form, discountInput } = makeCartDiscount({ existingCodes: ['FREESHIP'] });
      discountInput.value = 'freeship';
      globalThis.fetch = vi.fn().mockResolvedValue(
        jsonResponse({
          discount_codes: [{ code: 'freeship', applicable: true }],
          sections: {
            'cart-summary': `
              <div id="shopify-section-cart-summary">
                <li class="cart-discount__pill" data-discount-code="FREESHIP"></li>
              </div>`,
          },
        })
      );

      await el.applyDiscount(submitEventFor(form));

      expect(discountInput.value).toBe('');
      expect(el.refs.cartDiscountErrorShipping.classList.contains('hidden')).toBe(false);
      expect(morphSectionMock).not.toHaveBeenCalled();
    });

    it('aborts the previous request when applying again before it resolves', async () => {
      const { el, form, discountInput } = makeCartDiscount();
      discountInput.value = 'FIRST';
      const capturedSignals = [];
      globalThis.fetch = vi.fn((_url, options) => {
        capturedSignals.push(options.signal);
        // Mirrors real fetch: an aborted signal rejects the in-flight request.
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      });

      const firstCall = el.applyDiscount(submitEventFor(form));
      discountInput.value = 'SECOND';
      el.applyDiscount(submitEventFor(form));

      expect(capturedSignals[0].aborted).toBe(true);
      expect(capturedSignals[1].aborted).toBe(false);

      await firstCall;
    });

    it('does not throw when the fetch request fails', async () => {
      const { el, form, discountInput } = makeCartDiscount();
      discountInput.value = 'SAVE20';
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

      await expect(el.applyDiscount(submitEventFor(form))).resolves.toBeUndefined();
      expect(morphSectionMock).not.toHaveBeenCalled();
    });
  });

  describe('removeDiscount', () => {
    it('removes the code, sends the remaining codes and morphs the section', async () => {
      const { el } = makeCartDiscount({ existingCodes: ['KEEP10', 'REMOVE20'] });
      const pillToRemove = document.querySelector('[data-discount-code="REMOVE20"]');
      const button = pillToRemove.querySelector('button');
      globalThis.fetch = vi.fn().mockResolvedValue(
        jsonResponse({ sections: { 'cart-summary': '<div id="shopify-section-cart-summary"></div>' } })
      );
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

      await el.removeDiscount(clickEventFor(button));

      const [url, options] = globalThis.fetch.mock.calls[0];
      expect(url).toBe('/cart/update.js');
      expect(JSON.parse(options.body)).toEqual({ discount: 'KEEP10', sections: ['cart-summary'] });
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: ThemeEvents.discountUpdate }));
      expect(morphSectionMock).toHaveBeenCalledWith('cart-summary', '<div id="shopify-section-cart-summary"></div>');
    });

    it('ignores keyboard events other than Enter', async () => {
      const { el } = makeCartDiscount({ existingCodes: ['KEEP10'] });
      const pill = document.querySelector('[data-discount-code="KEEP10"]');
      const button = pill.querySelector('button');
      globalThis.fetch = vi.fn();
      const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
      Object.defineProperty(event, 'target', { value: button });

      await el.removeDiscount(event);

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('does nothing when the click target is not inside a discount pill', async () => {
      const { el } = makeCartDiscount({ existingCodes: ['KEEP10'] });
      globalThis.fetch = vi.fn();
      const outsideElement = document.createElement('div');
      document.body.appendChild(outsideElement);

      await el.removeDiscount(clickEventFor(outsideElement));

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('does nothing when the discount code is not currently applied', async () => {
      // A pill outside the component isn't part of #existingDiscounts()'s live DOM query,
      // simulating a stale reference to a code that's already been removed.
      const { el } = makeCartDiscount({ existingCodes: ['KEEP10'] });
      const detachedPill = document.createElement('li');
      detachedPill.className = 'cart-discount__pill';
      detachedPill.dataset.discountCode = 'ALREADY_GONE';
      const button = document.createElement('button');
      detachedPill.appendChild(button);
      document.body.appendChild(detachedPill);
      globalThis.fetch = vi.fn();

      await el.removeDiscount(clickEventFor(button));

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});
