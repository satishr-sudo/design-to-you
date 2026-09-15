import { Component } from '@theme/component';
import { ThemeEvents, VariantUpdateEvent } from '@theme/events';

/**
 * A custom element that displays a product SKU.
 * This component listens for variant update events and updates the SKU display accordingly.
 * It handles SKU updates from two different sources:
 * 1. Variant picker (in quick add modal or product page)
 * 2. Swatches variant picker (in product cards)
 *
 * @typedef {Object} Refs
 * @property {HTMLElement} skuContainer - The container element for the SKU
 * @property {HTMLElement} sku - The span element that displays the SKU text
 *
 * @extends {Component<Refs>}
 */
class ProductSkuComponent extends Component {
  requiredRefs = ['skuContainer', 'sku'];

  /**
   * The element we subscribed to in connectedCallback. Captured so disconnectedCallback can
   * unsubscribe from the same element even after this component has already been detached from
   * the DOM, at which point `this.closest(...)` can no longer find it.
   * @type {Element | null}
   */
  #subscribedTarget = null;

  connectedCallback() {
    super.connectedCallback();
    const target = this.closest('[id*="ProductInformation-"], [id*="QuickAdd-"], product-card');
    if (!target) return;
    this.#subscribedTarget = target;
    target.addEventListener(ThemeEvents.variantUpdate, this.updateSku);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (!this.#subscribedTarget) return;
    this.#subscribedTarget.removeEventListener(ThemeEvents.variantUpdate, this.updateSku);
    this.#subscribedTarget = null;
  }

  /**
   * Updates the SKU.
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  updateSku = (event) => {
    if (event.detail.data.newProduct) {
      this.dataset.productId = event.detail.data.newProduct.id;
    }

    if (event.target instanceof HTMLElement && event.target.dataset.productId !== this.dataset.productId) {
      return;
    }

    // Use the variant data from the event
    // The variant is in event.detail.resource
    if (event.detail.resource) {
      const variantSku = event.detail.resource.sku || '';

      if (variantSku) {
        // Show the component and update the SKU
        this.style.display = 'block';
        this.refs.sku.textContent = variantSku;
      } else {
        // Hide the entire component when SKU is empty
        this.style.display = 'none';
        this.refs.sku.textContent = '';
      }
    }
  };
}

if (!customElements.get('product-sku-component')) {
  customElements.define('product-sku-component', ProductSkuComponent);
}
