import { describe, expect, it } from 'vitest';
import '@theme/volume-pricing';

describe('volume-pricing', () => {
  it('registers the custom element', () => {
    expect(customElements.get('volume-pricing')).toBeDefined();
  });

  it('toggles the expanded class on', () => {
    document.body.innerHTML = '<volume-pricing></volume-pricing>';
    const el = document.querySelector('volume-pricing');

    el.toggleExpanded();

    expect(el.classList.contains('volume-pricing--expanded')).toBe(true);
  });

  it('toggles the expanded class off on a second call', () => {
    document.body.innerHTML = '<volume-pricing></volume-pricing>';
    const el = document.querySelector('volume-pricing');

    el.toggleExpanded();
    el.toggleExpanded();

    expect(el.classList.contains('volume-pricing--expanded')).toBe(false);
  });
});
