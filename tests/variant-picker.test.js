import { describe, expect, it, vi } from 'vitest';

const { morphMock, MORPH_OPTIONS_MOCK } = vi.hoisted(() => ({
  morphMock: vi.fn(),
  MORPH_OPTIONS_MOCK: { childrenOnly: true },
}));
vi.mock('@theme/morph', () => ({ morph: morphMock, MORPH_OPTIONS: MORPH_OPTIONS_MOCK }));

const VariantPicker = (await import('@theme/variant-picker')).default;

function makeVariantPicker({ productUrl = '/products/widget', productId = '1', templateMatch = 'true' } = {}) {
  document.body.innerHTML = `
    <variant-picker data-product-url="${productUrl}" data-product-id="${productId}" data-template-product-match="${templateMatch}">
      <fieldset ref="fieldsets[]">
        <label>
          <input type="radio" name="Color" value="Red" data-option-value-id="red" data-fieldset-index="0" data-input-index="0" data-current-checked="true" checked />
        </label>
        <label>
          <input type="radio" name="Color" value="Blue" data-option-value-id="blue" data-fieldset-index="0" data-input-index="1" />
        </label>
      </fieldset>
    </variant-picker>
  `;
  return document.querySelector('variant-picker');
}

describe('variant-picker', () => {
  it('registers the custom element', () => {
    expect(customElements.get('variant-picker')).toBeDefined();
  });

  describe('selectedOption / selectedOptionId / selectedOptionsValues', () => {
    it('returns the checked radio as the selected option', () => {
      const picker = makeVariantPicker();
      expect(picker.selectedOption.dataset.optionValueId).toBe('red');
      expect(picker.selectedOptionId).toBe('red');
      expect(picker.selectedOptionsValues).toEqual(['red']);
    });

    it('returns undefined for selectedOptionId when nothing is selected', () => {
      document.body.innerHTML = `
        <variant-picker>
          <fieldset ref="fieldsets[]">
            <input type="radio" name="Color" data-option-value-id="red" />
          </fieldset>
        </variant-picker>
      `;
      const picker = document.querySelector('variant-picker');
      expect(picker.selectedOption).toBeUndefined();
      expect(picker.selectedOptionId).toBeUndefined();
    });

    it('throws when a selected option is missing its option-value-id', () => {
      document.body.innerHTML = `
        <variant-picker>
          <fieldset ref="fieldsets[]">
            <input type="radio" name="Color" checked />
          </fieldset>
        </variant-picker>
      `;
      const picker = document.querySelector('variant-picker');
      expect(() => picker.selectedOptionId).toThrow('No option value ID found');
    });

    it('reads the selected option from a <select> element', () => {
      document.body.innerHTML = `
        <variant-picker>
          <select>
            <option data-option-value-id="s" value="Small">Small</option>
            <option data-option-value-id="m" value="Medium" selected>Medium</option>
          </select>
        </variant-picker>
      `;
      const picker = document.querySelector('variant-picker');
      expect(picker.selectedOptionId).toBe('m');
    });
  });

  describe('updateSelectedOption', () => {
    it('checks the target radio and marks it as currentChecked', () => {
      const picker = makeVariantPicker();
      const blueRadio = picker.querySelector('[data-option-value-id="blue"]');

      picker.updateSelectedOption(blueRadio);

      expect(blueRadio.checked).toBe(true);
      expect(blueRadio.dataset.currentChecked).toBe('true');
    });

    it('marks the previous selection as previousChecked and no longer current', () => {
      const picker = makeVariantPicker();
      const redRadio = picker.querySelector('[data-option-value-id="red"]');
      const blueRadio = picker.querySelector('[data-option-value-id="blue"]');

      picker.updateSelectedOption(blueRadio);

      expect(redRadio.dataset.previousChecked).toBe('true');
      expect(redRadio.dataset.currentChecked).toBe('false');
    });

    it('resolves a string target via data-option-value-id lookup', () => {
      const picker = makeVariantPicker();

      picker.updateSelectedOption('blue');

      expect(picker.querySelector('[data-option-value-id="blue"]').checked).toBe(true);
    });

    it('throws when a string target does not resolve to an element', () => {
      const picker = makeVariantPicker();
      expect(() => picker.updateSelectedOption('does-not-exist')).toThrow('Target element not found');
    });

    it('updates a <select> element, moving the selected attribute', () => {
      document.body.innerHTML = `
        <variant-picker>
          <select>
            <option data-option-value-id="s" value="Small" selected>Small</option>
            <option data-option-value-id="m" value="Medium">Medium</option>
          </select>
        </variant-picker>
      `;
      const picker = document.querySelector('variant-picker');
      const select = picker.querySelector('select');
      select.value = 'Medium';

      picker.updateSelectedOption(select);

      expect(select.querySelector('[value="Medium"]').hasAttribute('selected')).toBe(true);
      expect(select.querySelector('[value="Small"]').hasAttribute('selected')).toBe(false);
    });

    it('throws when the select value has no matching option', () => {
      document.body.innerHTML = `
        <variant-picker>
          <select><option value="Small">Small</option></select>
        </variant-picker>
      `;
      const picker = document.querySelector('variant-picker');
      const select = picker.querySelector('select');
      // Force an out-of-band value with no matching <option>.
      Object.defineProperty(select, 'value', { value: 'DoesNotExist', configurable: true });

      expect(() => picker.updateSelectedOption(select)).toThrow('Option not found');
    });
  });

  describe('buildRequestUrl', () => {
    it('includes the currently selected options as option_values', () => {
      const picker = makeVariantPicker({ productUrl: '/products/widget' });
      const blueRadio = picker.querySelector('[data-option-value-id="blue"]');

      const url = picker.buildRequestUrl(blueRadio);

      expect(url).toBe('/products/widget?option_values=red');
    });

    it('preserves the view query parameter when present', () => {
      window.history.pushState({}, '', '/?view=custom');
      const picker = makeVariantPicker();
      const blueRadio = picker.querySelector('[data-option-value-id="blue"]');

      const url = picker.buildRequestUrl(blueRadio);

      expect(url).toContain('view=custom');
      window.history.pushState({}, '', '/');
    });

    it('appends a section_id when nested inside a quick-add-component', () => {
      document.body.innerHTML = `
        <quick-add-component>
          <variant-picker data-product-url="/products/widget">
            <fieldset ref="fieldsets[]">
              <input type="radio" data-option-value-id="red" data-fieldset-index="0" data-input-index="0" checked />
            </fieldset>
          </variant-picker>
        </quick-add-component>
      `;
      const picker = document.querySelector('variant-picker');
      const radio = picker.querySelector('[data-option-value-id="red"]');

      const url = picker.buildRequestUrl(radio);

      expect(url).toContain('section_id=section-rendering-product-card');
    });

    it('strips an existing query string from the product url before appending section_id', () => {
      document.body.innerHTML = `
        <quick-add-component>
          <variant-picker data-product-url="/products/widget?variant=1">
            <fieldset ref="fieldsets[]">
              <input type="radio" data-option-value-id="red" data-fieldset-index="0" data-input-index="0" checked />
            </fieldset>
          </variant-picker>
        </quick-add-component>
      `;
      const picker = document.querySelector('variant-picker');
      const radio = picker.querySelector('[data-option-value-id="red"]');

      const url = picker.buildRequestUrl(radio);

      expect(url.startsWith('/products/widget?section_id=')).toBe(true);
    });

    it('uses only the clicked option value for the product-card source when nothing is otherwise selected', () => {
      document.body.innerHTML = `
        <variant-picker data-product-url="/products/widget">
          <fieldset ref="fieldsets[]">
            <input type="radio" data-option-value-id="red" data-fieldset-index="0" data-input-index="0" />
          </fieldset>
        </variant-picker>
      `;
      const picker = document.querySelector('variant-picker');
      const radio = picker.querySelector('[data-option-value-id="red"]');

      const url = picker.buildRequestUrl(radio, 'product-card');

      expect(url).toBe('/products/widget?option_values=red');
    });
  });

  describe('updateFieldsetCss / updateVariantPickerCss', () => {
    it('does nothing for a NaN fieldset index', () => {
      const picker = makeVariantPicker();
      expect(() => picker.updateFieldsetCss(NaN)).not.toThrow();
    });

    it('sets the pill-width custom properties based on the checked radios offsetWidth', () => {
      const picker = makeVariantPicker();
      const blueRadio = picker.querySelector('[data-option-value-id="blue"]');
      Object.defineProperty(blueRadio.parentElement, 'offsetWidth', { value: 42, configurable: true });

      picker.updateSelectedOption(blueRadio);

      const fieldset = picker.querySelector('fieldset');
      expect(fieldset.style.getPropertyValue('--pill-width-current')).toBe('42px');
    });
  });

  describe('updateVariantPicker', () => {
    it('morphs the element with the new source and returns undefined when the product id is unchanged', () => {
      morphMock.mockClear();
      const picker = makeVariantPicker({ productId: '1' });
      const newHtml = document.implementation.createHTMLDocument('');
      newHtml.body.innerHTML = `<variant-picker data-product-id="1" data-product-url="/products/widget"></variant-picker>`;

      const result = picker.updateVariantPicker(newHtml);

      expect(morphMock).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('returns the new product info when the product id changes (combined listing)', () => {
      morphMock.mockClear();
      const picker = makeVariantPicker({ productId: '1' });
      const newHtml = document.implementation.createHTMLDocument('');
      newHtml.body.innerHTML = `<variant-picker data-product-id="2" data-product-url="/products/other"></variant-picker>`;

      const result = picker.updateVariantPicker(newHtml);

      expect(result).toEqual({ id: '2', url: '/products/other' });
      expect(picker.dataset.productId).toBe('2');
    });

    it('throws when there is no matching source element in the new html', () => {
      const picker = makeVariantPicker();
      const newHtml = document.implementation.createHTMLDocument('');
      newHtml.body.innerHTML = `<div>no variant picker here</div>`;

      expect(() => picker.updateVariantPicker(newHtml)).toThrow('No new variant picker source found');
    });
  });

  describe('updateElement / updateMain', () => {
    it('updateElement morphs the closest matching ancestor with the new element', () => {
      morphMock.mockClear();
      document.body.innerHTML = `
        <div class="wrapper">
          <variant-picker></variant-picker>
        </div>
      `;
      const picker = document.querySelector('variant-picker');
      const newHtml = document.implementation.createHTMLDocument('');
      newHtml.body.innerHTML = `<div class="wrapper">new</div>`;

      picker.updateElement(newHtml, '.wrapper');

      expect(morphMock).toHaveBeenCalledTimes(1);
    });

    it('updateElement throws when there is no matching element', () => {
      const picker = makeVariantPicker();
      const newHtml = document.implementation.createHTMLDocument('');

      expect(() => picker.updateElement(newHtml, '.missing')).toThrow(/No new element source found/);
    });

    it('updateMain morphs the document main element', () => {
      morphMock.mockClear();
      document.body.innerHTML = `<main><variant-picker></variant-picker></main>`;
      const picker = document.querySelector('variant-picker');
      const newHtml = document.implementation.createHTMLDocument('');
      newHtml.body.innerHTML = `<main>new main</main>`;

      picker.updateMain(newHtml);

      expect(morphMock).toHaveBeenCalledTimes(1);
    });

    it('updateMain throws when there is no <main> element', () => {
      const picker = makeVariantPicker();
      const newHtml = document.implementation.createHTMLDocument('');

      expect(() => picker.updateMain(newHtml)).toThrow('No new main source found');
    });
  });

  describe('fetchUpdatedSection', () => {
    it('fetches, parses the response and dispatches a VariantUpdateEvent', async () => {
      morphMock.mockClear();
      const picker = makeVariantPicker({ productId: '1' });
      const variantJson = JSON.stringify({ id: 'v-blue', available: true });
      globalThis.fetch = vi.fn().mockResolvedValue({
        text: () =>
          Promise.resolve(
            `<variant-picker data-product-id="1"><script type="application/json">${variantJson}</script></variant-picker>`
          ),
      });
      const handler = vi.fn();
      picker.addEventListener('variant:update', handler);

      picker.fetchUpdatedSection('/products/widget?option_values=blue');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].detail.resource).toEqual({ id: 'v-blue', available: true });
    });

    it('does nothing when the response has no embedded variant JSON script', async () => {
      const picker = makeVariantPicker();
      globalThis.fetch = vi.fn().mockResolvedValue({
        text: () => Promise.resolve('<variant-picker></variant-picker>'),
      });
      const handler = vi.fn();
      picker.addEventListener('variant:update', handler);

      picker.fetchUpdatedSection('/products/widget');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(handler).not.toHaveBeenCalled();
    });

    it('logs (not throws) when the fetch fails for a reason other than abort', async () => {
      const picker = makeVariantPicker();
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      picker.fetchUpdatedSection('/products/widget');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(errorSpy).toHaveBeenCalled();
    });

    it('aborts a previous pending request when called again', () => {
      const picker = makeVariantPicker();
      const signals = [];
      globalThis.fetch = vi.fn((url, { signal }) => {
        signals.push(signal);
        return new Promise(() => {});
      });

      picker.fetchUpdatedSection('/a');
      picker.fetchUpdatedSection('/b');

      expect(signals[0].aborted).toBe(true);
    });
  });
});
