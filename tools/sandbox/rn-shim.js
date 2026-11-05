// What `react-native` means in the sandbox: react-native-web (as on Expo web) plus the few native-only names some
// libraries import at the top of a file and never call on web (Metro leaves those undefined; esbuild needs them).
import { useWindowDimensions as rnwUseWindowDimensions } from 'react-native-web';

export * from 'react-native-web';
export const TurboModuleRegistry = { get: () => null, getEnforcing: () => null };
export function codegenNativeComponent() { return null; }
export function codegenNativeCommands() { return {}; }
export function requireNativeComponent() { return null; }

// "Pixel 9a size": the player asks the window size once per mount; the sandbox can answer with a phone's size so the
// scenes lay out exactly as on a 412x915 dp screen even in a wide desktop window.
let phoneSize = null;
export function setPhoneSize(size) {
  phoneSize = size;
  document.documentElement.classList.toggle('phone-frame', !!size);
}
export function useWindowDimensions() {
  const real = rnwUseWindowDimensions();
  return phoneSize ? { ...real, width: phoneSize.width, height: phoneSize.height } : real;
}

// adjustsFontSizeToFit is native only: react-native-web ignores it and a one-line Text gets an ellipsis instead. The
// phone shrinks the font until the line fits, so the sandbox does the same after layout (down to minimumFontScale).
import { StyleSheet, Text as RnwText } from 'react-native-web';
import { createElement, forwardRef, useCallback, useLayoutEffect, useRef } from 'react';

export const Text = forwardRef(function Text(props, ref) {
  const node = useRef(null);
  const fit = props.adjustsFontSizeToFit;
  const setRef = useCallback((el) => {
    node.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }, [ref]);
  useLayoutEffect(() => {
    const el = node.current;
    if (!fit || !el || !el.style) return;
    // react-native-web writes the style's fontSize inline, so the size asked for comes from the props, not the node.
    const base = StyleSheet.flatten(props.style)?.fontSize;
    if (!base) return;
    el.style.fontSize = `${base}px`;
    const floor = base * (props.minimumFontScale || 0.1);
    let size = base;
    // The element clips with an ellipsis; scrollWidth is the full line. Scale by the ratio, re-check (kerning).
    for (let i = 0; i < 4 && el.scrollWidth > el.clientWidth + 0.5 && size > floor; i++) {
      size = Math.max(floor, size * (el.clientWidth / el.scrollWidth) * 0.995);
      el.style.fontSize = `${size}px`;
    }
  });
  return createElement(RnwText, { ...props, ref: setRef });
});
