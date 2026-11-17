import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';
const preferenceKey = 'test-driven-study.theme';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0D1726' : '#F3F8FD');
    try { localStorage.setItem(preferenceKey, theme); }
    catch (error) { console.warn('Theme preference could not be saved', error); }
  }, [theme]);
  return <ThemeContext.Provider value={{ theme,
    toggle: () => setTheme(current => current === 'light' ? 'dark' : 'light') }}>
    {children}
  </ThemeContext.Provider>;
}

export function ThemeToggle() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeToggle requires ThemeProvider');
  const dark = value.theme === 'dark';
  return <button type="button" className="button text theme-toggle"
    aria-label="深色模式" aria-pressed={dark} title={dark ? '切换到浅色模式' : '切换到深色模式'}
    onClick={value.toggle}>
    {dark ? <Moon size={16} /> : <Sun size={16} />}<span>{dark ? '深色' : '浅色'}</span>
  </button>;
}
