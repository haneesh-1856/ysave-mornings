import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

// Static charts for the Insights screen: plain shapes, theme colours, no animation. Each chart is one labelled
// image for a screen reader (the label states the numbers); the drawing itself is hidden from it.

const W = 240;

/** The labelled wrapper and the scaled SVG; `h` is the drawing height in viewBox units (width is always 240). */
export function Chart({ label, h, children }: { label: string; h: number; children: ReactNode }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: '100%' }}>
      <Svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{ aspectRatio: W / h }} importantForAccessibility="no" accessibilityElementsHidden>
        {children}
      </Svg>
    </View>
  );
}

/** Vertical bars on a shared baseline; `track` (optional) draws a faint full-height bar per slot behind each one. */
export function Bars({ values, max, color, label, h = 56, track }: { values: number[]; max: number; color: string; label: string; h?: number; track?: number[] }) {
  const t = useTheme();
  const slot = W / values.length;
  const bw = slot * 0.62;
  const top = 2;
  const span = h - top - 2;
  const height = (v: number) => (max > 0 && v > 0 ? Math.max(2, (v / max) * span) : 0);
  return (
    <Chart label={label} h={h}>
      {values.map((v, i) => {
        const x = i * slot + (slot - bw) / 2;
        const th = track ? height(track[i]) : 0;
        const bh = height(v);
        return (
          <G key={i}>
            {th > 0 ? <Rect x={x} y={h - 2 - th} width={bw} height={th} rx={1.5} fill={t.c.line} /> : null}
            {bh > 0 ? <Rect x={x} y={h - 2 - bh} width={bw} height={bh} rx={1.5} fill={color} /> : null}
          </G>
        );
      })}
      <Line x1={0} y1={h - 1} x2={W} y2={h - 1} stroke={t.c.line} strokeWidth={1} />
    </Chart>
  );
}

/** Two bars side by side per slot (same scale). */
export function PairedBars({ a, b, max, colorA, colorB, label, h = 56 }: { a: number[]; b: number[]; max: number; colorA: string; colorB: string; label: string; h?: number }) {
  const t = useTheme();
  const slot = W / a.length;
  const bw = slot * 0.3;
  const span = h - 4;
  const height = (v: number) => (max > 0 && v > 0 ? Math.max(2, (v / max) * span) : 0);
  return (
    <Chart label={label} h={h}>
      {a.map((v, i) => (
        <G key={i}>
          {height(v) > 0 ? <Rect x={i * slot + slot / 2 - bw - 1} y={h - 2 - height(v)} width={bw} height={height(v)} rx={1.5} fill={colorA} /> : null}
          {height(b[i]) > 0 ? <Rect x={i * slot + slot / 2 + 1} y={h - 2 - height(b[i])} width={bw} height={height(b[i])} rx={1.5} fill={colorB} /> : null}
        </G>
      ))}
      <Line x1={0} y1={h - 1} x2={W} y2={h - 1} stroke={t.c.line} strokeWidth={1} />
    </Chart>
  );
}

/** One horizontal bar split into coloured parts, in order. */
export function StackedBar({ parts, label }: { parts: { value: number; color: string }[]; label: string }) {
  const t = useTheme();
  const total = parts.reduce((s, p) => s + p.value, 0);
  // Width of each part; any part with a value gets at least 2, taken from the largest part (total unchanged).
  const widths = parts.map(p => (total > 0 ? (p.value / total) * W : 0));
  const big = widths.indexOf(Math.max(...widths, 0));
  widths.forEach((w, i) => {
    if (parts[i].value > 0 && w < 2 && i !== big) {
      widths[big] -= 2 - w;
      widths[i] = 2;
    }
  });
  let x = 0;
  return (
    <Chart label={label} h={16}>
      <Rect x={0} y={0} width={W} height={16} rx={4} fill={t.c.line} />
      {total > 0
        ? parts.map((p, i) => {
            const w = widths[i];
            const gap = i < parts.length - 1 ? 1 : 0;
            const r = <Rect key={i} x={x} y={0} width={p.value > 0 ? Math.max(2, w - gap) : 0} height={16} fill={p.color} />;
            x += w;
            return p.value > 0 ? r : null;
          })
        : null}
    </Chart>
  );
}

/** A planned bar above a focused bar for each row, all on one scale. */
export function PairRows({ rows, max, plannedColor, label }: { rows: { planned: number; focused: number; color: string }[]; max: number; plannedColor: string; label: string }) {
  const rowH = 24;
  const wOf = (v: number) => (max > 0 && v > 0 ? Math.max(2, (v / max) * W) : 0);
  return (
    <Chart label={label} h={rows.length * rowH}>
      {rows.map((r, i) => (
        <G key={i}>
          <Rect x={0} y={i * rowH + 2} width={wOf(r.planned)} height={8} rx={2} fill={plannedColor} opacity={0.45} />
          <Rect x={0} y={i * rowH + 12} width={wOf(r.focused)} height={8} rx={2} fill={r.color} />
        </G>
      ))}
    </Chart>
  );
}

/** One dot per value on a 0..max scale, with a tick at the median. */
export function DotStrip({ values, max, median, color, label }: { values: number[]; max: number; median: number | null; color: string; label: string }) {
  const t = useTheme();
  const x = (v: number) => 6 + (max > 0 ? (v / max) * (W - 12) : 0);
  return (
    <Chart label={label} h={32}>
      <Line x1={6} y1={16} x2={W - 6} y2={16} stroke={t.c.line} strokeWidth={2} />
      {values.map((v, i) => (
        <Circle key={i} cx={x(v)} cy={16} r={4.5} fill={color} opacity={0.6} />
      ))}
      {median !== null ? <Line x1={x(median)} y1={4} x2={x(median)} y2={28} stroke={t.c.ink} strokeWidth={1.5} /> : null}
    </Chart>
  );
}
