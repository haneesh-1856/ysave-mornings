// Under jest, reanimated/worklets resolve to their JS-only builds (see "resolver" in package.json), which have no UI
// runtime. Gesture-handler would try to install UI-runtime bindings on it; skip that.
jest.mock('react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings', () => ({
  installUIRuntimeBindings: () => {},
}));
