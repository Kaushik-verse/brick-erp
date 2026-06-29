import clsx from 'clsx';

const baseFieldClasses =
  'w-full h-tap px-4 rounded-2xl glass-surface-light text-clay-50 placeholder:text-clay-400/60 ' +
  'focus:outline-none focus:ring-2 focus:ring-ember-500/50 focus:border-ember-500/40 transition-all';

export function GlassInput({
  label,
  error,
  className,
  prefix,
  ...props
}) {
  return (
    <label className="block w-full">
      {label && (
        <span className="block text-xs font-medium text-clay-300/80 mb-1.5 ml-1 tracking-wide uppercase">
          {label}
        </span>
      )}
      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-clay-400 figure pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          className={clsx(baseFieldClasses, prefix && 'pl-9', className)}
          {...props}
        />
      </div>
      {error && <span className="block text-xs text-ledger-overdue mt-1 ml-1">{error}</span>}
    </label>
  );
}

export function GlassSelect({ label, error, className, children, ...props }) {
  return (
    <label className="block w-full">
      {label && (
        <span className="block text-xs font-medium text-clay-300/80 mb-1.5 ml-1 tracking-wide uppercase">
          {label}
        </span>
      )}
      <select
        className={clsx(
          baseFieldClasses,
          'appearance-none bg-[length:18px] bg-[right_1rem_center] bg-no-repeat',
          className
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23C9AD8C' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {children}
      </select>
      {error && <span className="block text-xs text-ledger-overdue mt-1 ml-1">{error}</span>}
    </label>
  );
}

export function GlassTextarea({ label, error, className, ...props }) {
  return (
    <label className="block w-full">
      {label && (
        <span className="block text-xs font-medium text-clay-300/80 mb-1.5 ml-1 tracking-wide uppercase">
          {label}
        </span>
      )}
      <textarea
        className={clsx(
          'w-full min-h-[96px] py-3 px-4 rounded-2xl glass-surface-light text-clay-50',
          'placeholder:text-clay-400/60 focus:outline-none focus:ring-2 focus:ring-ember-500/50',
          'transition-all resize-none',
          className
        )}
        {...props}
      />
      {error && <span className="block text-xs text-ledger-overdue mt-1 ml-1">{error}</span>}
    </label>
  );
}

/** Segmented toggle — used for payment channel (Cash vs Bank/UPI) selection. */
export function GlassToggleGroup({ options, value, onChange, label }) {
  return (
    <div className="w-full">
      {label && (
        <span className="block text-xs font-medium text-clay-300/80 mb-1.5 ml-1 tracking-wide uppercase">
          {label}
        </span>
      )}
      <div className="flex p-1 rounded-2xl glass-surface-light gap-1">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={clsx(
                'flex-1 h-11 rounded-xl text-sm font-semibold transition-all touch-manipulation',
                'flex items-center justify-center gap-1.5',
                active
                  ? 'bg-gradient-to-b from-ember-500 to-ember-600 text-clay-50 shadow-glass-sm'
                  : 'text-clay-300 active:bg-white/5'
              )}
            >
              {opt.icon && <opt.icon size={15} />}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
