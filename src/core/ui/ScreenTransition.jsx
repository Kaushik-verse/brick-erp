import { useLayoutEffect, useRef } from 'react';

/**
 * ScreenTransition
 * -----------------
 * Wraps the active tab's screen content with a short fade + slide in.
 *
 * Performance: this used to be framer-motion's AnimatePresence mode="wait",
 * which kept the OLD screen on screen for its 150 ms exit animation before the
 * new one even started rendering, so every tap waited ~300 ms. Now the new
 * screen renders immediately and plays a CSS entrance (opacity + transform
 * only, so it runs on the compositor, not the JavaScript thread).
 */
function resetScroll() {
  // The <body> is the scroll container (html/body are height:100%), so
  // window.scrollTo alone does nothing — reset every candidate.
  window.scrollTo(0, 0);
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
}

export default function ScreenTransition({ activeKey, children }) {
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    resetScroll();
  }, [activeKey]);

  return (
    <div key={activeKey} className="screen-enter w-full">
      {children}
    </div>
  );
}
