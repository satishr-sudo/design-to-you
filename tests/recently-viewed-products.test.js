import { beforeEach, describe, expect, it } from 'vitest';
import { RecentlyViewed } from '@theme/recently-viewed-products';

describe('RecentlyViewed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty array when nothing has been viewed', () => {
    expect(RecentlyViewed.getProducts()).toEqual([]);
  });

  it('adds a product to the front of the list', () => {
    RecentlyViewed.addProduct('p1');
    RecentlyViewed.addProduct('p2');

    expect(RecentlyViewed.getProducts()).toEqual(['p2', 'p1']);
  });

  it('moves an already-viewed product to the front instead of duplicating it', () => {
    RecentlyViewed.addProduct('p1');
    RecentlyViewed.addProduct('p2');
    RecentlyViewed.addProduct('p1');

    expect(RecentlyViewed.getProducts()).toEqual(['p1', 'p2']);
  });

  it('keeps only the most recent 4 products', () => {
    RecentlyViewed.addProduct('p1');
    RecentlyViewed.addProduct('p2');
    RecentlyViewed.addProduct('p3');
    RecentlyViewed.addProduct('p4');
    RecentlyViewed.addProduct('p5');

    expect(RecentlyViewed.getProducts()).toEqual(['p5', 'p4', 'p3', 'p2']);
  });

  it('clears the stored products', () => {
    RecentlyViewed.addProduct('p1');
    RecentlyViewed.clearProducts();

    expect(RecentlyViewed.getProducts()).toEqual([]);
  });
});
