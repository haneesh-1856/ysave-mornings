# 06 · Design system

**Source of truth for values:** the `PAL`, `FONT`, `SHAPE`, `SURF`, `GLASS`, `GBLUR`, `ART`, `MOTION`,
`TRANS`, `LAYOUT`, `BAR`, `NAV` and `PRESETS` constants in `drafts/ysave-style-lab.html`. They get
ported **verbatim** into `src/theme/tokens.ts` by a script (done in M0). Edit that file from now on.

## The look mix

The app's appearance is one object the user can change. It's stored in `settings.look`:

```ts
type LookMix = {
  pal: 'mist'|'sunrise'|'lagoon'|'lavender'|'mono'|'night';
  font: 'jakarta'|'nunito'|'fraunces'|'bricolage'|'plex';
  shape: 'soft'|'round'|'crisp'|'square';
  surf: 'flat'|'raised'|'outline'|'glass';
  glass: GlassKey;            // 28 tints, e.g. 'match' | 'aurora' | … | 'neon'
  gblur: 'thin'|'soft'|'medium'|'heavy'|'deep';
  art: 'glass'|'line'|'paper'|'garden'|'sky'|'bracelet'|'cairn'|'lights'|'honey'|'shelf'|'plant'|'card';
  motion: 'gentle'|'springy'|'crisp'|'calm';
  trans: 'slide'|'fade'|'expand'|'rise';
  layout: 'corner'|'hero'|'dock';
  bar: 'seg'|'smooth'|'thin';
  nav: 'float'|'bar'|'minimal';
};
```

**Default (the owner's saved mix):** `night`, `jakarta`, `soft`, `glass` (tint `match`, blur `medium`),
`glass` jar, `springy`, `slide`, `dock`, `thin`, `float`.

Unknown or missing keys (from older versions) fall back to the default field by field.

## From mix to theme

`buildTheme(mix)` returns a plain object every component reads via `useTheme()`:

- `colors`: the palette (bg, surface, ink, muted, line, accent, on, 6 topic colors, sun, tint1–3, frame).
- **`color-mix()` doesn't exist in React Native.** `colorMix(a, b, pct)` in `theme/colorMix.ts` mixes
  hex colors in sRGB and pre-computes every derived color the prototype makes with CSS: the topic
  fold background (topic 30% over bg), frost, selected states, chain colors, and glow.
- `radius` (`r`, `rb`), `font` families (+ the `num` family: Fraunces uses its own numerals),
  `motion` (duration + easing → a Reanimated spring/timing config), `surface` style recipe.

## Surfaces

| surf | Recipe in RN |
|---|---|
| flat | `surface` fill + 1 px `line` border |
| raised | `surface` fill + platform shadow (iOS shadow*, Android elevation 3) |
| outline | 1.5 px `ink` border + 3/3 hard offset shadow (an extra View behind) |
| glass | **Background**: full-screen SVG with 3 radial-gradient blobs (`GLASS[tint].b`, strength `bs`). **Cards**: `expo-blur` BlurView (intensity from blur level) + frost tint overlay (`tone` mixed `tm` into surface, opacity `a`) + 1 px light inner border |

**Android blur:** `expo-blur` on Android uses the experimental blur method. If it's slow on a device, or
the user turns on "Reduce transparency" (iOS), fall back to the frost tint without blur. It looks almost
the same.

## Typography (real-device scale)

| Role | Size / weight |
|---|---|
| Screen title | 25 / 700, letter-spacing −0.5 |
| Body / task name | 16 / 600 |
| Secondary | 13 / 500 muted |
| Label (lbl2) | 11.5 / 700, uppercase, +1 letter-spacing |
| Big countdown | 70 / 800, tabular numerals |

Fonts are loaded at startup with `useFonts`. The splash screen stays up until they're ready.

## Components (`src/ui`)

Button (primary / ghost / danger), Card, Fold (topic accordion), TaskRow, CheckRow, NoteLine, NoteCard,
WeekRing (7 tappable slices, MTWTFSS), TimeSlider (5–180 step 5), Switch, Segmented, ChipSet, Stepper,
ConfirmBox, CountdownBar (seg 15-min sections / smooth / thin + overtime stripes), BigNumber, Chain,
TabBar (float / bar / minimal), Background (glass blobs), Collection (dispatches to 12 renderers).

## Collection renderers

Each renderer is one component with props `{ items, closed, scale, animateLast }`.
Items are `{ colorKey, small, gold }`. The SVG geometry is ported from the prototype's `jarSVG`,
`gardenSVG` and `EXTRA_ART`. The arrival animation per look:

| look | arrival |
|---|---|
| glass / line / paper jar, bracelet, cairn, shelf | drop from above with a bounce |
| garden, plant | grow from the base |
| sky, honeycomb | pop (scale 0 → 1.35 → 1) |
| stamp card | stamp (scale 2.2 → 0.92 → 1) |
| fairy lights | flicker on |

Closing the day adds the "closed" decoration (lid, moon, bee, clasp, "DAY CLOSED" stamp…).

## Motion & transitions

- `motion` presets: gentle 420 ms, springy 650 ms (overshoot), crisp 200 ms, calm 820 ms. Every animation
  reads them from the theme.
- `trans` → Expo Router stack `animation`: slide → `slide_from_right`, fade → `fade`,
  rise → `slide_from_bottom`, expand → `fade` in v1 (true "grow from the task" needs shared-element
  transitions, which are later work).
- Tab switches always fade.
- **Reduced motion** (OS setting) turns off drops, glow pulsing and transitions. Everything
  appears instantly.

## Haptics & sound

Light haptic on tick and on start. A success haptic and a soft chime (if Sounds is on) when a task
completes and when the jar closes.
