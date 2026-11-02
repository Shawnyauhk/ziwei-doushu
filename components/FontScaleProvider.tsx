'use client';
import { createContext, useContext, useEffect, useState } from 'react';

export type FontScale = 'normal' | 'large' | 'xlarge';

export const FONT_SCALE_ORDER: FontScale[] = ['normal', 'large', 'xlarge'];
export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  normal: '標準',
  large: '大',
  xlarge: '特大',
};

const FontScaleContext = createContext<{
  scale: FontScale;
  setScale: (scale: FontScale) => void;
}>({ scale: 'normal', setScale: () => {} });

/**
 * 與 ThemeProvider 相同的策略：首幀固定 normal，掛載後再讀 localStorage，
 * 避免伺服器輸出與客戶端首幀不一致導致 hydration 失敗。
 */
function resolveStoredScale(): FontScale {
  if (typeof window === 'undefined') return 'normal';
  const saved = localStorage.getItem('ziwei-fontscale');
  if (saved === 'large' || saved === 'xlarge') return saved;
  return 'normal';
}

export function FontScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState<FontScale>('normal');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setScale(resolveStoredScale());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (scale === 'normal') root.removeAttribute('data-fontscale');
    else root.setAttribute('data-fontscale', scale);
    localStorage.setItem('ziwei-fontscale', scale);
  }, [scale, mounted]);

  return (
    <FontScaleContext.Provider value={{ scale, setScale }}>
      {children}
    </FontScaleContext.Provider>
  );
}

export const useFontScale = () => useContext(FontScaleContext);
