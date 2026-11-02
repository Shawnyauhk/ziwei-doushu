'use client';
import { createContext, useContext, useEffect, useState } from 'react';

/** 只保留較大的檔位；100% / 112% 已移除 */
export type FontScale = 'xlarge' | 'xxlarge' | 'xxxlarge' | 'huge' | 'max';

export const FONT_SCALE_ORDER: FontScale[] = ['xlarge', 'xxlarge', 'xxxlarge', 'huge', 'max'];

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  xlarge: '特大',
  xxlarge: '超大',
  xxxlarge: '巨大',
  huge: '極大',
  max: '最大',
};

/** 未設定過偏好時的預設檔位（140%） */
export const DEFAULT_FONT_SCALE: FontScale = 'xxlarge';

/**
 * 每次都換新鍵：舊版寫入的 normal/large 已不在可選範圍，
 * 沿用舊鍵會讓老用戶停在被移除的檔位。
 */
const STORAGE_KEY = 'ziwei-fontscale-v3';

const FontScaleContext = createContext<{
  scale: FontScale;
  setScale: (scale: FontScale) => void;
}>({ scale: DEFAULT_FONT_SCALE, setScale: () => {} });

function resolveStoredScale(): FontScale {
  if (typeof window === 'undefined') return DEFAULT_FONT_SCALE;
  const saved = localStorage.getItem(STORAGE_KEY);
  return FONT_SCALE_ORDER.includes(saved as FontScale) ? (saved as FontScale) : DEFAULT_FONT_SCALE;
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
    document.documentElement.setAttribute('data-fontscale', scale);
    localStorage.setItem(STORAGE_KEY, scale);
  }, [scale, mounted]);

  return (
    <FontScaleContext.Provider value={{ scale, setScale }}>
      {children}
    </FontScaleContext.Provider>
  );
}

export const useFontScale = () => useContext(FontScaleContext);
