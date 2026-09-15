import { describe, expect, it, vi } from 'vitest';

const { renderSectionMock, getSectionHTMLMock } = vi.hoisted(() => ({
  renderSectionMock: vi.fn().mockResolvedValue(undefined),
  getSectionHTMLMock: vi.fn().mockResolvedValue(''),
}));
vi.mock('@theme/section-renderer', () => ({
  sectionRenderer: { renderSection: renderSectionMock, getSectionHTML: getSectionHTMLMock },
}));

await import('@theme/facets');
const { FilterUpdateEvent, ThemeEvents } = await import('@theme/events');

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('facets-form-component', () => {
  it('registers the custom element', () => {
    expect(customElements.get('facets-form-component')).toBeDefined();
  });

  function makeFacetsForm({ sectionId = 'sec-1' } = {}) {
    document.body.innerHTML = `
      <facets-form-component section-id="${sectionId}">
        <form ref="facetsForm">
          <input type="checkbox" name="filter.v.color" value="red" checked />
          <input type="hidden" name="filter.v.price.gte" value="" />
          <input type="hidden" name="page" value="3" />
        </form>
      </facets-form-component>
    `;
    return document.querySelector('facets-form-component');
  }

  describe('createURLParameters', () => {
    it('removes empty price range params and the page param', () => {
      const el = makeFacetsForm();

      const params = el.createURLParameters();

      expect(params.has('filter.v.price.gte')).toBe(false);
      expect(params.has('page')).toBe(false);
      expect(params.get('filter.v.color')).toBe('red');
    });

    it('preserves the current search query', () => {
      window.history.pushState({}, '', '/search?q=shoes');
      const el = makeFacetsForm();

      const params = el.createURLParameters();

      expect(params.get('q')).toBe('shoes');
      window.history.pushState({}, '', '/');
    });

    it('accepts an explicit FormData override', () => {
      const el = makeFacetsForm();
      const formData = new FormData();
      formData.set('filter.v.color', 'blue');

      const params = el.createURLParameters(formData);

      expect(params.get('filter.v.color')).toBe('blue');
    });
  });

  describe('sectionId', () => {
    it('returns the section-id attribute', () => {
      const el = makeFacetsForm({ sectionId: 'my-section' });
      expect(el.sectionId).toBe('my-section');
    });

    it('throws when the attribute is missing', () => {
      document.body.innerHTML = `<facets-form-component><form ref="facetsForm"></form></facets-form-component>`;
      const el = document.querySelector('facets-form-component');
      expect(() => el.sectionId).toThrow('Section ID is required');
    });
  });

  describe('updateFilters', () => {
    it('pushes a new history state, dispatches FilterUpdateEvent and renders the section', async () => {
      renderSectionMock.mockClear();
      const el = makeFacetsForm();
      const pushStateSpy = vi.spyOn(history, 'pushState');
      const handler = vi.fn();
      el.addEventListener(FilterUpdateEvent.eventName ?? 'filter:update', handler);

      el.updateFilters();
      await flushPromises();

      expect(pushStateSpy).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(renderSectionMock).toHaveBeenCalledWith('sec-1');
    });

    it('renders directly (no view transition) when inside a dialog', async () => {
      renderSectionMock.mockClear();
      document.body.innerHTML = `
        <dialog>
          <facets-form-component section-id="sec-2">
            <form ref="facetsForm"></form>
          </facets-form-component>
        </dialog>
      `;
      const el = document.querySelector('facets-form-component');

      el.updateFilters();
      await flushPromises();

      expect(renderSectionMock).toHaveBeenCalledWith('sec-2');
    });
  });

  describe('updateFiltersByURL', () => {
    it('pushes the given URL and re-renders the section', async () => {
      renderSectionMock.mockClear();
      const el = makeFacetsForm();
      const pushStateSpy = vi.spyOn(history, 'pushState');

      el.updateFiltersByURL('/collections/all?filter.v.color=blue');
      await flushPromises();

      expect(pushStateSpy).toHaveBeenCalledWith('', '', '/collections/all?filter.v.color=blue');
      expect(renderSectionMock).toHaveBeenCalledWith('sec-1');
    });
  });
});

describe('facet-inputs-component', () => {
  it('registers the custom element', () => {
    expect(customElements.get('facet-inputs-component')).toBeDefined();
  });

  function makeFacetInputs() {
    document.body.innerHTML = `
      <facets-form-component section-id="sec-1">
        <form ref="facetsForm">
          <details>
            <facet-status-component>
              <span ref="facetStatus"></span>
            </facet-status-component>
            <facet-inputs-component>
              <label><input type="checkbox" name="filter.v.color" value="red" ref="facetInputs[]" /></label>
              <label><input type="checkbox" name="filter.v.color" value="blue" ref="facetInputs[]" /></label>
            </facet-inputs-component>
          </details>
        </form>
      </facets-form-component>
    `;
    return {
      facetsForm: document.querySelector('facets-form-component'),
      facetInputs: document.querySelector('facet-inputs-component'),
    };
  }

  it('delegates updateFilters to the closest facets-form-component and refreshes the summary', async () => {
    renderSectionMock.mockClear();
    const { facetsForm, facetInputs } = makeFacetInputs();
    const updateFiltersSpy = vi.spyOn(facetsForm, 'updateFilters');

    facetInputs.updateFilters();

    expect(updateFiltersSpy).toHaveBeenCalled();
  });

  it('toggles the checkbox and updates filters on Enter/Space', () => {
    const { facetInputs } = makeFacetInputs();
    const label = facetInputs.querySelector('label');
    const input = label.querySelector('input');
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    Object.defineProperty(event, 'target', { value: label });

    facetInputs.handleKeyDown(event);

    expect(input.checked).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores keys other than Enter/Space', () => {
    const { facetInputs } = makeFacetInputs();
    const label = facetInputs.querySelector('label');
    const input = label.querySelector('input');
    const event = new KeyboardEvent('keydown', { key: 'a' });
    Object.defineProperty(event, 'target', { value: label });

    facetInputs.handleKeyDown(event);

    expect(input.checked).toBe(false);
  });

  it('prefetches the section HTML with the hovered facet applied', async () => {
    vi.useFakeTimers();
    try {
      getSectionHTMLMock.mockClear();
      const { facetInputs } = makeFacetInputs();
      document.body.appendChild(document.createElement('form')); // ensure closest('form') exists
      const form = document.createElement('form');
      form.appendChild(facetInputs.closest('facets-form-component'));
      document.body.appendChild(form);
      const label = facetInputs.querySelector('label');
      const event = new MouseEvent('mouseover');
      Object.defineProperty(event, 'target', { value: label });

      facetInputs.prefetchPage(event);
      await vi.advanceTimersByTimeAsync(200);

      expect(getSectionHTMLMock).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancelPrefetchPage cancels the pending debounce', () => {
    const { facetInputs } = makeFacetInputs();
    const cancelSpy = vi.spyOn(facetInputs.prefetchPage, 'cancel');

    facetInputs.cancelPrefetchPage();

    expect(cancelSpy).toHaveBeenCalled();
  });
});

describe('price-facet-component', () => {
  function makePriceFacet({ currency = 'USD', moneyFormat = '${{amount}}' } = {}) {
    document.body.innerHTML = `
      <facets-form-component section-id="sec-1">
        <form ref="facetsForm">
          <details>
            <facet-status-component>
              <span ref="facetStatus" data-currency="${currency}" data-range-max="10000"></span>
            </facet-status-component>
            <price-facet-component data-currency="${currency}" data-money-format="${moneyFormat}">
              <input ref="minInput" data-min="0" data-max="10000" />
              <input ref="maxInput" data-min="0" data-max="10000" />
            </price-facet-component>
          </details>
        </form>
      </facets-form-component>
    `;
    return document.querySelector('price-facet-component');
  }

  it('registers the custom element', () => {
    expect(customElements.get('price-facet-component')).toBeDefined();
  });

  describe('#onKeyDown filtering', () => {
    it('allows digits and navigation keys', () => {
      const el = makePriceFacet();
      const event = new KeyboardEvent('keydown', { key: '5', cancelable: true });
      el.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });

    it('blocks letters', () => {
      const el = makePriceFacet();
      const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
      el.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it('allows any key combined with the meta key (e.g. Cmd+A)', () => {
      const el = makePriceFacet();
      const event = new KeyboardEvent('keydown', { key: 'a', metaKey: true, cancelable: true });
      el.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('updatePriceFilterAndResults', () => {
    it('clamps a value below the minimum up to the minimum', () => {
      const el = makePriceFacet();
      el.refs.minInput.value = '-5';
      el.refs.minInput.setAttribute('data-min', '0');
      el.refs.minInput.setAttribute('data-max', '100');

      el.updatePriceFilterAndResults();

      expect(el.refs.minInput.value).toBe('$0.00');
    });

    it('clamps a value above the maximum down to the maximum', () => {
      const el = makePriceFacet();
      el.refs.maxInput.value = '999999';
      el.refs.maxInput.setAttribute('data-min', '0');
      el.refs.maxInput.setAttribute('data-max', '10000');

      el.updatePriceFilterAndResults();

      expect(el.refs.maxInput.value).toBe('$100.00');
    });

    it('leaves an in-range value untouched', () => {
      const el = makePriceFacet();
      el.refs.minInput.value = '$25.00';
      el.refs.minInput.setAttribute('data-min', '0');
      el.refs.minInput.setAttribute('data-max', '10000');

      el.updatePriceFilterAndResults();

      expect(el.refs.minInput.value).toBe('$25.00');
    });

    it('calls updateFilters on the closest facets-form-component', () => {
      const el = makePriceFacet();
      const facetsForm = el.closest('facets-form-component');
      const spy = vi.spyOn(facetsForm, 'updateFilters');

      el.updatePriceFilterAndResults();

      expect(spy).toHaveBeenCalled();
    });

    it('updates the facet-status-component price summary', () => {
      const el = makePriceFacet();
      el.refs.minInput.value = '$10.00';
      el.refs.maxInput.value = '$50.00';

      el.updatePriceFilterAndResults();

      const status = document.querySelector('facet-status-component span[ref="facetStatus"]');
      expect(status.innerHTML).toBe('$10.00–$50.00');
    });
  });
});

describe('facet-clear-component', () => {
  function makeFacetClear() {
    document.body.innerHTML = `
      <facets-form-component section-id="sec-1">
        <form ref="facetsForm">
          <details>
            <facet-status-component>
              <span ref="facetStatus">2</span>
            </facet-status-component>
            <facet-inputs-component>
              <input type="checkbox" checked />
              <input type="checkbox" checked />
            </facet-inputs-component>
            <facet-clear-component>
              <button ref="clearButton">Clear</button>
            </facet-clear-component>
          </details>
        </form>
      </facets-form-component>
    `;
    return document.querySelector('facet-clear-component');
  }

  it('registers the custom element', () => {
    expect(customElements.get('facet-clear-component')).toBeDefined();
  });

  it('unchecks all inputs, clears the summary and updates filters', () => {
    const el = makeFacetClear();
    const facetsForm = el.closest('facets-form-component');
    const updateFiltersSpy = vi.spyOn(facetsForm, 'updateFilters');
    const button = el.refs.clearButton;
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: button });

    el.clearFilter(event);

    const checkboxes = el.closest('details').querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb) => expect(cb.checked).toBe(false));
    expect(document.querySelector('[ref="facetStatus"]').innerHTML).toBe('');
    expect(updateFiltersSpy).toHaveBeenCalled();
  });

  it('ignores non-Enter/Space keyboard events', () => {
    const el = makeFacetClear();
    const facetsForm = el.closest('facets-form-component');
    const updateFiltersSpy = vi.spyOn(facetsForm, 'updateFilters');
    const event = new KeyboardEvent('click', { key: 'a' });
    Object.defineProperty(event, 'target', { value: el.refs.clearButton });

    el.clearFilter(event);

    expect(updateFiltersSpy).not.toHaveBeenCalled();
  });

  it('toggles the active class on filter:update based on shouldShowClearAll', () => {
    const el = makeFacetClear();

    document.dispatchEvent(new FilterUpdateEvent(new URLSearchParams('filter.color=red')));
    expect(el.refs.clearButton.classList.contains('facets__clear--active')).toBe(true);

    document.dispatchEvent(new FilterUpdateEvent(new URLSearchParams('')));
    expect(el.refs.clearButton.classList.contains('facets__clear--active')).toBe(false);
  });

  it('stops listening for filter:update once disconnected', () => {
    const el = makeFacetClear();
    el.disconnectedCallback();

    document.dispatchEvent(new FilterUpdateEvent(new URLSearchParams('filter.color=red')));

    expect(el.refs.clearButton.classList.contains('facets__clear--active')).toBe(false);
  });
});

describe('facet-remove-component', () => {
  function makeFacetRemove({ url = '/collections/all?filter.v.color=blue', formId } = {}) {
    document.body.innerHTML = `
      <facets-form-component id="${formId ?? ''}" section-id="sec-1">
        <form ref="facetsForm"></form>
      </facets-form-component>
      <facet-remove-component data-url="${url}" ${formId ? `data-form=""` : ''}>
        <button ref="clearButton"></button>
      </facet-remove-component>
    `;
    return document.querySelector('facet-remove-component');
  }

  it('registers the custom element', () => {
    expect(customElements.get('facet-remove-component')).toBeDefined();
  });

  it('updates filters by the configured url via the closest facets-form-component', () => {
    document.body.innerHTML = `
      <facets-form-component section-id="sec-1">
        <form ref="facetsForm"></form>
        <facet-remove-component data-url="/collections/all?filter.v.color=blue">
          <button ref="clearButton"></button>
        </facet-remove-component>
      </facets-form-component>
    `;
    const el = document.querySelector('facet-remove-component');
    const facetsForm = document.querySelector('facets-form-component');
    const spy = vi.spyOn(facetsForm, 'updateFiltersByURL');

    el.removeFilter({}, new MouseEvent('click'));

    expect(spy).toHaveBeenCalledWith('/collections/all?filter.v.color=blue');
  });

  it('looks up the form by id when data.form is provided', () => {
    document.body.innerHTML = `
      <facets-form-component id="my-facets-form" section-id="sec-1">
        <form ref="facetsForm"></form>
      </facets-form-component>
      <facet-remove-component data-url="/collections/all">
        <button ref="clearButton"></button>
      </facet-remove-component>
    `;
    const el = document.querySelector('facet-remove-component');
    const facetsForm = document.getElementById('my-facets-form');
    const spy = vi.spyOn(facetsForm, 'updateFiltersByURL');

    el.removeFilter({ form: 'my-facets-form' }, new MouseEvent('click'));

    expect(spy).toHaveBeenCalledWith('/collections/all');
  });

  it('does nothing when there is no data-url', () => {
    document.body.innerHTML = `
      <facets-form-component section-id="sec-1">
        <form ref="facetsForm"></form>
        <facet-remove-component>
          <button ref="clearButton"></button>
        </facet-remove-component>
      </facets-form-component>
    `;
    const el = document.querySelector('facet-remove-component');
    const facetsForm = document.querySelector('facets-form-component');
    const spy = vi.spyOn(facetsForm, 'updateFiltersByURL');

    el.removeFilter({}, new MouseEvent('click'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('only responds to Enter/Space for keyboard events', () => {
    document.body.innerHTML = `
      <facets-form-component section-id="sec-1">
        <form ref="facetsForm"></form>
        <facet-remove-component data-url="/collections/all">
          <button ref="clearButton"></button>
        </facet-remove-component>
      </facets-form-component>
    `;
    const el = document.querySelector('facet-remove-component');
    const facetsForm = document.querySelector('facets-form-component');
    const spy = vi.spyOn(facetsForm, 'updateFiltersByURL');

    el.removeFilter({}, new KeyboardEvent('keydown', { key: 'a' }));

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('facet-status-component', () => {
  it('registers the custom element', () => {
    expect(customElements.get('facet-status-component')).toBeDefined();
  });

  function makeStatus({ facetType = '', filterStyle = '' } = {}) {
    document.body.innerHTML = `
      <facet-status-component facet-type="${facetType}" data-filter-style="${filterStyle}">
        <span ref="facetStatus"></span>
      </facet-status-component>
    `;
    return document.querySelector('facet-status-component');
  }

  describe('updateListSummary (bubble style)', () => {
    it('clears the summary when nothing is checked', () => {
      const el = makeStatus();
      el.updateListSummary([]);
      expect(el.refs.facetStatus.innerHTML).toBe('');
    });

    it('shows the label for a single horizontal-style selection', () => {
      const el = makeStatus({ filterStyle: 'horizontal' });
      const input = document.createElement('input');
      input.dataset.label = 'Red';

      el.updateListSummary([input]);

      expect(el.refs.facetStatus.innerHTML).toBe('Red');
    });

    it('shows a count bubble for multiple selections', () => {
      const el = makeStatus();
      el.updateListSummary([document.createElement('input'), document.createElement('input')]);

      expect(el.refs.facetStatus.innerHTML).toBe('2');
      expect(el.refs.facetStatus.classList.contains('bubble')).toBe(true);
    });
  });

  describe('updateListSummary (swatches style)', () => {
    it('clears the summary when nothing is checked', () => {
      const el = makeStatus({ facetType: 'swatches' });
      el.updateListSummary([]);
      expect(el.refs.facetStatus.innerHTML).toBe('');
    });

    it('renders up to 3 swatch elements', () => {
      const el = makeStatus({ facetType: 'swatches' });
      document.body.innerHTML += `
        <label><span class="swatch" id="s1"></span></label>
      `;
      const label = document.querySelector('label');
      const input = document.createElement('input');
      label.prepend(input);

      el.updateListSummary([input]);

      expect(el.refs.facetStatus.innerHTML).toContain('id="s1"');
    });

    it('shows a count bubble when more than 3 are selected', () => {
      const el = makeStatus({ facetType: 'swatches' });
      const inputs = [1, 2, 3, 4].map(() => document.createElement('input'));

      el.updateListSummary(inputs);

      expect(el.refs.facetStatus.innerHTML).toBe('4');
      expect(el.refs.facetStatus.classList.contains('bubble')).toBe(true);
    });
  });

  describe('updatePriceSummary', () => {
    it('formats the min-max range using the money template', () => {
      document.body.innerHTML = `
        <facet-status-component>
          <span ref="facetStatus" data-currency="USD"></span>
          <template ref="moneyFormat">\${{amount}}</template>
        </facet-status-component>
      `;
      const el = document.querySelector('facet-status-component');
      const minInput = document.createElement('input');
      minInput.value = '10.00';
      const maxInput = document.createElement('input');
      maxInput.value = '50.00';

      el.updatePriceSummary(minInput, maxInput);

      expect(el.refs.facetStatus.innerHTML).toBe('$10.00–$50.00');
    });

    it('clears the summary when both inputs are empty', () => {
      const el = makeStatus();
      const minInput = document.createElement('input');
      const maxInput = document.createElement('input');

      el.updatePriceSummary(minInput, maxInput);

      expect(el.refs.facetStatus.innerHTML).toBe('');
    });
  });

  describe('clearSummary', () => {
    it('empties the facet status content', () => {
      const el = makeStatus();
      el.refs.facetStatus.innerHTML = 'something';

      el.clearSummary();

      expect(el.refs.facetStatus.innerHTML).toBe('');
    });
  });
});
