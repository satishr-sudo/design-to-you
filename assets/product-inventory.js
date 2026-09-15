import { ThemeEvents, VariantUpdateEvent } from '@theme/events';
import { morph } from '@theme/morph';
import { Component } from '@theme/component';

class ProductInventory extends Component {
  /**
   * The element we subscribed to in connectedCallback. Captured so disconnectedCallback can
   * unsubscribe from the same element even after this component has already been detached from
   * the DOM, at which point `this.closest(...)` can no longer find it.
   * @type {Element | null}
   */
  #subscribedSection = null;

  connectedCallback() {
    super.connectedCallback();
    const closestSection = this.closest('.shopify-section, dialog');
    this.#subscribedSection = closestSection;
    closestSection?.addEventListener(ThemeEvents.variantUpdate, this.updateInventory);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#subscribedSection?.removeEventListener(ThemeEvents.variantUpdate, this.updateInventory);
    this.#subscribedSection = null;
  }

  /**
   * Updates the inventory.
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  updateInventory = (event) => {
    if (event.detail.data.newProduct) {
      this.dataset.productId = event.detail.data.newProduct.id;
    } else if (event.target instanceof HTMLElement && event.target.dataset.productId !== this.dataset.productId) {
      return;
    }

    const newInventory = event.detail.data.html.querySelector('product-inventory');

    if (!newInventory) return;

    morph(this, newInventory, { childrenOnly: true });
  };
}

if (!customElements.get('product-inventory')) {
  customElements.define('product-inventory', ProductInventory);
}
