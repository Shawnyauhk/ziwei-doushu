'use client';
import { useState } from 'react';
import BackHomeLink from '@/components/BackHomeLink';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel from '@/components/InsightPanel';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart, Palace } from '@/lib/ziwei/types';

/**
 * 命盤頁 —— 開源版「排盤引擎 Demo」
 *
 * 這是一個最小可執行示例：用本倉庫的排盤引擎 generateChart() 配合基礎 UI
 * 元件，渲染一張完整紫微命盤 + 基礎解讀，並支援本命 / 大限 / 流年切換。
 *
 * 說明：線上商業版的完整互動介面（重設計的新 UI、AI 流式解讀、合盤、分享
 * 卡片等）不在開源範圍內；但排盤核心——安星演算法、四化、格局識別、古籍庫——
 * 完全開放（見 lib/ziwei/*），可自由二次開發出你自己的介面。
 */
export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);

  // ── 未起盤：展示出生資訊表單 ──
  if (!chart) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px' }}>
        <BackHomeLink className="back-home-link--spaced" />
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>紫微斗數排盤</h1>
        <p style={{ color: '#888', marginBottom: 32, fontSize: 14, lineHeight: 1.7 }}>
          輸入出生年月日時，開源排盤引擎即時生成命盤。
          <br />
          （本頁為引擎 Demo，完整商業版介面不在開源範圍；排盤核心完全開放。）
        </p>
        <div style={{ marginTop: -12, marginBottom: 22 }}>
          <button
            type="button"
            onClick={() => setChart(generateChart({ year: 1990, month: 1, day: 1, hour: 4, gender: 'male' }))}
            style={{
              padding: '10px 16px',
              border: '1px solid rgba(200, 153, 58, 0.65)',
              borderRadius: 10,
              color: '#d4a843',
              background: 'rgba(200, 153, 58, 0.08)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            用示例資料快速檢視完整命盤
          </button>
          <p style={{ color: '#888', fontSize: 12, margin: '8px 0 0' }}>
            使用虛構示例：1990-01-01，辰時，男；姓名與出生地留空。
          </p>
        </div>
        <BirthForm onSubmit={(info: BirthInfo) => setChart(generateChart(info))} />
      </main>
    );
  }

  // ── 已起盤：命盤 + 解讀 ──
  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      <BackHomeLink className="back-home-link--spaced" />
      <button
        type="button"
        onClick={() => { setChart(null); setSelectedPalace(null); }}
        style={{
          marginBottom: 16, padding: '6px 14px', cursor: 'pointer',
          border: '1px solid #ccc', borderRadius: 8, background: 'transparent',
        }}
      >
        ← 重新起盤
      </button>

      <div className="chart-result-layout">
        <ChartBoard chart={chart} onPalaceSelect={setSelectedPalace} />
        <InsightPanel chart={chart} selectedPalace={selectedPalace} />
      </div>
    </main>
  );
}
