import { Contrast, Moon, Sun } from 'lucide-react';
import { ThemeMode } from '../types';

interface ThemeSwitcherProps {
  theme: ThemeMode;
  onChangeTheme: (next: ThemeMode) => void;
}

const OPTIONS: { id: ThemeMode; label: string; title: string }[] = [
  { id: 'light', label: 'Light', title: 'Light Theme' },
  { id: 'dark', label: 'Dark', title: 'Slate Dark Theme' },
  { id: 'pitch', label: 'Pitch', title: 'Pitch Black OLED Theme' },
];

export default function ThemeSwitcher({ theme, onChangeTheme }: ThemeSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex items-center p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 pitch:border-zinc-800 bg-slate-100/80 dark:bg-slate-900 pitch:bg-[#0A0A0D] shrink-0"
    >
      {OPTIONS.map((opt) => {
        const isActive = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChangeTheme(opt.id)}
            aria-pressed={isActive}
            title={opt.title}
            className={`px-2 py-1 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              isActive
                ? 'bg-white dark:bg-[#111827] pitch:bg-zinc-900 text-slate-900 dark:text-slate-100 pitch:text-white shadow-2xs border border-slate-200/70 dark:border-slate-700/70 pitch:border-zinc-700'
                : 'text-slate-500 dark:text-slate-400 pitch:text-zinc-500 hover:text-slate-900 dark:hover:text-slate-200 pitch:hover:text-zinc-200 border border-transparent'
            }`}
          >
            {opt.id === 'light' && <Sun className="w-3.5 h-3.5 shrink-0" />}
            {opt.id === 'dark' && <Moon className="w-3.5 h-3.5 shrink-0" />}
            {opt.id === 'pitch' && <Contrast className="w-3.5 h-3.5 shrink-0" />}
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
