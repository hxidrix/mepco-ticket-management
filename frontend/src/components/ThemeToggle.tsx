import { useTheme } from '../hooks/useTheme';

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  return (
    <label
      className={compact ? 'theme-toggle is-compact' : 'theme-toggle'}
      title={`Switch to ${nextTheme} theme`}
    >
      <input
        className="theme-toggle__input"
        type="checkbox"
        role="switch"
        checked={theme === 'dark'}
        aria-label={`Switch to ${nextTheme} theme`}
        onChange={toggleTheme}
      />
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb">
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24"><path d="M20.4 15.3A8.5 8.5 0 0 1 8.7 3.6 8.6 8.6 0 1 0 20.4 15.3Z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          )}
        </span>
      </span>
      {!compact && <span className="theme-toggle__label">{theme === 'dark' ? 'Dark' : 'Light'}</span>}
    </label>
  );
}
