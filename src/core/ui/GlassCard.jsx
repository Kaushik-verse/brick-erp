
import clsx from 'clsx';

/**
 * GlassCard
 * ----------
 * The base visual container of the entire app. Implements the
 * "liquid glass" signature: backdrop blur, soft inner highlight,
 * subtle border, deep ambient shadow.
 */
export default function GlassCard({
  children,
  className,
  onClick,
  animate = true,
  padding = 'p-4',
  light = false,
}) {
  // Rendered as a div with button semantics (not a <button>) so cards can
  // safely contain their own buttons (e.g. WhatsApp) — nested <button>s are
  // invalid HTML and misbehave on Android WebView.
  const interactiveProps = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: (e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(e);
          }
        },
      }
    : {};

  // Performance: the entrance and tap feedback used to be framer-motion springs,
  // i.e. JavaScript writing styles every frame for every card (330 style writes
  // when Insights opened). They are now CSS animations on opacity/transform with
  // the same feel, which the browser runs off the main thread.
  return (
    <div
      {...interactiveProps}
      className={clsx(
        light ? 'glass-surface-light' : 'glass-surface',
        'rounded-2xl',
        padding,
        animate && 'card-enter',
        onClick && 'card-press text-left w-full touch-manipulation cursor-pointer select-none',
        className
      )}
    >
      {children}
    </div>
  );
}
