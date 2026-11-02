'use client';
import { useEffect, useRef, useState } from 'react';
import { FONT_SCALE_LABELS, FONT_SCALE_ORDER, useFontScale, type FontScale } from './FontScaleProvider';

/** 各档位的预览字号（固定 px，便于直观比较差异）与缩放比例 */
const PREVIEW: Record<FontScale, { px: number; percent: string }> = {
  xlarge: { px: 15, percent: '124%' },
  xxlarge: { px: 17, percent: '140%' },
  xxxlarge: { px: 19, percent: '160%' },
  huge: { px: 21, percent: '180%' },
  max: { px: 23, percent: '200%' },
};

/**
 * 全域字體放大控制：固定於畫面右側中線的 A+ 按鈕，
 * 點擊展開檔位選單。控制項本身使用固定尺寸，避免在 200% 下撐爆畫面。
 */
export default function FontScaleControl() {
  const { scale, setScale } = useFontScale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label={`字體大小：${FONT_SCALE_LABELS[scale]}，點擊選擇`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="字體大小"
        className="fixed z-[61] flex items-center justify-center select-none no-print"
        style={{
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 28,
          height: 52,
          borderTopLeftRadius: 10,
          borderBottomLeftRadius: 10,
          border: '1px solid var(--bdr-med)',
          borderRight: 'none',
          background: 'var(--surface-solid)',
          color: open ? 'var(--ac)' : 'var(--tx-2)',
          boxShadow: 'var(--sh-sm)',
          opacity: open ? 1 : 0.85,
          transition: 'opacity 0.2s ease, color 0.2s ease, background 0.2s ease',
        }}
        onMouseEnter={(event) => { event.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(event) => { if (!open) event.currentTarget.style.opacity = '0.85'; }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.02em' }}>
          A<span style={{ fontSize: '0.72em', verticalAlign: 'super' }}>+</span>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="選擇字體大小"
          className="fixed z-[61] no-print"
          style={{
            right: 36,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 168,
            padding: '6px',
            borderRadius: 12,
            border: '1px solid var(--bdr-med)',
            background: 'var(--surface-solid)',
            boxShadow: 'var(--sh-lg)',
          }}
        >
          <div style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            color: 'var(--tx-3)',
            padding: '4px 8px 6px',
          }}>
            字體大小
          </div>

          {FONT_SCALE_ORDER.map((level) => {
            const active = scale === level;
            return (
              <button
                key={level}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => { setScale(level); setOpen(false); }}
                className="fontscale-option w-full flex items-center justify-between rounded-lg"
                style={{
                  gap: 8,
                  padding: '6px 8px',
                  border: 'none',
                  background: active ? 'var(--ac-bg)' : undefined,
                  color: active ? 'var(--ac)' : 'var(--tx-1)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 24,
                    textAlign: 'center',
                    fontSize: PREVIEW[level].px,
                    lineHeight: 1,
                    fontWeight: active ? 700 : 500,
                  }}>
                    A
                  </span>
                  <span style={{ fontSize: 12 }}>{FONT_SCALE_LABELS[level]}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>{PREVIEW[level].percent}</span>
                  <span style={{ width: 10, fontSize: 11, color: 'var(--ac)' }}>
                    {active ? '✓' : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
