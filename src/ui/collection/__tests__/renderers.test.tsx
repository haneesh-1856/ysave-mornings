import { render } from '@testing-library/react-native';
import type { ComponentType } from 'react';

import type { CollectionItem } from '@/domain/collection';
import type { Epoch } from '@/domain/types';
import { DEFAULT_LOOK, type LookMix } from '@/theme/look';
import { ThemeProvider, useLookStore } from '@/theme/ThemeProvider';
import { renderThemed } from '@/ui/testing';

import { Bracelet } from '../Bracelet';
import { Cairn } from '../Cairn';
import { Collection, type CollectionProps } from '../Collection';
import { Garden } from '../Garden';
import { Honey } from '../Honey';
import { Jar } from '../Jar';
import { capOf, collectionLabel } from '../kit';
import { Lights } from '../Lights';
import { Plant } from '../Plant';
import { Shelf } from '../Shelf';
import { Sky } from '../Sky';
import { StampCard } from '../StampCard';

const mockAnimate = jest.fn((to: number) => to);
let mockReduce = false;
jest.mock('../../useMotion', () => ({
  useMotion: () => ({ reduce: mockReduce, animate: mockAnimate }),
}));

const item = (i: number, over: Partial<CollectionItem> = {}): CollectionItem => ({
  kind: 'task', dayTaskId: `t${i}`, colorKey: 'study', small: false, gold: false, at: i as Epoch, ...over,
});
// Overlays (newest item, closed decoration) are the views marked pointerEvents="none".
const overlayCount = (r: { toJSON: () => unknown }) => (JSON.stringify(r.toJSON()).match(/"pointerEvents":"none"/g) ?? []).length;
const many = (n: number) => Array.from({ length: n }, (_, i) => item(i));

afterEach(() => useLookStore.setState({ look: DEFAULT_LOOK }));
beforeEach(() => {
  mockAnimate.mockClear();
  mockReduce = false;
});

type Row = { name: string; C: ComponentType<CollectionProps>; label: string; unit: string; cap: number; deco: string; testIdOverflow: string };
const rows: Row[] = [
  { name: 'Garden', C: Garden, label: 'Garden', unit: 'flower', cap: 7, deco: 'garden-moon', testIdOverflow: 'garden-overflow' },
  { name: 'Plant', C: Plant, label: 'Plant', unit: 'leaf', cap: 8, deco: 'plant-bloom', testIdOverflow: 'plant-overflow' },
  { name: 'Sky', C: Sky, label: 'Sky', unit: 'star', cap: 12, deco: 'sky-moon', testIdOverflow: 'sky-overflow' },
  { name: 'Bracelet', C: Bracelet, label: 'Bracelet', unit: 'bead', cap: 12, deco: 'bracelet-clasp', testIdOverflow: 'bracelet-overflow' },
  { name: 'Cairn', C: Cairn, label: 'Cairn', unit: 'stone', cap: 9, deco: 'cairn-top', testIdOverflow: 'cairn-overflow' },
  { name: 'Lights', C: Lights, label: 'Lights', unit: 'light', cap: 12, deco: 'lights-moon', testIdOverflow: 'lights-overflow' },
  { name: 'Honey', C: Honey, label: 'Honeycomb', unit: 'cell', cap: 12, deco: 'honey-bee', testIdOverflow: 'honey-overflow' },
  { name: 'Shelf', C: Shelf, label: 'Shelf', unit: 'book', cap: 8, deco: 'shelf-bookend', testIdOverflow: 'shelf-overflow' },
  { name: 'StampCard', C: StampCard, label: 'Stamp card', unit: 'stamp', cap: 10, deco: 'card-stamp', testIdOverflow: 'card-overflow' },
];

describe.each(rows)('$name', ({ C, label, unit, cap, deco, testIdOverflow }) => {
  const plural = (n: number) => (n === 1 ? unit : unit === 'leaf' ? 'leaves' : `${unit}s`);

  it('draws 0, 1, cap and cap + 3 items with the right label', async () => {
    const a = await renderThemed(<C items={[]} closed={false} />);
    a.getByLabelText(`${label} with 0 ${plural(0)}`);
    expect(a.queryByTestId('item-0')).toBeNull();
    const b = await renderThemed(<C items={many(1)} closed={false} />);
    b.getByLabelText(`${label} with 1 ${plural(1)}`);
    expect(b.queryByTestId('item-0')).toBeTruthy();
    const c = await renderThemed(<C items={many(cap)} closed={false} />);
    c.getByLabelText(`${label} with ${cap} ${plural(cap)}`);
    expect(c.queryByTestId(`item-${cap - 1}`)).toBeTruthy();
    expect(c.queryByTestId(testIdOverflow)).toBeNull();
    const d = await renderThemed(<C items={many(cap + 3)} closed={false} />);
    expect(d.getByTestId(testIdOverflow)).toBeTruthy();
    expect(d.queryByTestId(`item-${cap}`)).toBeNull();
  });

  it('draws small and gold items', async () => {
    const items = [item(0), item(1, { small: true }), item(2, { gold: true })];
    const { queryByTestId } = await renderThemed(<C items={items} closed={false} />);
    expect(queryByTestId('item-1')).toBeTruthy();
    expect(queryByTestId('item-2')).toBeTruthy();
  });

  it('shows the closed decoration only when closed, and says closed', async () => {
    const open = await renderThemed(<C items={many(2)} closed={false} />);
    expect(open.queryByTestId(deco)).toBeNull();
    const shut = await renderThemed(<C items={many(2)} closed />);
    expect(shut.queryByTestId(deco)).toBeTruthy();
    shut.getByLabelText(`${label} with 2 ${plural(2)}, closed`);
  });

  it('animates the decoration in only on a later false -> true flip', async () => {
    const mounted = await renderThemed(<C items={[]} closed animateLid />);
    expect(mockAnimate).not.toHaveBeenCalled();
    mounted.getByTestId(deco);
    const { rerender, queryByTestId } = await renderThemed(<C items={[]} closed={false} animateLid />);
    expect(queryByTestId(deco)).toBeNull();
    await rerender(<C items={[]} closed animateLid />);
    expect(mockAnimate).toHaveBeenCalledTimes(1);
    expect(queryByTestId(deco)).toBeTruthy();
    await rerender(<C items={[]} closed={false} animateLid />);
    expect(mockAnimate).toHaveBeenCalledTimes(1);
    expect(queryByTestId(deco)).toBeNull();
  });

  it('plays the arrival once per new item, not on a re-render', async () => {
    const items = many(2);
    const { rerender } = await renderThemed(<C items={items} closed={false} animateLast />);
    expect(mockAnimate).toHaveBeenCalledTimes(1);
    await rerender(<C items={[...items]} closed={false} animateLast scale={1.4} />);
    expect(mockAnimate).toHaveBeenCalledTimes(1);
    await rerender(<C items={[...items, item(9)]} closed={false} animateLast />);
    expect(mockAnimate).toHaveBeenCalledTimes(2);
  });

  it('does not animate without animateLast, nor when items overflow', async () => {
    await renderThemed(<C items={many(2)} closed={false} />);
    expect(mockAnimate).not.toHaveBeenCalled();
    const full = await renderThemed(<C items={many(cap)} closed={false} animateLast />);
    const overlays = overlayCount(full);
    expect(overlays).toBeGreaterThan(0); // the newest item's overlay
    const over = await renderThemed(<C items={many(cap + 2)} closed={false} animateLast />);
    expect(over.queryByTestId(`item-${cap - 1}`)).toBeTruthy();
    expect(overlayCount(over)).toBeLessThan(overlays); // no overlay when items overflow
  });

  it('is instant under Reduce Motion', async () => {
    mockReduce = true;
    const { getByTestId, rerender } = await renderThemed(<C items={many(2)} closed={false} animateLast animateLid />);
    await rerender(<C items={many(2)} closed animateLast animateLid />);
    expect(mockAnimate).not.toHaveBeenCalled();
    expect(getByTestId('item-1')).toBeTruthy();
    expect(getByTestId(deco)).toBeTruthy();
  });
});

describe('Jar variants', () => {
  it.each(['line', 'paper'] as const)('%s draws marbles, gold, lid and overflow', async variant => {
    const items = [item(0), item(1, { gold: true, small: true })];
    const a = await renderThemed(<Jar items={items} closed={false} variant={variant} />);
    a.getByLabelText('Jar with 2 marbles');
    expect(a.queryByTestId('marble-1')).toBeTruthy();
    expect(a.queryByTestId('gold-1')).toBeTruthy();
    expect(a.queryByTestId('gold-0')).toBeNull();
    expect(a.queryByTestId('jar-lid-open')).toBeTruthy();
    const b = await renderThemed(<Jar items={many(200)} closed variant={variant} />);
    expect(b.queryByTestId('jar-lid-closed')).toBeTruthy();
    expect(b.queryByTestId('jar-overflow')).toBeTruthy();
  });

  it('animates the lid for the line variant too', async () => {
    const { rerender, getByTestId } = await renderThemed(<Jar items={[]} closed={false} animateLid variant="line" />);
    await rerender(<Jar items={[]} closed animateLid variant="line" />);
    expect(mockAnimate).toHaveBeenCalledWith(1);
    getByTestId('jar-lid-closed');
  });
});

describe('Collection dispatch', () => {
  it.each([
    ['garden', 'Garden with 1 flower'],
    ['plant', 'Plant with 1 leaf'],
    ['sky', 'Sky with 1 star'],
    ['bracelet', 'Bracelet with 1 bead'],
    ['line', 'Jar with 1 marble'],
    ['paper', 'Jar with 1 marble'],
    ['glass', 'Jar with 1 marble'],
    ['cairn', 'Cairn with 1 stone'],
    ['lights', 'Lights with 1 light'],
    ['honey', 'Honeycomb with 1 cell'],
    ['shelf', 'Shelf with 1 book'],
    ['card', 'Stamp card with 1 stamp'],
  ] as const)('look %s renders %s', async (art, label) => {
    useLookStore.setState({ look: { ...DEFAULT_LOOK, art } });
    const { getByLabelText } = await renderThemed(<Collection items={many(1)} closed={false} />);
    getByLabelText(label);
  });
});

describe('kit', () => {
  it('capOf keeps the first cap items and counts the rest', () => {
    expect(capOf(many(5), 3)).toEqual({ shown: many(5).slice(0, 3), overflow: 2 });
    expect(capOf(many(2), 3).overflow).toBe(0);
  });

  it('collectionLabel pluralises, uses leaves, and appends closed', () => {
    expect(collectionLabel('garden', 3, true)).toBe('Garden with 3 flowers, closed');
    expect(collectionLabel('plant', 2, false)).toBe('Plant with 2 leaves');
    expect(collectionLabel('card', 1, false)).toBe('Stamp card with 1 stamp');
  });
});

describe('all looks', () => {
  const CAPS = { glass: 8, line: 8, paper: 8, garden: 7, plant: 8, sky: 12, bracelet: 12, cairn: 9, lights: 12, honey: 12, shelf: 8, card: 10 } as const;
  const arts = Object.keys(CAPS) as (keyof typeof CAPS)[];

  it.each(arts)('%s draws 0 and cap + 1 items, open and closed, under a ThemeProvider override', async art => {
    const look: LookMix = { ...DEFAULT_LOOK, art };
    for (const n of [0, CAPS[art] + 1]) {
      for (const closed of [false, true]) {
        const { getByLabelText, unmount } = await render(
          <ThemeProvider look={look}><Collection items={many(n)} closed={closed} animateLast animateLid /></ThemeProvider>,
        );
        getByLabelText(collectionLabel(art, n, closed));
        await unmount();
      }
    }
  });
});
