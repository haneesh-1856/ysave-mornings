import { screen } from '@testing-library/react-native';
import { makeMutable } from 'react-native-reanimated';

import { Label3D, Scene3D } from '../moments/Scene3D';
import type { Prim } from '../moments/three';
import { renderThemed } from '../testing';

const size = { w: 400, h: 800 };
const prim = (depth: number, o: Partial<Prim> = {}): Prim => ({
  pts: [0, 0, 10, 0, 10, 10], depth, fill: 'rgb(1,2,3)', fillOpacity: 0.5, stroke: '#ffffff', strokeOpacity: 0.2, strokeWidth: 1, dashed: false, ...o,
});
const paths = () => screen.getAllByTestId('scene3d-path', { hidden: true });
// `draw` and `at` are worklets in the app (they run on the UI thread); plain functions are fine under jest.

describe('Scene3D', () => {
  it('renders one path per slot, hidden from screen readers and from touches', async () => {
    await renderThemed(<Scene3D lt={makeMutable(0)} size={size} slots={5} draw={() => [prim(3), prim(1)]} />);
    expect(paths()).toHaveLength(5);
    const svg = screen.getByTestId('scene3d', { hidden: true });
    expect(svg.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(svg.props.pointerEvents).toBe('none');
  });

  it('draws the prims far to near into the first slots, and the unused slots draw nothing', async () => {
    await renderThemed(
      <Scene3D lt={makeMutable(0)} size={size} slots={3} draw={() => [prim(1, { pts: [0, 0, 1, 1], dashed: true, fill: 'none', fillOpacity: 0 }), prim(5)]} />,
    );
    const [a, b, c] = paths().map((p) => p.props);
    // depth 5 is farther, so it is slot 0
    expect(a.d).toBe('M0 0 L10 0 L10 10 Z');
    expect(a.fill.payload).toBe(0xff010203);
    expect(a.fillOpacity).toBe(0.5);
    expect(a.strokeDasharray).toEqual([100000, 0]);
    expect(b.d).toBe('M0 0 L1 1');
    expect(b.fillOpacity).toBe(0);
    expect(b.strokeDasharray).toEqual([6, 5]);
    expect(c.d).toBe('M0 0');
    expect(c.fillOpacity).toBe(0);
    expect(c.strokeOpacity).toBe(0);
  });

  it('with more prims than slots the farthest are dropped', async () => {
    const draw = () => [prim(8, { fill: 'rgb(8,8,8)' }), prim(2, { fill: 'rgb(2,2,2)' }), prim(6, { fill: 'rgb(6,6,6)' }), prim(4, { fill: 'rgb(4,4,4)' })];
    await renderThemed(<Scene3D lt={makeMutable(0)} size={size} slots={2} draw={draw} />);
    expect(paths().map((p) => p.props.fill.payload)).toEqual([0xff040404, 0xff020202]);
  });

  it('renders no paths for zero slots', async () => {
    await renderThemed(<Scene3D lt={makeMutable(0)} size={size} slots={0} draw={() => [prim(1)]} />);
    expect(screen.queryAllByTestId('scene3d-path', { includeHiddenElements: true })).toHaveLength(0);
    expect(screen.getByTestId('scene3d', { hidden: true })).toBeTruthy();
  });
});

describe('Label3D', () => {
  it('renders its text', async () => {
    await renderThemed(<Label3D lt={makeMutable(0)} at={() => [100, 200, 1]} text="MON" size={12} color="#fff" screen={size} />);
    expect(screen.getByText('MON', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('data pass-through', () => {
  it('Scene3D hands data and size to draw', async () => {
    const draw = (_lt: number, d: { depth: number }, s: { w: number }) => [prim(d.depth, { fill: `rgb(${s.w % 256},0,0)` })];
    await renderThemed(<Scene3D lt={makeMutable(0)} size={size} slots={1} draw={draw} data={{ depth: 2 }} />);
    expect(paths()[0].props.fill.payload).toBe(0xff900000);
  });

  it('Label3D hands data and screen to at, and an optional 4th value is the colour', async () => {
    const at = (_lt: number, i: number, s: { w: number }): [number, number, number, string] => [i * 10, 20, 1, s.w > 0 ? '#abcdef' : '#000000'];
    await renderThemed(<Label3D lt={makeMutable(0)} at={at} data={3} text="W" size={12} color="#fff" screen={size} />);
    const style = screen.getByText('W', { includeHiddenElements: true }).props.style;
    expect(JSON.stringify(style)).toContain('#abcdef');
  });
});

describe('Scene3D freezeAt', () => {
  it('draws once from freezeAt on and keeps that frame', async () => {
    const draw = jest.fn((l: number) => [prim(1, { fill: `rgb(${Math.round(l)},0,0)` })]);
    const lt = makeMutable(5);
    await renderThemed(<Scene3D lt={lt} size={size} slots={1} draw={draw} freezeAt={2} />);
    expect(draw).toHaveBeenCalledWith(2, undefined, size);
    // drawn at freezeAt (2), not at lt (5); the rebuild-skip itself is a UI-thread behaviour jest cannot observe
    lt.value = 4;
    expect(paths()[0].props.fill.payload).toBe(0xff020000);
  });
});
