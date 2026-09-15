import { describe, expect, it } from 'vitest';
import '@theme/product-custom-property';

function renderCustomProperty(innerMarkup) {
  document.body.innerHTML = `<product-custom-property-component>${innerMarkup}</product-custom-property-component>`;
  return document.querySelector('product-custom-property-component');
}

describe('product-custom-property-component', () => {
  it('registers the custom element', () => {
    expect(customElements.get('product-custom-property-component')).toBeDefined();
  });

  it('updates the character count text using the data-template placeholders', () => {
    const el = renderCustomProperty(
      '<textarea ref="textInput" maxlength="20">Hello</textarea>' +
        '<span ref="characterCount" data-template="[current] of [max] characters"></span>'
    );

    el.handleInput();

    expect(el.refs.characterCount.textContent).toBe('5 of 20 characters');
  });

  it('recalculates the count as the input value changes', () => {
    const el = renderCustomProperty(
      '<input ref="textInput" maxlength="10" value="abc" />' +
        '<span ref="characterCount" data-template="[current]/[max]"></span>'
    );

    el.handleInput();
    expect(el.refs.characterCount.textContent).toBe('3/10');

    el.refs.textInput.value = 'abcdefg';
    el.handleInput();
    expect(el.refs.characterCount.textContent).toBe('7/10');
  });

  it('does nothing when there is no data-template attribute', () => {
    const el = renderCustomProperty(
      '<input ref="textInput" maxlength="10" value="abc" />' + '<span ref="characterCount">unchanged</span>'
    );

    el.handleInput();

    expect(el.refs.characterCount.textContent).toBe('unchanged');
  });

  it('handles an empty input value', () => {
    const el = renderCustomProperty(
      '<textarea ref="textInput" maxlength="500"></textarea>' +
        '<span ref="characterCount" data-template="[current] of [max]"></span>'
    );

    el.handleInput();

    expect(el.refs.characterCount.textContent).toBe('0 of 500');
  });
});
