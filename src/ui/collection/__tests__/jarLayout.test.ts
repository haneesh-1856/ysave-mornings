import type { CollectionItem } from '@/domain/collection';
import type { Epoch } from '@/domain/types';

import { FULL_R, SMALL_R, lastItemKey, layoutJar } from '../jarLayout';

const item = (over: Partial<CollectionItem> = {}): CollectionItem => ({
  kind: 'task', dayTaskId: 'x', colorKey: 'study', small: false, gold: false, at: 1 as Epoch, ...over,
});
const many = (n: number) => Array.from({ length: n }, (_, i) => item({ dayTaskId: `t${i}`, at: i as Epoch }));

describe('layoutJar', () => {
  it('is empty for no items', () => {
    expect(layoutJar([])).toEqual({ marbles: [], overflow: 0 });
  });

  it('uses the prototype spots for up to 8 items, in item order, bottom row first', () => {
    const { marbles, overflow } = layoutJar(many(8));
    expect(overflow).toBe(0);
    expect(marbles.map(m => m.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(marbles[0]).toMatchObject({ x: 20, y: 72, r: FULL_R });
    // later rows sit higher (smaller y)
    expect(marbles[3].y).toBeLessThan(marbles[0].y);
    expect(marbles[5].y).toBeLessThan(marbles[3].y);
  });

  it('sizes small items smaller, on the same baseline, and carries gold and color', () => {
    const { marbles } = layoutJar([item({ small: true, colorKey: 'home' }), item({ gold: true, colorKey: 'sun' })]);
    expect(marbles[0].r).toBe(SMALL_R);
    expect(marbles[1].r).toBe(FULL_R);
    expect(marbles[0].y + marbles[0].r).toBeCloseTo(79, 0); // bottom edge ~ same as 72 + 7
    expect(marbles[0].colorKey).toBe('home');
    expect(marbles[1].gold).toBe(true);
    expect(marbles[0].gold).toBe(false);
  });

  it.each([9, 20, 40, 80])('keeps %i marbles inside the jar and shrinks to fit', n => {
    const { marbles, overflow } = layoutJar(many(n));
    expect(marbles.length + overflow).toBe(n);
    if (n <= 40) expect(overflow).toBe(0);
    for (const m of marbles) {
      expect(m.x - m.r).toBeGreaterThanOrEqual(12.9);
      expect(m.x + m.r).toBeLessThanOrEqual(57.1);
      expect(m.y + m.r).toBeLessThanOrEqual(79.1);
      expect(m.y - m.r).toBeGreaterThanOrEqual(25.9);
    }
    if (n === 9) expect(marbles[0].r).toBeLessThan(FULL_R + 0.001);
  });

  it('caps at capacity with an overflow count, oldest first', () => {
    const { marbles, overflow } = layoutJar(many(500));
    expect(overflow).toBeGreaterThan(0);
    expect(marbles.length + overflow).toBe(500);
    expect(marbles.map(m => m.index)).toEqual(marbles.map((_, i) => i));
  });

  it('does not overlap packed marbles', () => {
    const { marbles } = layoutJar(many(30));
    for (let i = 0; i < marbles.length; i++)
      for (let j = i + 1; j < marbles.length; j++) {
        const d = Math.hypot(marbles[i].x - marbles[j].x, marbles[i].y - marbles[j].y);
        expect(d).toBeGreaterThanOrEqual(marbles[i].r + marbles[j].r - 0.01);
      }
  });
});

describe('lastItemKey', () => {
  it('is null for no items and changes when an item is added', () => {
    expect(lastItemKey([])).toBeNull();
    const a = many(2);
    expect(lastItemKey(a)).toBe(lastItemKey([...a]));
    expect(lastItemKey(many(3))).not.toBe(lastItemKey(a));
  });
});
