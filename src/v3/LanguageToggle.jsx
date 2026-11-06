import { Languages } from 'lucide-react';
import { useT } from '../core/i18n';

/** One tap switches the New app between English and Telugu. */
export default function LanguageToggle({ wide = false }) {
  const { lang, setLang } = useT();
  const next = lang === 'te' ? 'en' : 'te';
  return (
    <button
      onClick={() => setLang(next)}
      aria-label={lang === 'te' ? 'Switch to English' : 'తెలుగులోకి మార్చండి'}
      className={`h-11 ${wide ? 'w-full justify-between px-4' : 'px-3'} rounded-2xl glass-surface flex items-center gap-1.5 touch-manipulation`}
    >
      <Languages size={17} className="text-ember-500" />
      <span className="text-sm font-bold text-clay-100" style={{ fontFamily: next === 'te' ? "'Noto Sans Telugu', sans-serif" : undefined }}>
        {next === 'te' ? 'తెలుగు' : 'English'}
      </span>
    </button>
  );
}
