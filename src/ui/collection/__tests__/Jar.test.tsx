import type { CollectionItem } from '@/domain/collection';
import type { Epoch } from '@/domain/types';
import { renderThemed } from '@/ui/testing';

import { Collection } from '../Collection';
import { Jar } from '../Jar';

const mockAnimate = jest.fn((to: number) => to);
let mockReduce = false;
jest.mock('../../useMotion', () => ({
  useMotion: () => ({ reduce: mockReduce, animate: mockAnimate }),
}));

const item = (i: number, over: Partial<CollectionItem> = {}): CollectionItem => ({
  kind: 'task', dayTaskId: `t${i}`, colorKey: 'study', small: false, gold: false, at: i as Epoch, ...over,
});

beforeEach(() => {
  mockAnimate.mockClear();
  mockReduce = false;
});

describe('Jar', () => {
  it('renders one marble per item and the accessibility label', async () => {
    const items = [item(1), item(2, { small: true }), item(3, { colorKey: 'sun', kind: 'planning', dayTaskId: null })];
    const { getByLabelText, queryByTestId } = await renderThemed(<Jar items={items} closed={false} />);
    getByLabelText('Jar with 3 marbles');
    expect(queryByTestId('marble-0')).toBeTruthy();
    expect(queryByTestId('marble-2')).toBeTruthy();
    expect(queryByTestId('marble-3')).toBeNull();
  });

  it('uses the singular for one marble and says closed', async () => {
    const { getByLabelText } = await renderThemed(<Jar items={[item(1)]} closed />);
    getByLabelText('Jar with 1 marble, closed');
  });

  it('draws gold rings only on gold items', async () => {
    const { queryByTestId } = await renderThemed(<Jar items={[item(1), item(2, { gold: true })]} closed={false} />);
    expect(queryByTestId('gold-1')).toBeTruthy();
    expect(queryByTestId('gold-0')).toBeNull();
  });

  it('shows the closed lid vs the open lid', async () => {
    const closed = await renderThemed(<Jar items={[]} closed />);
    expect(closed.queryByTestId('jar-lid-closed')).toBeTruthy();
    expect(closed.queryByTestId('jar-lid-open')).toBeNull();
    const open = await renderThemed(<Jar items={[]} closed={false} />);
    expect(open.queryByTestId('jar-lid-open')).toBeTruthy();
  });

  it('shows +N when items overflow the jar', async () => {
    const items = Array.from({ length: 200 }, (_, i) => item(i));
    const { getByTestId } = await renderThemed(<Jar items={items} closed={false} />);
    expect(getByTestId('jar-overflow')).toBeTruthy();
  });

  it('works at small and large scale', async () => {
    const small = await renderThemed(<Jar items={[item(1)]} closed={false} scale={0.65} />);
    small.getByLabelText('Jar with 1 marble');
    const large = await renderThemed(<Jar items={[item(1)]} closed={false} scale={2.3} />);
    large.getByLabelText('Jar with 1 marble');
  });

  it('Collection renders the jar', async () => {
    const { getByLabelText } = await renderThemed(<Collection items={[item(1)]} closed={false} />);
    getByLabelText('Jar with 1 marble');
  });
});

describe('animateLast', () => {
  it('does not animate when animateLast is off', async () => {
    await renderThemed(<Jar items={[item(1)]} closed={false} />);
    expect(mockAnimate).not.toHaveBeenCalled();
  });

  it('drops once on mount, not on a re-render with the same items, and again for a new item', async () => {
    const items = [item(1), item(2)];
    const { rerender } = await renderThemed(<Jar items={items} closed={false} animateLast />);
    expect(mockAnimate).toHaveBeenCalledTimes(1);
    await rerender(<Jar items={[...items]} closed={false} animateLast scale={1.2} />);
    expect(mockAnimate).toHaveBeenCalledTimes(1);
    await rerender(<Jar items={[...items, item(3)]} closed={false} animateLast />);
    expect(mockAnimate).toHaveBeenCalledTimes(2);
  });

  it('keeps the lid in step while animateLid is off, so enabling it later shows the right lid', async () => {
    const { rerender, getByTestId } = await renderThemed(<Jar items={[]} closed={false} />);
    await rerender(<Jar items={[]} closed />);
    await rerender(<Jar items={[]} closed animateLid />);
    getByTestId('jar-lid-closed');
    // closed lid = no lift, no rotation
    const flat = JSON.stringify(getByTestId('jar-lid-overlay').props.style);
    expect(flat).not.toMatch(/-14/);
    expect(flat).not.toMatch(/-16deg/);
    expect(mockAnimate).not.toHaveBeenCalled();
  });

  it('is instant under Reduce Motion', async () => {
    mockReduce = true;
    const { getByTestId } = await renderThemed(<Jar items={[item(1)]} closed={false} animateLast />);
    expect(mockAnimate).not.toHaveBeenCalled();
    expect(getByTestId('marble-0')).toBeTruthy();
  });
});

describe('animateLid', () => {
  it('swings shut only when closed flips false -> true', async () => {
    const { rerender, getByTestId } = await renderThemed(<Jar items={[]} closed={false} animateLid />);
    expect(mockAnimate).not.toHaveBeenCalled();
    getByTestId('jar-lid-open');
    await rerender(<Jar items={[]} closed animateLid />);
    expect(mockAnimate).toHaveBeenCalledTimes(1);
    expect(mockAnimate).toHaveBeenCalledWith(1);
    getByTestId('jar-lid-closed');
    await rerender(<Jar items={[item(1)]} closed animateLid scale={1.5} />);
    expect(mockAnimate).toHaveBeenCalledTimes(1);
  });

  it('does not animate when mounted already closed', async () => {
    const { getByTestId } = await renderThemed(<Jar items={[]} closed animateLid />);
    expect(mockAnimate).not.toHaveBeenCalled();
    getByTestId('jar-lid-closed');
  });

  it('does nothing extra without animateLid, and reopening is instant', async () => {
    const a = await renderThemed(<Jar items={[]} closed={false} />);
    await a.rerender(<Jar items={[]} closed />);
    expect(mockAnimate).not.toHaveBeenCalled();
    const b = await renderThemed(<Jar items={[]} closed animateLid />);
    await b.rerender(<Jar items={[]} closed={false} animateLid />);
    expect(mockAnimate).not.toHaveBeenCalled();
  });

  it('is instant under Reduce Motion', async () => {
    mockReduce = true;
    const { rerender, getByTestId } = await renderThemed(<Jar items={[]} closed={false} animateLid />);
    await rerender(<Jar items={[]} closed animateLid />);
    expect(mockAnimate).not.toHaveBeenCalled();
    getByTestId('jar-lid-closed');
  });

  it('Collection passes animateLid through', async () => {
    const { rerender } = await renderThemed(<Collection items={[]} closed={false} animateLid />);
    await rerender(<Collection items={[]} closed animateLid />);
    expect(mockAnimate).toHaveBeenCalledTimes(1);
  });
});
