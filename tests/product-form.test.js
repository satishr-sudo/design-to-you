import { describe, expect, it, vi } from 'vitest';

const { morphMock } = vi.hoisted(() => ({ morphMock: vi.fn() }));
vi.mock('@theme/morph', () => ({ morph: morphMock }));

const { AddToCartComponent } = await import('@theme/product-form');
await import('@theme/component-quantity-selector');
const { VariantSelectedEvent, CartUpdateEvent, CartAddEvent } = await import('@theme/events');

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('add-to-cart-component', () => {
  it('registers the custom element', () => {
    expect(customElements.get('add-to-cart-component')).toBeDefined();
  });

  function makeAddToCart({ animation = 'false', puppet = 'false', variantMedia = '' } = {}) {
    document.body.innerHTML = `
      <form>
        <add-to-cart-component data-add-to-cart-animation="${animation}" data-product-variant-media="${variantMedia}">
          <button ref="addToCartButton" data-puppet="${puppet}"></button>
        </add-to-cart-component>
      </form>
    `;
    return document.querySelector('add-to-cart-component');
  }

  it('disables and enables the button', () => {
    const el = makeAddToCart();
    el.disable();
    expect(el.refs.addToCartButton.disabled).toBe(true);
    el.enable();
    expect(el.refs.addToCartButton.disabled).toBe(false);
  });

  it('preloads the variant media image on pointerenter', async () => {
    const el = makeAddToCart({ variantMedia: '/files/product.jpg' });
    const image = { src: '' };
    vi.spyOn(globalThis, 'Image').mockImplementation(function () {
      return image;
    });

    el.dispatchEvent(new Event('pointerenter'));

    expect(image.src).toBe('/files/product.jpg');
  });

  it('does not preload when there is no variant media', () => {
    const el = makeAddToCart();
    const ImageSpy = vi.spyOn(globalThis, 'Image');

    el.dispatchEvent(new Event('pointerenter'));

    expect(ImageSpy).not.toHaveBeenCalled();
  });

  it('stops preloading after being disconnected', () => {
    const el = makeAddToCart({ variantMedia: '/files/product.jpg' });
    el.disconnectedCallback();
    const ImageSpy = vi.spyOn(globalThis, 'Image');

    el.dispatchEvent(new Event('pointerenter'));

    expect(ImageSpy).not.toHaveBeenCalled();
  });

  describe('handleClick', () => {
    it('does nothing when the closest form is invalid', () => {
      const el = makeAddToCart();
      vi.spyOn(el.closest('form'), 'checkValidity').mockReturnValue(false);
      const animateSpy = vi.spyOn(el, 'animateAddToCart').mockResolvedValue(undefined);
      const event = { target: el.refs.addToCartButton, preventDefault() {} };

      el.handleClick(event);

      expect(animateSpy).not.toHaveBeenCalled();
    });

    it('does not animate when the quantity selector reports it would exceed the max', () => {
      const el = makeAddToCart();
      // Built detached from the document (never appended), so the real product-form-component's
      // connectedCallback (and its required-refs validation) never fires; we only need `.refs` to
      // exist for AddToCartComponent#handleClick to read from, and `.closest()` works on detached
      // trees regardless of document attachment.
      const productForm = document.createElement('product-form-component');
      productForm.appendChild(el.closest('form'));
      productForm.refs = { quantitySelector: { canAddToCart: () => ({ canAdd: false }) } };

      const animateSpy = vi.spyOn(el, 'animateAddToCart').mockResolvedValue(undefined);
      const event = { target: el.refs.addToCartButton, preventDefault() {} };

      el.handleClick(event);

      expect(animateSpy).not.toHaveBeenCalled();
    });

    it('animates the add-to-cart button on a normal click', () => {
      const el = makeAddToCart();
      const animateSpy = vi.spyOn(el, 'animateAddToCart').mockResolvedValue(undefined);
      const event = { target: el.refs.addToCartButton, preventDefault() {} };

      el.handleClick(event);

      expect(animateSpy).toHaveBeenCalled();
    });

    it('does nothing when the button is a "puppet" (already animated by another trigger)', () => {
      const el = makeAddToCart({ puppet: 'true' });
      const animateSpy = vi.spyOn(el, 'animateAddToCart').mockResolvedValue(undefined);
      const event = { target: el.refs.addToCartButton, preventDefault() {} };

      el.handleClick(event);

      expect(animateSpy).not.toHaveBeenCalled();
    });

    it('creates a fly-to-cart element when the animation is enabled and a cart icon exists', () => {
      const el = makeAddToCart({ animation: 'true', variantMedia: '/files/product.jpg' });
      el.refs.addToCartButton.classList.add('quick-add__button');
      const cartIcon = document.createElement('div');
      cartIcon.classList.add('header-actions__cart-icon');
      document.body.appendChild(cartIcon);
      vi.spyOn(el, 'animateAddToCart').mockResolvedValue(undefined);
      const event = { target: el.refs.addToCartButton, preventDefault() {} };

      el.handleClick(event);

      const flyToCart = document.querySelector('fly-to-cart');
      expect(flyToCart).not.toBeNull();
      expect(flyToCart.classList.contains('fly-to-cart--quick')).toBe(true);
    });

    it('does not animate the fly-to-cart when triggered from within a quick-add-modal', () => {
      const el = makeAddToCart({ animation: 'true', variantMedia: '/files/product.jpg' });
      const cartIcon = document.createElement('div');
      cartIcon.classList.add('header-actions__cart-icon');
      document.body.appendChild(cartIcon);
      const modal = document.createElement('div');
      modal.classList.add('quick-add-modal');
      modal.appendChild(el.refs.addToCartButton);
      vi.spyOn(el, 'animateAddToCart').mockResolvedValue(undefined);
      const event = { target: el.refs.addToCartButton, preventDefault() {} };

      el.handleClick(event);

      expect(document.querySelector('fly-to-cart')).toBeNull();
    });
  });

  describe('animateAddToCart', () => {
    it('sets data-added and clears it again after the reset delay', async () => {
      const el = makeAddToCart();

      await el.animateAddToCart();

      expect(el.refs.addToCartButton.dataset.added).toBe('true');

      await new Promise((resolve) => setTimeout(resolve, 850));
      expect(el.refs.addToCartButton.hasAttribute('data-added')).toBe(false);
    }, 2000);

    it('clears any pending reset timeouts before starting a new animation', async () => {
      const el = makeAddToCart();
      await el.animateAddToCart();
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout');

      await el.animateAddToCart();

      expect(clearSpy).toHaveBeenCalled();
    });
  });
});

describe('product-form-component', () => {
  function makeProductForm({ productId = '1', quantityDefault = '1', variantId = 'v1' } = {}) {
    document.body.innerHTML = `
      <div class="shopify-section">
        <product-form-component data-product-id="${productId}" data-quantity-default="${quantityDefault}">
          <form id="product-form-1">
            <input ref="variantId" type="hidden" name="id" value="${variantId}" />
            <div ref="liveRegion"></div>
            <div ref="addToCartTextError" class="hidden"></div>
            <add-to-cart-component ref="addToCartButtonContainer">
              <button ref="addToCartButton">
                <span class="add-to-cart-text--added">Added</span>
              </button>
            </add-to-cart-component>
          </form>
        </product-form-component>
      </div>
    `;
    return {
      section: document.querySelector('.shopify-section'),
      form: document.getElementById('product-form-1'),
      productForm: document.querySelector('product-form-component'),
    };
  }

  it('registers the custom element', () => {
    expect(customElements.get('product-form-component')).toBeDefined();
  });

  describe('handleSubmit', () => {
    it('adds to cart and dispatches a success CartAddEvent', async () => {
      const { form, productForm } = makeProductForm();
      globalThis.Theme = { routes: { cart_add_url: '/cart/add.js' }, translations: { added: 'Added!' } };
      globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ id: 123, sections: {} }) });
      const handler = vi.fn();
      productForm.addEventListener(CartAddEvent.eventName, handler);

      productForm.handleSubmit(new Event('submit', { cancelable: true }));
      await flushPromises();

      expect(globalThis.fetch).toHaveBeenCalledWith('/cart/add.js', expect.any(Object));
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].detail.data.didError).toBeUndefined();
      // The markup's own ".add-to-cart-text--added" text takes priority over Theme.translations.added.
      expect(productForm.refs.liveRegion.textContent).toBe('Added');
    });

    it('shows an error message and dispatches an error CartAddEvent when the server responds with a status', async () => {
      const { productForm } = makeProductForm();
      globalThis.Theme = { routes: { cart_add_url: '/cart/add.js' }, translations: { added: 'Added!' } };
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue({ json: () => Promise.resolve({ status: 422, message: 'Sold out' }) });
      const cartAddHandler = vi.fn();
      const cartErrorHandler = vi.fn();
      productForm.addEventListener(CartAddEvent.eventName, cartAddHandler);
      productForm.addEventListener('cart:error', cartErrorHandler);

      productForm.handleSubmit(new Event('submit', { cancelable: true }));
      await flushPromises();

      expect(cartErrorHandler).toHaveBeenCalledTimes(1);
      expect(cartAddHandler.mock.calls[0][0].detail.data.didError).toBe(true);
      expect(productForm.refs.addToCartTextError.classList.contains('hidden')).toBe(false);
      expect(productForm.refs.liveRegion.textContent).toBe('Sold out');
    });

    it('queues the add-to-cart request when a variant change is in progress', () => {
      const { section, productForm } = makeProductForm();
      const animateSpy = vi.fn();
      productForm.refs.addToCartButtonContainer.animateAddToCart = animateSpy;
      globalThis.fetch = vi.fn();

      const selectedEvent = new VariantSelectedEvent({ id: 'v2' });
      Object.defineProperty(selectedEvent, 'target', { value: productForm });
      section.dispatchEvent(selectedEvent);

      productForm.handleSubmit(new Event('submit', { cancelable: true }));

      expect(animateSpy).toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  describe('#onCartUpdate (cart:update)', () => {
    it('ignores updates that originated from itself', () => {
      const { productForm } = makeProductForm();
      productForm.id = 'my-form';
      globalThis.fetch = vi.fn();

      const event = new CartUpdateEvent({ items: [] }, 'my-form', {});
      document.dispatchEvent(event);

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('updates the quantity selector directly when the event carries cart items', async () => {
      document.body.innerHTML = `
        <product-form-component data-product-id="1">
          <form id="product-form-1">
            <input ref="variantId" type="hidden" name="id" value="v1" />
            <div ref="liveRegion"></div>
            <quantity-selector-component>
              <button ref="minusButton">-</button>
              <input ref="quantityInput" type="number" min="1" step="1" value="1" />
              <button ref="plusButton">+</button>
            </quantity-selector-component>
          </form>
        </product-form-component>
      `;
      const productForm = document.querySelector('product-form-component');
      globalThis.fetch = vi.fn();

      const event = new CartUpdateEvent({ items: [{ variant_id: 'v1', quantity: 4 }] }, 'other-source', {});
      document.dispatchEvent(event);
      await flushPromises();

      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(productForm.querySelector('input[ref="quantityInput"]').getAttribute('data-cart-quantity')).toBe('4');
    });

    it('fetches the cart when the event has no resource', async () => {
      const { productForm } = makeProductForm();
      globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ items: [] }) });

      const event = new CartUpdateEvent(null, 'other-source', {});
      document.dispatchEvent(event);
      await flushPromises();

      expect(globalThis.fetch).toHaveBeenCalledWith('/cart.js');
    });

    it('logs and recovers when the cart fetch fails', async () => {
      const { productForm } = makeProductForm();
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const event = new CartUpdateEvent(null, 'other-source', {});
      document.dispatchEvent(event);
      await flushPromises();

      expect(errorSpy).toHaveBeenCalledWith('Failed to fetch cart quantity:', expect.any(Error));
    });
  });

  describe('max quantity validation', () => {
    it('disables add-to-cart buttons and shows the error message when it would exceed the max', async () => {
      const { productForm } = makeProductForm();
      productForm.dataset.quantityErrorMax = 'Only {{ maximum }} left';
      productForm.refs.quantitySelector = {
        canAddToCart: () => ({ canAdd: false, maxQuantity: 3, cartQuantity: 3, quantityToAdd: 1 }),
      };
      globalThis.fetch = vi.fn();

      productForm.handleSubmit(new Event('submit', { cancelable: true }));

      expect(productForm.refs.addToCartButtonContainer.refs.addToCartButton.disabled).toBe(true);
      expect(productForm.refs.addToCartTextError.classList.contains('hidden')).toBe(false);
      expect(productForm.refs.liveRegion.textContent).toBe('Only 3 left');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  it('stops reacting to variant/cart events once disconnected', () => {
    const { section, productForm } = makeProductForm();
    productForm.disconnectedCallback();
    globalThis.Theme = { routes: { cart_add_url: '/cart/add.js' } };
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) });

    const selectedEvent = new VariantSelectedEvent({ id: 'v2' });
    Object.defineProperty(selectedEvent, 'target', { value: productForm });
    section.dispatchEvent(selectedEvent);
    productForm.handleSubmit(new Event('submit', { cancelable: true }));

    // With no variant-change-in-progress flag set (listener was detached), a normal submit
    // proceeds straight to the fetch rather than queueing.
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
