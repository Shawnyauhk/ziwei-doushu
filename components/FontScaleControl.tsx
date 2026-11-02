'use client';
import { useEffect, useRef, useState } from 'react';
import { FONT_SCALE_LABELS, FONT_SCALE_ORDER, useFontScale } from './FontScaleProvider';

/**
 * 全域字體放大控制：固定於畫面右側中線，點擊在 標準 → 大 → 特大 之間循環。
 * 只縮放文字（--fs），不改間距與容器尺寸，因此不會破壞排版。
 */
export default function FontScaleControl() {
  const { scale, setScale } = useFontScale();
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleClick = () => {
    const next = FONT_SCALE_ORDER[(FONT_SCALE_ORDER.indexOf(scale) + 1) % FONT_SCALE_ORDER.length];
    setScale(next);
    setToast(`字體 ${FONT_SCALE_LABELS[next]}`);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 1400);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={`字體大小：${FONT_SCALE_LABELS[scale]}，點擊切換`}
        title={`字體大小：${FONT_SCALE_LABELS[scale]}（點擊切換）`}
        className="fixed z-[60] flex items-center justify-center select-none no-print"
        style={{
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 26,
          height: 48,
          borderTopLeftRadius: 10,
          borderBottomLeftRadius: 10,
          border: '1px solid var(--bdr-med)',
          borderRight: 'none',
          background: 'var(--bg-card)',
          color: 'var(--tx-2)',
          boxShadow: 'var(--sh-sm)',
          opacity: 0.82,
          transition: 'opacity 0.2s ease, color 0.2s ease',
        }}
        onMouseEnter={(event) => { event.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(event) => { event.currentTarget.style.opacity = '0.82'; }}
      >
        <span style={{ fontSize: 'calc(11px * var(--fs))', fontWeight: 600, letterSpacing: '0.02em' }}>
          Aa
        </span>
      </button>

      {toast && (
        <div
          role="status"
          className="fixed z-[60] px-2.5 py-1 rounded-full no-print"
          style={{
            right: 34,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--bdr-med)',
            boxShadow: 'var(--sh-md)',
            color: 'var(--tx-1)',
            fontSize: 'calc(11px * var(--fs))',
            whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
