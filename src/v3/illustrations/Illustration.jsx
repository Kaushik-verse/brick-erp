import { useEffect, useRef, useState } from 'react';
import './illustrations.css';

let loaded = null;
/** Loads the scenes on first use (they are large) and injects the kit's base CSS once. */
function loadScenes() {
  if (!loaded) {
    loaded = import('./scenes').then((m) => {
      if (!document.getElementById('anatomy-iso-css')) {
        const style = document.createElement('style');
        style.id = 'anatomy-iso-css';
        style.textContent = m.ISO_CSS;
        document.head.appendChild(style);
      }
      return m.SCENES;
    });
  }
  return loaded;
}

/**
 * Isometric scene (production | stock | delivery | sales). Animations run only while
 * the picture is on screen and never for reduced-motion users.
 */
export default function Illustration({ name, className = '', maxHeight }) {
  const [scenes, setScenes] = useState(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    loadScenes().then((s) => alive && setScenes(s)).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setVisible(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, [scenes]);

  const scene = scenes?.[name];
  return (
    <div
      ref={ref}
      className={`illo iso ${className}`}
      data-theme="light"
      data-paused={visible ? undefined : ''}
      style={maxHeight ? { maxHeight, overflow: 'hidden' } : undefined}
      // Trusted SVG generated at build time by design/illustrations/build.mjs
      dangerouslySetInnerHTML={scene ? { __html: scene.svg } : undefined}
    >
      {scene ? undefined : <div style={{ aspectRatio: '380 / 230' }} />}
    </div>
  );
}
