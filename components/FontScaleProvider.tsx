'use client';
import { createContext, useContext, useEffect, useState } from 'react';

export type FontScale = 'normal' | 'large' | 'xlarge' | 'xxlarge';

export const FONT_SCALE_ORDER: FontScale[] = ['normal', 'large', 'xlarge', 'xxlarge'];
export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  normal: '標準',
  large: '大',
  xlarge: '特大',
  xxlarge: '超大',
};

/** 未設定過偏好時的預設檔位 */
export const DEFAULT_FONT_SCALE: FontScale = 'xlarge';

/**
 * 改用新鍵：舊版會在首次載入時把預設值 normal 寫入 localStorage，
 * 若沿用舊鍵，老用戶會永遠停在「標準」，拿不到新的預設字級。
 */
const STORAGE_KEY = 'ziwei-fontscale-v2';

const VALID_SCALES: FontScale[] = FONT_SCALE_ORDER;

const FontScaleContext = createContext<{
  scale: FontScale;
  setScale: (scale: FontScale) => void;
}>({ scale: DEFAULT_FONT_SCALE, setScale: () => {} });

/**
 * 與 ThemeProvider 相同的策略：首幀固定預設值，掛載後再讀 localStorage，
 * 避免伺服器輸出與客戶端首幀不一致導致 hydration 失敗。
 */
function resolveStoredScale(): FontScale {
  if (typeof window === 'undefined') return DEFAULT_FONT_SCALE;
  const saved = localStorage.getItem(STORAGE_KEY);
  return VALID_SCALES.includes(saved as FontScale) ? (saved as FontScale) : DEFAULT_FONT_SCALE;
}

export function FontScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState<FontScale>(DEFAULT_FONT_SCALE);
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
    localStorage.setItem(STORAGE_KEY, scale);
  }, [scale, mounted]);

  return (
    <FontScaleContext.Provider value={{ scale, setScale }}>
      {children}
    </FontScaleContext.Provider>
  );
}

export const useFontScale = () => useContext(FontScaleContext);
