'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import BackHomeLink from '@/components/BackHomeLink';
import BirthForm, { type BirthFormState } from '@/components/BirthForm';
import { formToBirthInfo } from '@/lib/ziwei/share';
import { generateChart as buildChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart } from '@/lib/ziwei/types';
import { useTheme } from '@/components/ThemeProvider';

// ─── AiContent 渲染器（與 InsightPanel 一致）────────────────
function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {lines.map((line, i) => {
        const sectionMatch = line.match(/^\*\*【(.+?)】\*\*$/);
        if (sectionMatch) {
          return (
            <div key={i} style={{ paddingTop: i === 0 ? 0 : '14px', paddingBottom: '4px' }}>
              <span style={{ fontSize: 'calc(12px * var(--fs))', fontWeight: 600, color: 'var(--ac)', letterSpacing: '0.04em' }}>
                【{sectionMatch[1]}】
              </span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: '4px' }} />;
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div key={i} style={{ fontSize: 'calc(13px * var(--fs))', lineHeight: 1.75, color: 'var(--tx-2)' }}>
            {parts.map((part, j) =>
              j % 2 === 0
                ? part
                : <strong key={j} style={{ fontWeight: 500, color: 'var(--tx-0)' }}>{part}</strong>
            )}
          </div>
        );
      })}
      {streaming && (
        <span style={{
          display: 'inline-block', width: '7px', height: '13px',
          background: 'var(--ac)', opacity: 0.5, borderRadius: '2px',
          animation: 'pulse 1s ease-in-out infinite',
          verticalAlign: 'middle', marginLeft: '2px',
        }} />
      )}
    </div>
  );
}

export default function HemingPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // ─── 雙方命盤狀態 ─────────────────────────────────────────
  const [chartA, setChartA] = useState<ZiweiChart | null>(null);
  const [chartB, setChartB] = useState<ZiweiChart | null>(null);
  // 雙方表單狀態由 BirthForm onFormSave 同步到此處，統一按鈕觸發起盤
  const [formA, setFormA] = useState<BirthFormState | null>(null);
  const [formB, setFormB] = useState<BirthFormState | null>(null);

  // ─── AI 合盤分析狀態 ─────────────────────────────────────
  const [analysis, setAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [question, setQuestion] = useState('');
  const [analysisError, setAnalysisError] = useState(false);
  // 開源版不含 /api/heming：介面 404 時單獨說明，而不是讓使用者反覆重試
  const [apiMissing, setApiMissing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  // ─── 按次計費狀態 ─────────────────────────────────────────
  const [needCredit, setNeedCredit] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState('');
  const [purchaseNotice, setPurchaseNotice] = useState('');

  // 付款回跳：清除提示並重新整理
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('purchase') !== 'success') return;
    setNeedCredit(false);
    setPurchaseNotice('付款成功，合盤次數已加入。');
    params.delete('purchase');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    const timer = window.setTimeout(() => setPurchaseNotice(''), 8000);
    return () => window.clearTimeout(timer);
  }, []);

  const buyCredits = async (pack: 'single' | 'pack5') => {
    setBuying(pack);
    setPurchaseError('');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack, returnTo: '/heming' }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) throw new Error(data?.error || '無法建立付款頁面。');
      window.location.href = data.url;
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : '無法建立付款頁面。');
      setBuying(null);
    }
  };

  // ─── 起盤（單次呼叫，返回 chart 給統一流程使用）──────────
  // 開源版不含後端 /api/generate：直接用本倉庫的排盤引擎在瀏覽器裡起盤
  const generateChart = useCallback(async (info: BirthInfo): Promise<ZiweiChart | null> => {
    try {
      return buildChart(info);
    } catch {
      return null;
    }
  }, []);

  // 表單是否填齊
  const isFormReady = (f: BirthFormState | null): boolean =>
    !!(f && f.year && f.month && f.day && f.gender && (f.unknownTime || (f.clockHour !== '' && f.clockMinute !== '')));

  // ─── 統一入口：起盤 + 合盤分析 ─────────────────────────────
  const runAnalysis = useCallback(async (q?: string) => {
    setFormError(null);
    if (!isFormReady(formA) || !isFormReady(formB)) {
      setFormError('請先填寫雙方完整出生資訊');
      return;
    }
    setAnalyzing(true);
    setAnalysis('');
    setAnalysisError(false);
    setNeedCredit(false);

    try {
      // 並行起兩張盤（如果還沒起）
      let cA = chartA;
      let cB = chartB;
      const [newA, newB] = await Promise.all([
        cA ? Promise.resolve(cA) : generateChart(formToBirthInfo(formA!)),
        cB ? Promise.resolve(cB) : generateChart(formToBirthInfo(formB!)),
      ]);
      cA = newA;
      cB = newB;
      if (!cA || !cB) {
        setAnalysisError(true);
        setAnalyzing(false);
        return;
      }
      if (!chartA) setChartA(cA);
      if (!chartB) setChartB(cB);

      const res = await fetch('/api/heming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartA: cA, chartB: cB, question: q ?? undefined }),
      });
      if (res.status === 402) {
        setNeedCredit(true);
        setAnalysisError(false);
        return;
      }
      if (res.status === 404) { setApiMissing(true); throw new Error('api-missing'); }
      if (!res.ok || !res.body) throw new Error();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      let pending = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // 必須跨 chunk 緩衝：SSE 一行可能被 TCP 切成兩段，直接 split 會丟字
        pending += decoder.decode(value, { stream: true });
        let newline = pending.indexOf('\n');
        while (newline >= 0) {
          const line = pending.slice(0, newline).replace(/\r$/, '');
          pending = pending.slice(newline + 1);
          newline = pending.indexOf('\n');
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data) as { delta?: { text?: string }; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            const delta = parsed.delta?.text ?? '';
            if (!delta) continue;
            text += delta;
            setAnalysis(text);
          } catch (error) {
            if (error instanceof Error && error.message !== 'Unexpected end of JSON input') throw error;
          }
        }
      }
      // scroll to analysis
      setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch {
      setAnalysisError(true);
    } finally {
      setAnalyzing(false);
    }
  }, [chartA, chartB, formA, formB, generateChart]);

  const cardStyle = {
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(200,160,60,0.2)'}`,
    borderRadius: '16px',
    padding: '24px',
  };

  const labelStyle = {
    fontSize: 'calc(10px * var(--fs))', letterSpacing: '0.4em', color: 'var(--ac)', opacity: 0.7,
    marginBottom: '16px', display: 'block',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      {/* 頂欄 */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: isDark ? 'rgba(2,8,16,0.88)' : 'rgba(250,245,235,0.92)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--bdr)',
        display: 'flex', alignItems: 'center', padding: '0 24px', height: '52px', gap: '16px',
      }}>
        <BackHomeLink />
        <div style={{ width: '1px', height: '20px', background: 'var(--bdr-med)' }} />
        <span style={{ fontSize: 'calc(12px * var(--fs))', color: 'var(--ac)', letterSpacing: '0.2em' }}>合盤分析</span>
        <div style={{ flex: 1 }} />
        <span className="heming-header-context" style={{ fontSize: 'calc(11px * var(--fs))', color: 'var(--tx-3)' }}>感情 · 合夥 · 親子 · 朋友</span>
      </header>

      {/* 主體 */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* 標題 */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontSize: 'calc(28px * var(--fs))', color: 'var(--ac)', opacity: 0.15, marginBottom: '12px' }}>☯</div>
          <h1 style={{ fontSize: 'calc(22px * var(--fs))', fontWeight: 600, letterSpacing: '0.15em', color: 'var(--tx-0)', marginBottom: '8px' }}>
            紫微合盤
          </h1>
          <p style={{ fontSize: 'calc(13px * var(--fs))', color: 'var(--tx-3)', lineHeight: 1.6 }}>
            輸入兩個人的出生資訊，AI 基於倪海廈體系分析雙方命盤的緣分匹配度、感情走向與相處建議
          </p>
        </div>

        {/* 雙欄表單 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}
          className="heming-grid">
          {/* 甲方 */}
          <div style={cardStyle}>
            <span style={labelStyle}>甲方 — A</span>
            <BirthForm
              hideSubmit
              onSubmit={() => {}}
              onFormSave={setFormA}
            />
          </div>

          {/* 乙方 */}
          <div style={cardStyle}>
            <span style={labelStyle}>乙方 — B</span>
            <BirthForm
              hideSubmit
              onSubmit={() => {}}
              onFormSave={setFormB}
            />
          </div>
        </div>

        {/* ═══ 大合盤分析框（視覺中心，始終顯示）════════════════ */}
        <div ref={analysisRef} style={{
          ...cardStyle,
          minHeight: '320px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: (!analysis && !analyzing) ? 'center' : 'flex-start',
        }}>
          {/* 區塊標題 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: (analysis || analyzing) ? '20px' : '24px' }}>
            <span style={{ color: 'var(--ac)', opacity: 0.6 }}>◉</span>
            <span style={{ fontSize: 'calc(11px * var(--fs))', letterSpacing: '0.3em', color: 'var(--tx-3)' }}>合盤分析 · HEMING</span>
          </div>

          {/* 付款成功提示 */}
          {purchaseNotice && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.08)', fontSize: 'calc(12px * var(--fs))', color: '#10b981' }}>
              {purchaseNotice}
            </div>
          )}

          {/* 次數不足：購買入口 */}
          {needCredit && !analyzing && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 'calc(13px * var(--fs))', color: 'var(--tx-2)', marginBottom: '6px' }}>
                合盤分析按次計費，每次扣 1 次
              </div>
              <div style={{ fontSize: 'calc(11px * var(--fs))', color: 'var(--tx-3)', marginBottom: '20px' }}>
                購買後即可繼續分析雙方命盤
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {(['single', 'pack5'] as const).map(pack => (
                  <button
                    key={pack}
                    onClick={() => buyCredits(pack)}
                    disabled={buying !== null}
                    style={{
                      padding: '10px 22px', borderRadius: 'var(--r-pill)',
                      border: '1px solid var(--ac-bdr)', background: 'var(--ac-bg)',
                      color: 'var(--ac)', fontSize: 'calc(13px * var(--fs))', fontWeight: 500,
                      cursor: buying !== null ? 'not-allowed' : 'pointer',
                      opacity: buying !== null && buying !== pack ? 0.5 : 1,
                    }}
                  >
                    {buying === pack ? '前往付款…' : pack === 'single' ? '單次合盤' : '5 次合盤'}
                  </button>
                ))}
              </div>
              {purchaseError && (
                <div style={{ marginTop: '14px', fontSize: 'calc(12px * var(--fs))', color: '#dc2626' }}>
                  {purchaseError}
                </div>
              )}
            </div>
          )}

          {/* 狀態分支 */}
          {!analysis && !analyzing && !needCredit && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 'calc(13px * var(--fs))', color: 'var(--tx-3)', marginBottom: '24px', lineHeight: 1.7 }}>
                填好雙方出生資訊後，點選下方按鈕<br />
                AI 將基於倪海廈體系深度分析兩人緣分匹配度
              </div>
              <button
                onClick={() => runAnalysis()}
                style={{
                  padding: '14px 40px', borderRadius: 'var(--r-pill)', border: 'none',
                  background: 'linear-gradient(135deg, #9a6210, #c88020)',
                  color: '#fff8e8', fontSize: 'calc(14px * var(--fs))', fontWeight: 600,
                  letterSpacing: '0.15em', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(140,100,20,0.25)',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                開始合盤分析
              </button>
              {formError && (
                <div style={{ marginTop: '20px', fontSize: 'calc(13px * var(--fs))', color: '#dc2626' }}>
                  {formError}
                </div>
              )}
            </div>
          )}

          {analyzing && !analysis && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '40px 0', color: 'var(--tx-3)', fontSize: 'calc(13px * var(--fs))' }}>
              <div style={{
                width: '14px', height: '14px',
                border: '2px solid var(--bdr-med)', borderTopColor: 'var(--ac)',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }} />
              正在對比雙方命盤…
            </div>
          )}

          {analysis && <AiContent text={analysis} streaming={analyzing} />}

          {analysisError && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bdr)', background: 'var(--bg-card)', fontSize: 'calc(13px * var(--fs))', color: 'var(--tx-2)', marginTop: '12px' }}>
              {apiMissing
                ? '合盤分析服務暫時不可用（/api/heming 未就緒），請稍後重試或先到「排盤」頁分別檢視兩張命盤。'
                : '分析暫時不可用，請重試。'}
            </div>
          )}
        </div>

        {/* ═══ 針對合盤的追問聊天框（僅分析完成後顯示）═══════════ */}
        {analysis && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
            <div style={{ fontSize: 'calc(11px * var(--fs))', letterSpacing: '0.2em', color: 'var(--tx-3)', marginBottom: '4px' }}>
              針對此次合盤繼續追問
            </div>

            {/* 快捷問題 */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                '感情匹配度如何？',
                '適合合夥創業嗎？',
                '兩人結婚是否合適？',
                '哪方面最容易產生矛盾？',
                '財運是否互補？',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => { setQuestion(q); runAnalysis(q); }}
                  disabled={analyzing}
                  style={{
                    fontSize: 'calc(12px * var(--fs))', padding: '6px 14px',
                    borderRadius: 'var(--r-pill)',
                    border: '1px solid var(--bdr-med)',
                    background: 'transparent', color: 'var(--tx-2)',
                    cursor: analyzing ? 'not-allowed' : 'pointer',
                    opacity: analyzing ? 0.5 : 1,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => { if (!analyzing) (e.currentTarget as HTMLElement).style.borderColor = 'var(--ac-bdr)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bdr-med)'; }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* 輸入框 + 追問按鈕 */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !analyzing) runAnalysis(question || undefined); }}
                placeholder="繼續追問，如：哪幾年是兩人感情關鍵期？"
                disabled={analyzing}
                className="input-base"
                style={{ fontSize: 'calc(13px * var(--fs))', flex: 1 }}
              />
              <button
                onClick={() => runAnalysis(question || undefined)}
                disabled={analyzing}
                style={{
                  padding: '10px 20px', borderRadius: 'var(--r-sm)', border: 'none',
                  background: analyzing ? 'var(--bg-2)' : 'var(--tx-0)',
                  color: analyzing ? 'var(--tx-3)' : 'white',
                  fontSize: 'calc(13px * var(--fs))', fontWeight: 500,
                  cursor: analyzing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {analyzing ? '分析中…' : '繼續追問'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 680px) {
          .heming-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
