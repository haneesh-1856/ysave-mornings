import { act, screen } from '@testing-library/react-native';
import { makeMutable } from 'react-native-reanimated';

import { DEFAULT_LAB_FLAGS, flagsText, getLabFlags, labStep, setLabFlags, setLabSink } from '../moments/lab';
import { Roll } from '../moments/parts';
import { Label3D, Scene3D } from '../moments/Scene3D';
import type { Prim } from '../moments/three';
import { renderThemed } from '../testing';

// The Moments lab (dev, 2026-11-05) and the Pixel 9a fixes: digits as one-line texts, the 3D switches, the trail.

const size = { w: 400, h: 800 };
const prim = (o: Partial<Prim> = {}): Prim => ({
  pts: [0, 0, 10, 0, 10, 10], depth: 1, fill: 'rgb(1,2,3)', fillOpacity: 0.5, stroke: 'none', strokeOpacity: 0, strokeWidth: 1, dashed: true, ...o,
});
const paths = () => screen.getAllByTestId('scene3d-path', { hidden: true });

afterEach(() => {
  setLabFlags(DEFAULT_LAB_FLAGS);
  setLabSink(null);
});

describe('Roll digits (Pixel 9a: only "/" and ":" showed)', () => {
  it('draws every digit column as one-line texts, never one multi-line text', async () => {
    await renderThemed(<Roll text="4/4" x={100} y={100} fs={60} from={0} label="TASKS" lt={makeMutable(10)} settled={false} size={size} />);
    expect(screen.queryAllByText(/\n/, { hidden: true })).toHaveLength(0);
    // Two columns of 0-9 twice: the digit 4 appears twice in each.
    expect(screen.getAllByText('4', { hidden: true })).toHaveLength(4);
    expect(screen.getByText('/', { hidden: true })).toBeTruthy();
  });
});

describe('lab flags', () => {
  it('fall back to the defaults field by field', () => {
    expect(setLabFlags(undefined)).toEqual(DEFAULT_LAB_FLAGS);
    expect(setLabFlags({ colors: 'noNone' as never, dashes: false })).toEqual({ ...DEFAULT_LAB_FLAGS, dashes: false });
    expect(getLabFlags().dashes).toBe(false);
    expect(flagsText({ scene3d: true, colors: 'fixed', dashes: false, labels: true, glow: false })).toBe('3D on, colours fixed, dashes off, labels on, glow off');
  });

  it('defaults draw as designed, with no string "none" reaching an animated colour', async () => {
    await renderThemed(<Scene3D lt={makeMutable(0)} size={size} slots={2} draw={() => [prim()]} />);
    const [a, b] = paths().map((p) => p.props);
    expect(a.fill.payload).toBe(0xff010203);
    expect(a.stroke.payload).toBe(0x00000000);
    expect(a.strokeOpacity).toBe(0);
    expect(a.strokeDasharray).toEqual([6, 5]);
    expect(b.d).toBe('M0 0');
    expect(b.fill.payload).toBe(0x00000000);
    expect(b.fillOpacity).toBe(0);
  });

  it('scene3d off mounts no 3D drawing', async () => {
    setLabFlags({ scene3d: false });
    await renderThemed(<Scene3D lt={makeMutable(0)} size={size} slots={2} draw={() => [prim()]} />);
    expect(screen.queryByTestId('scene3d', { hidden: true })).toBeNull();
  });

  it('fixed colours keep one static fill and stroke; dashes off sends no dash prop', async () => {
    setLabFlags({ colors: 'fixed', dashes: false });
    await renderThemed(<Scene3D lt={makeMutable(0)} size={size} slots={1} draw={() => [prim()]} />);
    const [a] = paths().map((p) => p.props);
    expect(a.fill.payload).toBe(0xff5b616c);
    expect(a.d).toBe('M0 0 L10 0 L10 10 Z');
    expect(a.strokeDasharray).toBeUndefined();
  });

  it('labels off draws no Label3D', async () => {
    setLabFlags({ labels: false });
    await renderThemed(<Label3D lt={makeMutable(0)} at={() => [10, 10, 1]} text="BEST 2:30" size={12} color="#fff" screen={size} />);
    expect(screen.queryByText('BEST 2:30', { hidden: true })).toBeNull();
  });
});

describe('lab trail', () => {
  it('does nothing without a sink and never throws from a failing one', () => {
    expect(() => labStep('x')).not.toThrow();
    setLabSink(() => {
      throw new Error('disk full');
    });
    expect(() => labStep('x')).not.toThrow();
  });

  it('Scene3D reports its mount with the switches, and its unmount', async () => {
    const steps: string[] = [];
    setLabSink((s) => steps.push(s));
    await renderThemed(<Scene3D lt={makeMutable(0)} size={size} slots={3} draw={() => [prim()]} />);
    expect(steps[0]).toBe('3D scene mounted: 3 shapes (3D on, colours animated, dashes on, labels on, glow on)');
    await act(async () => screen.unmount());
    expect(steps).toContain('3D scene unmounted');
  });
});
