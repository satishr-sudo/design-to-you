import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CartUpdateEvent,
  QuantitySelectorUpdateEvent,
  VariantSelectedEvent,
  VariantUpdateEvent,
} from '@theme/events';

const { morphMock } = vi.hoisted(() => ({ morphMock: vi.fn() }));
vi.mock('@theme/morph', () => ({ morph: morphMock }));

await import('@theme/sticky-add-to-cart');

function makeStickyAddToCart({
  productId = 'PROD1',
  initialQuantity = '1',
  addToCartDisabled = false,
} = {}) {
  document.body.innerHTML = `
    <div class="shopify-section" id="shopify-section-sec1">
      <div class="buy-buttons-block">
        <product-form-component data-product-id="${productId}">
          <button ref="addToCartButton" type="submit" ${addToCartDisabled ? 'disabled' : ''}></button>
        </product-form-component>
      </div>
      <sticky-add-to-cart data-product-id="${productId}" data-initial-quantity="${initialQuantity}">
        <div ref="stickyBar" data-stuck="false">
          <button ref="addToCartButton" ${addToCartDisabled ? 'disabled' : ''}></button>
          <div ref="quantityDisplay"><span ref="quantityNumber"></span></div>
          <img ref="productImage" src="https://shop.test/image.jpg" />
        </div>
        <div class="sticky-add-to-cart__variant"></div>
      </sticky-add-to-cart>
    </div>
    <variant-picker data-product-id="${productId}">
      <input type="radio" checked value="Blue" />
      <input type="radio" checked value="Large" />
    </variant-picker>
    <footer></footer>
    <div class="header-actions__cart-icon"></div>
  `;
  return {
    section: document.getElementById('shopify-section-sec1'),
    stickyAddToCart: document.querySelector('sticky-add-to-cart'),
    buyButtonsBlock: document.querySelector('.buy-buttons-block'),
    footer: document.querySelector('footer'),
    productFormButton: document.querySelector('product-form-component [ref="addToCartButton"]'),
  };
}

function getObservers() {
  return globalThis.IntersectionObserver.instances;
}

function findObserverFor(target) {
  return getObservers().find((observer) => observer.observedElements.has(target));
}

function setRect(element, rect) {
  element.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, ...rect });
}

describe('sticky-add-to-cart', () => {
  afterEach(() => {
    morphMock.mockClear();
  });

  it('registers the custom element', () => {
    expect(customElements.get('sticky-add-to-cart')).toBeDefined();
  });

  describe('initial quantity display', () => {
    it('shows the quantity when there is more than one and the button is available', () => {
      const { stickyAddToCart } = makeStickyAddToCart({ initialQuantity: '3' });

      expect(stickyAddToCart.refs.quantityNumber.textContent).toBe('3');
      expect(stickyAddToCart.refs.quantityDisplay.style.display).toBe('inline');
    });

    it('hides the quantity display when the button is unavailable, regardless of quantity', () => {
      const { stickyAddToCart } = makeStickyAddToCart({ initialQuantity: '3', addToCartDisabled: true });

      expect(stickyAddToCart.refs.quantityDisplay.style.display).toBe('none');
    });

    it('hides the quantity display when the quantity is 1', () => {
      const { stickyAddToCart } = makeStickyAddToCart({ initialQuantity: '1' });

      expect(stickyAddToCart.refs.quantityDisplay.style.display).toBe('none');
    });
  });

  describe('quantity-selector:update handling', () => {
    it('updates the displayed quantity for product-page quantity changes', () => {
      const { stickyAddToCart } = makeStickyAddToCart();

      document.dispatchEvent(new QuantitySelectorUpdateEvent(5));

      expect(stickyAddToCart.refs.quantityNumber.textContent).toBe('5');
      expect(stickyAddToCart.refs.quantityDisplay.style.display).toBe('inline');
    });

    it('ignores cart-line quantity updates (e.g. from the cart drawer)', () => {
      const { stickyAddToCart } = makeStickyAddToCart({ initialQuantity: '2' });

      document.dispatchEvent(new QuantitySelectorUpdateEvent(9, 'cart-line-1'));

      expect(stickyAddToCart.refs.quantityNumber.textContent).toBe('2');
    });
  });

  describe('variant:selected handling', () => {
    it('tracks the newly selected variant id', () => {
      const { stickyAddToCart, section } = makeStickyAddToCart();

      section.dispatchEvent(new VariantSelectedEvent({ id: 'v99' }));

      expect(stickyAddToCart.dataset.currentVariantId).toBe('v99');
    });

    it('does nothing when the event has no variant id', () => {
      const { stickyAddToCart, section } = makeStickyAddToCart();

      section.dispatchEvent(new VariantSelectedEvent({}));

      expect(stickyAddToCart.dataset.currentVariantId).toBeUndefined();
    });
  });

  describe('variant:update handling', () => {
    function variantUpdateEvent({ resource, productId = 'PROD1', variantAvailable = 'true' } = {}) {
      const html = new DOMParser().parseFromString(
        `<sticky-add-to-cart data-variant-available="${variantAvailable}">
          <div ref="stickyBar">new content</div>
        </sticky-add-to-cart>`,
        'text/html'
      );
      return new VariantUpdateEvent(resource, 'src', { html, productId });
    }

    it('ignores updates for a different product', () => {
      const { section } = makeStickyAddToCart({ productId: 'PROD1' });

      section.dispatchEvent(variantUpdateEvent({ resource: { id: 'v2' }, productId: 'OTHER' }));

      expect(morphMock).not.toHaveBeenCalled();
    });

    it('does nothing when the response has no sticky-add-to-cart markup', () => {
      const { section, stickyAddToCart } = makeStickyAddToCart();
      const html = new DOMParser().parseFromString('<div>no sticky bar here</div>', 'text/html');

      section.dispatchEvent(new VariantUpdateEvent({ id: 'v2' }, 'src', { html, productId: 'PROD1' }));

      expect(morphMock).not.toHaveBeenCalled();
      expect(stickyAddToCart.dataset.currentVariantId).toBeUndefined();
    });

    it('morphs the sticky bar, restores the stuck state and tracks the new variant on a matching update', () => {
      const { section, stickyAddToCart } = makeStickyAddToCart();
      stickyAddToCart.refs.stickyBar.setAttribute('data-stuck', 'true');

      section.dispatchEvent(variantUpdateEvent({ resource: { id: 'v2' } }));

      expect(morphMock).toHaveBeenCalledWith(
        stickyAddToCart.refs.stickyBar,
        expect.any(Element),
        { childrenOnly: true }
      );
      expect(stickyAddToCart.refs.stickyBar.getAttribute('data-stuck')).toBe('true');
      expect(stickyAddToCart.dataset.variantAvailable).toBe('true');
      expect(stickyAddToCart.dataset.currentVariantId).toBe('v2');
    });

    it('clears the variant id and shows the selected option summary when the variant becomes unavailable', () => {
      const { section, stickyAddToCart } = makeStickyAddToCart();
      stickyAddToCart.dataset.currentVariantId = 'v1';

      section.dispatchEvent(variantUpdateEvent({ resource: null, variantAvailable: 'false' }));

      expect(stickyAddToCart.dataset.currentVariantId).toBe('');
      expect(stickyAddToCart.querySelector('.sticky-add-to-cart__variant').textContent).toBe('Blue / Large');
    });
  });

  describe('cart update / error handling', () => {
    it('resets the puppet flag on the underlying product-form button after a cart update', () => {
      const { stickyAddToCart, productFormButton } = makeStickyAddToCart();
      productFormButton.dataset.puppet = 'true';

      document.dispatchEvent(new CartUpdateEvent({}, 'src'));

      expect(productFormButton.dataset.puppet).toBe('false');
    });
  });

  describe('handleAddToCartClick', () => {
    it('triggers the real add-to-cart button, marks the sticky button as added, and clears it after a delay', async () => {
      vi.useFakeTimers();
      try {
        const { stickyAddToCart, productFormButton } = makeStickyAddToCart();
        const clickSpy = vi.fn();
        productFormButton.addEventListener('click', clickSpy);

        await stickyAddToCart.handleAddToCartClick();

        expect(productFormButton.dataset.puppet).toBe('true');
        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(stickyAddToCart.refs.addToCartButton.dataset.added).toBe('true');
        expect(document.querySelector('fly-to-cart')).not.toBeNull();

        await vi.advanceTimersByTimeAsync(800);

        expect(stickyAddToCart.refs.addToCartButton.hasAttribute('data-added')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does nothing when there is no underlying add-to-cart button to trigger', async () => {
      // No surrounding .buy-buttons-block/product-form-component/footer, so
      // #setupIntersectionObserver() bails out early and never caches a target button.
      document.body.innerHTML = `
        <sticky-add-to-cart data-product-id="PROD1">
          <div ref="stickyBar" data-stuck="false">
            <button ref="addToCartButton"></button>
            <div ref="quantityDisplay"><span ref="quantityNumber"></span></div>
            <img ref="productImage" src="https://shop.test/image.jpg" />
          </div>
        </sticky-add-to-cart>
      `;
      const stickyAddToCart = document.querySelector('sticky-add-to-cart');

      await expect(stickyAddToCart.handleAddToCartClick()).resolves.toBeUndefined();
      expect(document.querySelector('fly-to-cart')).toBeNull();
    });
  });

  describe('sticky bar visibility via IntersectionObserver', () => {
    it('shows the sticky bar once the buy buttons have scrolled above the viewport', () => {
      const { stickyAddToCart, buyButtonsBlock } = makeStickyAddToCart();
      setRect(buyButtonsBlock, { top: -100, bottom: -50 });
      const observer = findObserverFor(buyButtonsBlock);

      observer.trigger([{ isIntersecting: false, target: buyButtonsBlock }]);

      expect(stickyAddToCart.refs.stickyBar.dataset.stuck).toBe('true');
    });

    it('does not show the sticky bar while the buy buttons simply have not been reached yet', () => {
      const { stickyAddToCart, buyButtonsBlock } = makeStickyAddToCart();
      setRect(buyButtonsBlock, { top: 200, bottom: 250 });
      const observer = findObserverFor(buyButtonsBlock);

      observer.trigger([{ isIntersecting: false, target: buyButtonsBlock }]);

      expect(stickyAddToCart.refs.stickyBar.dataset.stuck).toBe('false');
    });

    it('hides the sticky bar again once the buy buttons scroll back into view', () => {
      const { stickyAddToCart, buyButtonsBlock } = makeStickyAddToCart();
      setRect(buyButtonsBlock, { top: -100, bottom: -50 });
      const observer = findObserverFor(buyButtonsBlock);
      observer.trigger([{ isIntersecting: false, target: buyButtonsBlock }]);
      expect(stickyAddToCart.refs.stickyBar.dataset.stuck).toBe('true');

      observer.trigger([{ isIntersecting: true, target: buyButtonsBlock }]);

      expect(stickyAddToCart.refs.stickyBar.dataset.stuck).toBe('false');
    });

    it('hides the sticky bar when the footer scrolls into view while stuck', () => {
      const { stickyAddToCart, buyButtonsBlock, footer } = makeStickyAddToCart();
      setRect(buyButtonsBlock, { top: -100, bottom: -50 });
      findObserverFor(buyButtonsBlock).trigger([{ isIntersecting: false, target: buyButtonsBlock }]);
      expect(stickyAddToCart.refs.stickyBar.dataset.stuck).toBe('true');

      findObserverFor(footer).trigger([{ isIntersecting: true, target: footer }]);

      expect(stickyAddToCart.refs.stickyBar.dataset.stuck).toBe('false');
    });

    it('re-shows the sticky bar once the footer scrolls back out, if the buy buttons are still above the viewport', () => {
      const { stickyAddToCart, buyButtonsBlock, footer } = makeStickyAddToCart();
      setRect(buyButtonsBlock, { top: -100, bottom: -50 });
      findObserverFor(buyButtonsBlock).trigger([{ isIntersecting: false, target: buyButtonsBlock }]);
      findObserverFor(footer).trigger([{ isIntersecting: true, target: footer }]);
      expect(stickyAddToCart.refs.stickyBar.dataset.stuck).toBe('false');

      findObserverFor(footer).trigger([{ isIntersecting: false, target: footer }]);

      expect(stickyAddToCart.refs.stickyBar.dataset.stuck).toBe('true');
    });
  });
});
