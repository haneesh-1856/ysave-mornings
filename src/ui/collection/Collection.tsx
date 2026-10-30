import { Jar, type CollectionProps } from './Jar';

export type { CollectionProps };

/**
 * Picks the renderer for the look's collection style (`theme.look.art`). M3 has only the glass jar;
 * the other eleven looks (M7) plug in here with the same props. Until then every look falls back to the jar.
 */
export function Collection(props: CollectionProps) {
  return <Jar {...props} />;
}
