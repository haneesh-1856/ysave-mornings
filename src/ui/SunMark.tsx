import Svg, { Line, Path } from 'react-native-svg';

const CENTER = 50;
const RING_RADIUS = 18.4;
const RING_WIDTH = 8.5;
const RAY_WIDTH = 5;
const RAY_OUTER = 32;
/** Ray angle (degrees clockwise from top) and the radius where it starts. Matches assets/brand/unfinished-sun.svg. */
const RAYS: readonly (readonly [number, number])[] = [
  [0, 19.2], [90, 22.4], [180, 22.4], [270, 22.4], [135, 22.0], [315, 16.6],
];
const RING_START = 40; // the ring runs clockwise from 40 to 315 degrees; the opening is 315 to 40

const point = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: CENTER + r * Math.sin(a), y: CENTER - r * Math.cos(a) };
};

const RING_FROM = point(RING_START, RING_RADIUS);
const RING_TO = point(315, RING_RADIUS);
const RING_PATH = `M${RING_FROM.x.toFixed(2)} ${RING_FROM.y.toFixed(2)} A${RING_RADIUS} ${RING_RADIUS} 0 1 1 ${RING_TO.x.toFixed(2)} ${RING_TO.y.toFixed(2)}`;

/** The app icon's mark (an unfinished sun: ring with an opening, six rays) on a transparent background. Decorative. */
export function SunMark({ size, color = '#f7d45e' }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessible={false} importantForAccessibility="no-hide-descendants" testID="sun-mark">
      <Path testID="sun-ring" d={RING_PATH} fill="none" stroke={color} strokeWidth={RING_WIDTH} strokeLinecap="butt" />
      {RAYS.map(([deg, inner]) => {
        const from = point(deg, inner);
        const to = point(deg, RAY_OUTER);
        return (
          <Line
            key={deg}
            testID="sun-ray"
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke={color} strokeWidth={RAY_WIDTH} strokeLinecap="butt"
          />
        );
      })}
    </Svg>
  );
}
