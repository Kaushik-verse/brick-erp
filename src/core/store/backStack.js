/**
 * backStack.js
 * -------------
 * Tiny registry so the Android hardware back button closes the top-most
 * open sheet/dialog first, instead of jumping out of the whole screen.
 */
const stack = [];

export function pushBackHandler(fn) {
  stack.push(fn);
  return () => {
    const i = stack.lastIndexOf(fn);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Runs the top-most handler. Returns true if something handled it. */
export function handleBack() {
  const fn = stack[stack.length - 1];
  if (!fn) return false;
  fn();
  return true;
}
