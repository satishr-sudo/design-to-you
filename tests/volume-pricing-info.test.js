import { describe, expect, it, vi } from 'vitest';
import { Component } from '@theme/component';
import '@theme/volume-pricing-info';

if (!customElements.get('anchored-popover-component')) {
  customElements.define(
    'anchored-popover-component',
    class extends Component {
      updatedCallback() {
        super.updatedCallback();
      }
    }
  );
}

describe('volume-pricing-info', () => {
  it('registers the custom element', () => {
    expect(customElements.get('volume-pricing-info')).toBeDefined();
  });

  it('refreshes the parent anchored-popover-component refs on connect', () => {
    document.body.innerHTML = `
      <anchored-popover-component>
        <div ref="popover">
          <volume-pricing-info></volume-pricing-info>
        </div>
      </anchored-popover-component>
    `;
    const popover = document.querySelector('anchored-popover-component');
    const spy = vi.spyOn(popover, 'updatedCallback');

    document.querySelector('volume-pricing-info').connectedCallback();

    expect(spy).toHaveBeenCalled();
  });

  it('does not throw when there is no anchored-popover-component ancestor', () => {
    document.body.innerHTML = `<volume-pricing-info></volume-pricing-info>`;

    expect(() => document.querySelector('volume-pricing-info').connectedCallback()).not.toThrow();
  });

  describe('updateActiveTier', () => {
    function setup() {
      // The `ref="popover"` element belongs to anchored-popover-component (per its own refs
      // typedef); volume-pricing-info reaches its quantity-tier rows through that ref, since
      // positioning/visibility of the popover is owned by the parent component.
      document.body.innerHTML = `
        <anchored-popover-component>
          <div ref="popover">
            <volume-pricing-info>
              <div class="volume-pricing-info__row" data-quantity="1">Tier 1</div>
              <div class="volume-pricing-info__row" data-quantity="5">Tier 5</div>
              <div class="volume-pricing-info__row" data-quantity="10">Tier 10</div>
            </volume-pricing-info>
          </div>
        </anchored-popover-component>
      `;
      return document.querySelector('volume-pricing-info');
    }

    it('highlights the highest tier whose quantity threshold has been reached', () => {
      const info = setup();

      info.updateActiveTier(7);

      const active = document.querySelectorAll('.volume-pricing-info__row--active');
      expect(active).toHaveLength(1);
      expect(active[0].dataset.quantity).toBe('5');
    });

    it('highlights the top tier when quantity exceeds every threshold', () => {
      const info = setup();

      info.updateActiveTier(100);

      const active = document.querySelector('.volume-pricing-info__row--active');
      expect(active.dataset.quantity).toBe('10');
    });

    it('highlights no tier when quantity is below every threshold', () => {
      const info = setup();

      info.updateActiveTier(0);

      expect(document.querySelectorAll('.volume-pricing-info__row--active')).toHaveLength(0);
    });

    it('clears a previously active tier before setting the new one', () => {
      const info = setup();

      info.updateActiveTier(7);
      info.updateActiveTier(1);

      const active = document.querySelectorAll('.volume-pricing-info__row--active');
      expect(active).toHaveLength(1);
      expect(active[0].dataset.quantity).toBe('1');
    });

    it('does nothing when there is no anchored-popover-component ancestor', () => {
      document.body.innerHTML = `<volume-pricing-info></volume-pricing-info>`;
      const info = document.querySelector('volume-pricing-info');

      expect(() => info.updateActiveTier(5)).not.toThrow();
    });
  });
});
