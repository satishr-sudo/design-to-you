import { describe, expect, it } from 'vitest';
import {
  ThemeEvents,
  VariantSelectedEvent,
  VariantUpdateEvent,
  CartAddEvent,
  CartUpdateEvent,
  CartErrorEvent,
  QuantitySelectorUpdateEvent,
  DiscountUpdateEvent,
  MediaStartedPlayingEvent,
  SlideshowSelectEvent,
  ZoomMediaSelectedEvent,
  MegaMenuHoverEvent,
  FilterUpdateEvent,
} from '@theme/events';

describe('ThemeEvents', () => {
  it('exposes stable string constants for each event type', () => {
    expect(ThemeEvents.variantSelected).toBe('variant:selected');
    expect(ThemeEvents.variantUpdate).toBe('variant:update');
    expect(ThemeEvents.cartUpdate).toBe('cart:update');
    expect(ThemeEvents.cartError).toBe('cart:error');
    expect(ThemeEvents.mediaStartedPlaying).toBe('media:started-playing');
    expect(ThemeEvents.quantitySelectorUpdate).toBe('quantity-selector:update');
    expect(ThemeEvents.megaMenuHover).toBe('megaMenu:hover');
    expect(ThemeEvents.zoomMediaSelected).toBe('zoom-media:selected');
    expect(ThemeEvents.discountUpdate).toBe('discount:update');
    expect(ThemeEvents.FilterUpdate).toBe('filter:update');
  });
});

describe('VariantSelectedEvent', () => {
  it('carries the resource in detail and bubbles', () => {
    const resource = { id: '123' };
    const event = new VariantSelectedEvent(resource);

    expect(event.type).toBe(ThemeEvents.variantSelected);
    expect(event.bubbles).toBe(true);
    expect(event.detail.resource).toBe(resource);
  });
});

describe('VariantUpdateEvent', () => {
  it('normalizes a missing resource to null and carries data through', () => {
    const data = { html: document, productId: 'p1', newProduct: undefined };
    const event = new VariantUpdateEvent(null, 'source-1', data);

    expect(event.type).toBe(ThemeEvents.variantUpdate);
    expect(event.detail.resource).toBeNull();
    expect(event.detail.sourceId).toBe('source-1');
    expect(event.detail.data.productId).toBe('p1');
    expect(event.detail.data.html).toBe(document);
    expect(event.detail.data.newProduct).toBeUndefined();
  });

  it('preserves a provided resource', () => {
    const resource = { id: 'v1', available: true };
    const event = new VariantUpdateEvent(resource, 'source-2', { html: document, productId: 'p2' });

    expect(event.detail.resource).toBe(resource);
  });
});

describe('CartAddEvent', () => {
  it('uses the shared cart:update event name', () => {
    expect(CartAddEvent.eventName).toBe(ThemeEvents.cartUpdate);
  });

  it('spreads the data object into detail.data', () => {
    const event = new CartAddEvent({ id: 1 }, 'src', { itemCount: 3, variantId: 'v1' });

    expect(event.type).toBe(ThemeEvents.cartUpdate);
    expect(event.detail.resource).toEqual({ id: 1 });
    expect(event.detail.sourceId).toBe('src');
    expect(event.detail.data).toEqual({ itemCount: 3, variantId: 'v1' });
  });

  it('handles being constructed with no arguments', () => {
    const event = new CartAddEvent();

    expect(event.detail.resource).toBeUndefined();
    expect(event.detail.data).toEqual({});
  });
});

describe('CartUpdateEvent', () => {
  it('carries resource, sourceId and data', () => {
    const event = new CartUpdateEvent({ id: 2 }, 'src-2', { didError: false });

    expect(event.type).toBe(ThemeEvents.cartUpdate);
    expect(event.detail.resource).toEqual({ id: 2 });
    expect(event.detail.data.didError).toBe(false);
  });
});

describe('CartErrorEvent', () => {
  it('carries the message, errors and description in detail.data', () => {
    const event = new CartErrorEvent('src-3', 'Something went wrong', { code: 'x' }, ['error1']);

    expect(event.type).toBe(ThemeEvents.cartError);
    expect(event.detail.sourceId).toBe('src-3');
    expect(event.detail.data.message).toBe('Something went wrong');
    expect(event.detail.data.description).toEqual({ code: 'x' });
    expect(event.detail.data.errors).toEqual(['error1']);
  });
});

describe('QuantitySelectorUpdateEvent', () => {
  it('carries quantity and optional cartLine', () => {
    const event = new QuantitySelectorUpdateEvent(5, 42);

    expect(event.type).toBe(ThemeEvents.quantitySelectorUpdate);
    expect(event.detail.quantity).toBe(5);
    expect(event.detail.cartLine).toBe(42);
  });

  it('allows cartLine to be omitted', () => {
    const event = new QuantitySelectorUpdateEvent(1);
    expect(event.detail.cartLine).toBeUndefined();
  });
});

describe('DiscountUpdateEvent', () => {
  it('carries resource and sourceId', () => {
    const event = new DiscountUpdateEvent({ code: 'SAVE10' }, 'src-4');

    expect(event.type).toBe(ThemeEvents.discountUpdate);
    expect(event.detail.resource).toEqual({ code: 'SAVE10' });
    expect(event.detail.sourceId).toBe('src-4');
  });
});

describe('MediaStartedPlayingEvent', () => {
  it('carries the resource element', () => {
    const el = document.createElement('div');
    const event = new MediaStartedPlayingEvent(el);

    expect(event.type).toBe(ThemeEvents.mediaStartedPlaying);
    expect(event.detail.resource).toBe(el);
  });
});

describe('SlideshowSelectEvent', () => {
  it('uses the slideshow:select event name and carries the full data payload', () => {
    const slide = document.createElement('div');
    const data = { index: 1, id: 'slide-1', slide, previousIndex: 0, userInitiated: true, trigger: 'select' };
    const event = new SlideshowSelectEvent(data);

    expect(SlideshowSelectEvent.eventName).toBe('slideshow:select');
    expect(event.type).toBe('slideshow:select');
    expect(event.detail).toEqual(data);
  });
});

describe('ZoomMediaSelectedEvent', () => {
  it('carries the selected index', () => {
    const event = new ZoomMediaSelectedEvent(3);

    expect(event.type).toBe(ThemeEvents.zoomMediaSelected);
    expect(event.detail.index).toBe(3);
  });
});

describe('MegaMenuHoverEvent', () => {
  it('has no detail payload', () => {
    const event = new MegaMenuHoverEvent();
    expect(event.type).toBe(ThemeEvents.megaMenuHover);
  });
});

describe('FilterUpdateEvent', () => {
  it('carries the query params in detail', () => {
    const params = new URLSearchParams('filter.color=red');
    const event = new FilterUpdateEvent(params);

    expect(event.type).toBe(ThemeEvents.FilterUpdate);
    expect(event.detail.queryParams).toBe(params);
  });

  describe('shouldShowClearAll', () => {
    it('returns true when at least one filter.* param is present', () => {
      const event = new FilterUpdateEvent(new URLSearchParams('filter.color=red&sort=price'));
      expect(event.shouldShowClearAll()).toBe(true);
    });

    it('returns false when there are no filter.* params', () => {
      const event = new FilterUpdateEvent(new URLSearchParams('sort=price&page=2'));
      expect(event.shouldShowClearAll()).toBe(false);
    });

    it('returns false for an empty query string', () => {
      const event = new FilterUpdateEvent(new URLSearchParams(''));
      expect(event.shouldShowClearAll()).toBe(false);
    });
  });
});
