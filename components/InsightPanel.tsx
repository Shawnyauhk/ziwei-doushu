'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';
import type { TimeView } from './TimeNav';
import { toTraditionalDisplayText } from '@/lib/ziwei/display-text';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean; // don't show user bubble for auto/topic messages
}

interface SelectedSiHua {
  starName: string;
  siHua: string;
  view: TimeView;
}

interface InsightPanelProps {
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
  selectedSiHua?: SelectedSiHua | null;
}

const TOPICS = [
  { key: 'overview',     label: '命格' },
  { key: 'bazi',         label: '八字' },
  { key: 'love',        label: '感情' },
  { key: 'career',      label: '事業' },
  { key: 'wealth',      label: '財運' },
  { key: 'health',      label: '健康' },
  { key: 'personality', label: '性格' },
] as const;

const TOPIC_PROMPTS: Record<string, string> = {
  overview: `請生成命格總覽，按以下結構輸出：

**【命格定性】**
用一句話概括這個命盤的核心格局與命主氣質。

**【主星解讀】**
命宮主星的核心特質，引用倪海廈原話或觀點。

**【三方四正】**
財、官、遷三宮的聯動分析及整體格局。

**【當前大限】**
當下大限運勢方向與最值得關注的事項。

**【優勢與注意】**
命盤天賦優勢，以及需要注意的風險或功課。`,

  bazi: `請根據匿名命盤中提供的四柱與伺服器確定性 baziFacts，做一份基礎八字文化解讀，嚴格區分曆法口徑，按以下結構輸出：

**【四柱與口徑】**
按年、月、日、時列出節氣四柱；若同時提供農曆口徑四柱，也單獨列出並說明不可混用。

**【日主初步觀察】**
引用 baziFacts 的日主、各柱天干十神與支中藏幹，說明五行權重與簡化強弱指標；不得自行重算或更改這些資料。強弱只稱初步指標，不可當作完整旺衰、喜用神或命運定論。

**【資料邊界】**
說明本引擎的強弱評估有簡化權重限制；尚未計算喜用神、完整格局、大運或流年，不要自行補造這些結論。`,

  love: `請深度分析感情婚姻運，按以下結構輸出：

**【感情格局】**
一句話定性感情命格。

**【夫妻宮分析】**
夫妻宮主星、四化，以及倪海廈體系的具體解讀。

**【三方聯動】**
相關宮位對感情的影響。

**【當前大限感情運】**
當下10年感情走向與關鍵節點。

**【實際建議】**
具體可行的感情建議。`,

  career: `請深度分析事業運，按以下結構輸出：

**【事業格局】**
一句話定性事業命格，宜任職或宜創業。

**【官祿宮分析】**
官祿宮主星、四化，以及倪師對這種配置的判斷。

**【財帛宮聯動】**
財運與事業的關係，財路來源分析。

**【當前大限事業運】**
當下10年事業走向。

**【實際建議】**
適合的方向、行業與策略。`,

  wealth: `請深度分析財運，按以下結構輸出：

**【財運格局】**
一句話定性財運模式，是主動財還是被動財。

**【財帛宮分析】**
財帛宮主星、四化，財富來源與流動模式。

**【田宅宮（財庫）】**
積蓄能力與不動產運勢分析。

**【當前大限財運】**
當下財運走向與注意事項。

**【理財建議】**
具體的財務建議。`,

  health: `請分析健康運勢，按以下結構輸出：

**【疾厄宮主星】**
疾厄宮星曜與健康含義。

**【主要風險】**
結合倪海廈子午流注理論，分析主要健康隱患與需關注的部位。

**【大限健康走勢】**
當下健康趨勢與關鍵時間段。

**【預防建議】**
具體注意事項與養生方向。`,

  personality: `請深度解析性格特質，按以下結構輸出：

**【命宮主星性格】**
命宮主星的核心性格特質，引用倪師原話。

**【三方性格綜合】**
財、官、遷三宮對性格的影響，全貌描繪。

**【人際關係模式】**
與他人互動方式、待人處世風格。

**【優勢與人生課題】**
天賦優勢，以及需要面對的人生功課。`,
};

const PALACE_ROLES: Record<string, string> = {
  '命宮':   '自我、性格、先天格局',
  '兄弟宮': '兄弟關係、合夥人',
  '夫妻宮': '感情關係、婚姻狀態',
  '子女宮': '子女緣分、下屬關係',
  '財帛宮': '財運來源、收入方式',
  '疾厄宮': '身體健康、意外',
  '遷移宮': '外出機遇、人際格局',
  '交友宮': '朋友圈、貴人、小人',
  '僕役宮': '朋友圈、貴人、小人',
  '官祿宮': '事業成就、社會地位',
  '田宅宮': '不動產、家庭環境',
  '福德宮': '精神享受、內心福分',
  '父母宮': '父母關係、文書契約',
};

/** Render AI markdown: **【Title】** → gold header, **bold** → strong */
function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const display = toTraditionalDisplayText(text);
  // 等待首個 token 時顯示「準備中」提示，避免載入中畫面一片空白
  if (!display.trim()) {
    return (
      <div className="text-[11px] leading-relaxed flex items-center gap-1.5" style={{ color: 'var(--t-faint)' }}>
        命理師正在研讀命盤，請稍候…
        {streaming && (
          <span
            className="inline-block w-1.5 h-3 rounded-sm animate-pulse align-middle"
            style={{ background: 'var(--t-gold)', opacity: 0.6 }}
          />
        )}
      </div>
    );
  }
  const lines = display.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const sectionMatch = line.match(/^\*\*【(.+?)】\*\*$/);
        if (sectionMatch) {
          return (
            <div key={i} className="pt-3 pb-0.5 first:pt-0">
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--t-gold)' }}>
                【{sectionMatch[1]}】
              </span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div key={i} className="text-[11px] leading-relaxed" style={{ color: 'var(--t-text2)' }}>
            {parts.map((part, j) =>
              j % 2 === 0
                ? part
                : <strong key={j} className="font-medium" style={{ color: 'var(--t-text)' }}>{part}</strong>
            )}
          </div>
        );
      })}
      {streaming && (
        <span
          className="inline-block w-1.5 h-3 ml-0.5 animate-pulse rounded-sm align-middle"
          style={{ background: 'var(--t-gold)', opacity: 0.6 }}
        />
      )}
    </div>
  );
}

export default function InsightPanel({ chart, selectedPalace, selectedSiHua }: InsightPanelProps) {
  const [threads, setThreads] = useState<Record<string, Message[]>>(() => {
    const init: Record<string, Message[]> = {};
    for (const t of TOPICS) init[t.key] = [];
    return init;
  });
  const [activeTopic, setActiveTopic] = useState<string>('overview');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const threadsRef = useRef<Record<string, Message[]>>(threads); // always-current copy for closures
  const loadingRef = useRef(false);
  const autoLoaded = useRef(false);
  const lastPalaceBranch = useRef<number | undefined>(undefined);
  const lastSiHuaKey = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 當前激活分類的對話線程
  const messages = threads[activeTopic] ?? [];

  // Keep refs in sync
  useEffect(() => { threadsRef.current = threads; }, [threads]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-generate 命格總覽 on mount
  useEffect(() => {
    if (autoLoaded.current) return;
    autoLoaded.current = true;
    sendMessage(TOPIC_PROMPTS.overview, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Inject palace analysis when palace selected
  useEffect(() => {
    if (!selectedPalace || selectedPalace.branch === lastPalaceBranch.current) return;
    lastPalaceBranch.current = selectedPalace.branch;

    const majorStars = selectedPalace.stars.filter(s => s.type === 'major');
    const starDesc = majorStars.length > 0
      ? majorStars.map(s => `${toTraditionalDisplayText(s.name)}${s.siHua ? '化' + toTraditionalDisplayText(s.siHua) : ''}`).join('、')
      : '空宮（借對宮）';
    const displayPalaceName = toTraditionalDisplayText(selectedPalace.name);
    const palaceRoleKey = displayPalaceName.endsWith('宮') ? displayPalaceName : `${displayPalaceName}宮`;
    const role = PALACE_ROLES[palaceRoleKey] ?? '';

    const prompt = `請重點分析【${displayPalaceName}】（主管：${role}），該宮主星為${starDesc}，按以下結構輸出：

**【宮位定性】**
${displayPalaceName}在命盤中的意義，以及這種星曜配置的整體判斷。

**【主星解讀】**
主星在此宮的倪海廈體系解讀，引用具體觀點。

**【三方四正聯動】**
三方四正宮位對此宮的影響。

**【實際建議】**
基於此宮的具體建議。`;

    sendMessage(prompt, true);
  }, [selectedPalace]); // eslint-disable-line react-hooks/exhaustive-deps

  // 注入四化飛化分析
  useEffect(() => {
    if (!selectedSiHua) return;
    const key = `${selectedSiHua.starName}-${selectedSiHua.siHua}-${selectedSiHua.view}`;
    if (key === lastSiHuaKey.current) return;
    lastSiHuaKey.current = key;

    // 找出該星所在宮位
    const palaceOfStar = chart.palaces.find(p =>
      p.stars.some(s => s.name === selectedSiHua.starName)
    );
    const palaceName = palaceOfStar?.name ?? '未知宮位';
    const displayStarName = toTraditionalDisplayText(selectedSiHua.starName);
    const displaySiHua = toTraditionalDisplayText(selectedSiHua.siHua);
    const displayPalaceName = toTraditionalDisplayText(palaceName);
    const viewLabel = selectedSiHua.view === 'daxian' ? '大限' : '流年';

    const prompt = `請分析【${viewLabel}${displayStarName}化${displaySiHua}】的飛化影響，按以下結構輸出：

**【化${displaySiHua}基本含義】**
化${displaySiHua}在倪海廈體系中的核心含義，以及${displayStarName}化${displaySiHua}的特殊含義。

**【落宮影響】**
${displayStarName}化${displaySiHua}落在【${displayPalaceName}】，該宮主管的領域受到何種影響，倪師如何解讀。

**【三方四正飛化路徑】**
化${displaySiHua}入${displayPalaceName}後，對其三方四正（對宮、兩個三合宮）的聯動影響。

**【當前運勢影響】**
在${viewLabel}時間維度下，此化${displaySiHua}對命主近期運勢的具體影響。

**【實際建議】**
基於此四化的具體可操作建議。`;

    sendMessage(prompt, true);
  }, [selectedSiHua]); // eslint-disable-line react-hooks/exhaustive-deps

  const streamResponse = async (apiMessages: { role: 'user' | 'assistant'; content: string }[], topicKey: string) => {
    // 先插入「準備中」佔位訊息：等待上游連線與首個 token 期間就顯示提示，避免畫面空白被誤認為 BUG
    setThreads(prev => ({ ...prev, [topicKey]: [...(prev[topicKey] ?? []), { role: 'assistant', content: '' }] }));
    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart, messages: apiMessages }),
      });
      if (res.status === 404) throw new Error('api-missing');
      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || `解讀請求失敗（HTTP ${res.status}）。`);
      }
      if (!res.body) throw new Error('無響應流');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let pending = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let newline = pending.indexOf('\n');
        while (newline >= 0) {
          const line = pending.slice(0, newline).replace(/\r$/, '');
          pending = pending.slice(newline + 1);
          newline = pending.indexOf('\n');
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            const delta = parsed.delta?.text ?? '';
            assistantText += delta;
            setThreads(prev => {
              const arr = [...(prev[topicKey] ?? [])];
              arr[arr.length - 1] = { role: 'assistant', content: assistantText };
              return { ...prev, [topicKey]: arr };
            });
          } catch (error) {
            if (error instanceof Error && error.message !== 'Unexpected end of JSON input') throw error;
          }
        }
      }
    } catch (e) {
      const missing = e instanceof Error && e.message === 'api-missing';
      const message = missing
        ? 'AI 解讀 API 尚未部署。排盤功能仍可正常使用。'
        : e instanceof Error ? e.message : '解讀失敗，請稍後重試。';
      setThreads(prev => {
        const arr = [...(prev[topicKey] ?? [])];
        const last = arr[arr.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          arr[arr.length - 1] = { role: 'assistant', content: message };
          return { ...prev, [topicKey]: arr };
        }
        return { ...prev, [topicKey]: [...arr, { role: 'assistant', content: message }] };
      });
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const sendMessage = (text: string, hidden = false, topicKey?: string) => {
    if (!text.trim() || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const targetKey = topicKey ?? activeTopic;
    const userMsg: Message = { role: 'user', content: text, hidden };

    // 匯總所有分類線程的對話歷史（系統讀取所有對話），每線程取最近 4 條，整體截斷至最近 20 條
    const history: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const t of TOPICS) {
      const thr = threadsRef.current[t.key] ?? [];
      for (const m of thr.slice(-4)) history.push({ role: m.role, content: m.content });
    }
    const apiMessages = [...history, { role: 'user', content: text }].slice(-20);

    setThreads(prev => ({ ...prev, [targetKey]: [...(prev[targetKey] ?? []), userMsg] }));
    setInput('');
    streamResponse(apiMessages, targetKey);
  };

  const handleTopicClick = (topicKey: string) => {
    if (loadingRef.current) return;
    setActiveTopic(topicKey);
    const hasContent = (threadsRef.current[topicKey]?.length ?? 0) > 0;
    if (!hasContent) {
      sendMessage(TOPIC_PROMPTS[topicKey], true, topicKey);
    }
  };

  const handleSend = () => {
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden card-glass">

      {chart.lunarInfo.solarTermBoundaryWarning && (
        <div role="status" className="flex-shrink-0 px-3 py-2 text-[10px] leading-relaxed" style={{ color: '#b45309', background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
          出生時間位於節氣柱切換約一分鐘範圍。節氣四柱已按輸入分鐘計算，請核對出生證明或原始時間；此結果不含秒級判定。
        </div>
      )}

      {chart.lunarInfo.baziFacts && (
        <div className="flex-shrink-0 px-3 py-2 text-[10px] leading-relaxed" style={{ color: 'var(--t-text2)', borderBottom: '1px solid var(--t-border)' }}>
          <span style={{ color: 'var(--t-gold)' }}>規則引擎八字資料</span>
          <span className="ml-2">日主 {chart.lunarInfo.baziFacts.dayMaster}{chart.lunarInfo.baziFacts.dayMasterElement}</span>
          <span className="ml-2">強弱簡化初判：{chart.lunarInfo.baziFacts.strength.label}</span>
          <span className="ml-2">· {chart.lunarInfo.solarTermPrecision === 'exact-minute' ? '按原始時分' : '時辰中點估算節氣年/月柱'}</span>
        </div>
      )}

      {/* ── Topic buttons ── */}
      <div className="flex-shrink-0 px-2 pt-2.5 pb-2" style={{ borderBottom: '1px solid var(--t-border)' }}>
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
          {TOPICS.map(t => {
            const isActive = activeTopic === t.key;
            const hasContent = (threads[t.key]?.length ?? 0) > 0;
            return (
              <button
                key={t.key}
                onClick={() => handleTopicClick(t.key)}
                disabled={loading}
                className="relative py-1.5 text-[10px] font-medium rounded-lg transition-all duration-150 disabled:opacity-40"
                style={{
                  background: isActive ? 'rgba(212,168,67,0.12)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(212,168,67,0.3)' : 'var(--t-border)'}`,
                  color: isActive ? 'var(--t-gold)' : 'var(--t-faint)',
                }}
              >
                {t.label}
                {hasContent && (
                  <span
                    className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--t-gold)' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        {/* Loading state before first message */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3" style={{ color: 'var(--t-gold)', opacity: 0.1 }}>✦</div>
            <p className="text-[10px] animate-pulse" style={{ color: 'var(--t-faint)' }}>{(TOPICS.find(t => t.key === activeTopic)?.label ?? '命格')}解讀生成中…</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            if (msg.role === 'user' && msg.hidden) return null;

            if (msg.role === 'user') {
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div
                    className="max-w-[85%] rounded-xl px-3 py-2 text-[11px]"
                    style={{
                      background: 'rgba(212,168,67,0.08)',
                      border: '1px solid rgba(212,168,67,0.18)',
                      color: 'var(--t-gold)',
                    }}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              );
            }

            // Assistant message
            const isLastMsg = i === messages.length - 1;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div
                  className="text-[9px] tracking-widest mb-2 flex items-center gap-1.5"
                  style={{ color: 'var(--t-faint)' }}
                >
                  <span style={{ color: 'var(--t-gold)', opacity: 0.4 }}>✦</span>
                  命理解讀
                </div>
                <AiContent text={msg.content} streaming={loading && isLastMsg} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Input ── */}
      <div className="flex-shrink-0 px-3 pb-3 pt-2" style={{ borderTop: '1px solid var(--t-border)' }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="繼續追問，如：今年適合換工作嗎？"
            disabled={loading}
            className="flex-1 rounded-lg px-3 py-2 text-[11px] focus:outline-none transition-colors"
            style={{
              background: 'var(--t-card)',
              border: '1px solid var(--t-border)',
              color: 'var(--t-text)',
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-3 py-2 rounded-lg text-[11px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(212,168,67,0.15)',
              border: '1px solid rgba(212,168,67,0.25)',
              color: 'var(--t-gold)',
            }}
          >
            {loading ? '…' : '追問'}
          </button>
        </div>
      </div>

    </div>
  );
}
