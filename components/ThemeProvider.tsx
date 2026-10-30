'use client';
import { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: 'dark', toggle: () => {} });

/**
 * 讀取實際主題（僅在瀏覽器可用）。
 * 注意：不可作為 useState 初始值——客戶端首幀會與服務端（dark）不一致，
 * 造成 Next.js hydration 失敗（React 會丟棄並重建整棵樹）。
 * 真實主題統一在掛載後的 effect 中同步。
 */
function resolveStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('ziwei-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 首幀固定 dark，與服務端輸出保持一致，避免 hydration 不匹配。
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(resolveStoredTheme());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('ziwei-theme', theme);
  }, [theme, mounted]);

  const toggle = () => {
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    setTheme(t => t === 'dark' ? 'light' : 'dark');
    setTimeout(() => root.classList.remove('theme-transitioning'), 420);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
