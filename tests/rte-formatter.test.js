import { describe, expect, it } from 'vitest';
import '@theme/rte-formatter';

describe('rte-formatter', () => {
  it('registers the rte-formatter custom element', () => {
    expect(customElements.get('rte-formatter')).toBeDefined();
  });

  it('wraps every table in a .rte-table-wrapper div', () => {
    document.body.innerHTML = `
      <rte-formatter>
        <table><tr><td>1</td></tr></table>
        <p>Some text</p>
        <table><tr><td>2</td></tr></table>
      </rte-formatter>
    `;

    const wrappers = document.querySelectorAll('.rte-table-wrapper');
    expect(wrappers).toHaveLength(2);
    wrappers.forEach((wrapper) => {
      expect(wrapper.querySelector('table')).not.toBeNull();
    });
  });

  it('preserves the position of the table relative to its siblings', () => {
    document.body.innerHTML = `
      <rte-formatter>
        <p id="before">before</p>
        <table id="t"><tr><td>1</td></tr></table>
        <p id="after">after</p>
      </rte-formatter>
    `;

    const rte = document.querySelector('rte-formatter');
    const children = Array.from(rte.children).map((c) => c.id || c.className);

    expect(children).toEqual(['before', 'rte-table-wrapper', 'after']);
  });

  it('does nothing when there are no tables', () => {
    document.body.innerHTML = '<rte-formatter><p>No tables here</p></rte-formatter>';

    expect(document.querySelectorAll('.rte-table-wrapper')).toHaveLength(0);
  });

  it('does not register the element twice', () => {
    const before = customElements.get('rte-formatter');
    return import('@theme/rte-formatter').then(() => {
      expect(customElements.get('rte-formatter')).toBe(before);
    });
  });
});
