import { describe, expect, it, vi } from 'vitest';

const { QRCodeMock } = vi.hoisted(() => ({ QRCodeMock: vi.fn() }));
vi.mock('@theme/qr-code-generator', () => ({ QRCode: QRCodeMock }));

await import('@theme/qr-code-image');

describe('qr-code-image', () => {
  it('registers the custom element', () => {
    expect(customElements.get('qr-code-image')).toBeDefined();
  });

  it('constructs a QRCode with the data-identifier as text and default dimensions', () => {
    QRCodeMock.mockClear();
    document.body.innerHTML = '<qr-code-image data-identifier="https://example.com/product/1"></qr-code-image>';

    const [element, options] = QRCodeMock.mock.calls[0];
    expect(element).toBe(document.querySelector('qr-code-image'));
    expect(options).toEqual({ text: 'https://example.com/product/1', width: 72, height: 72, alt: '' });
  });

  it('uses explicit width, height and alt attributes when provided', () => {
    QRCodeMock.mockClear();
    document.body.innerHTML =
      '<qr-code-image data-identifier="abc" width="150" height="150" alt="QR code for product"></qr-code-image>';

    const [, options] = QRCodeMock.mock.calls[0];
    expect(options).toEqual({ text: 'abc', width: 150, height: 150, alt: 'QR code for product' });
  });

  it('falls back to the default dimensions when width/height are not numeric', () => {
    QRCodeMock.mockClear();
    document.body.innerHTML = '<qr-code-image data-identifier="abc" width="not-a-number" height="also-bad"></qr-code-image>';

    const [, options] = QRCodeMock.mock.calls[0];
    expect(options).toEqual({ text: 'abc', width: 72, height: 72, alt: '' });
  });

  it('uses an empty string as text when there is no data-identifier', () => {
    QRCodeMock.mockClear();
    document.body.innerHTML = '<qr-code-image></qr-code-image>';

    const [, options] = QRCodeMock.mock.calls[0];
    expect(options.text).toBe('');
  });
});
