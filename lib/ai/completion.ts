import type { ZiweiChart } from '@/lib/ziwei/types';
import { calculateBaziFacts } from '@/lib/ziwei/bazi';
import { toTraditionalDisplayText } from '@/lib/ziwei/display-text';

/**
 * AI 供應商串流共用層：解讀（/api/interpret）與合盤（/api/heming）共用，
 * 確保模型設定、thinking 關閉、錯誤對應與 SSE 格式完全一致。
 */
export type Provider = 'gemini' | 'modelscope' | 'zhipu';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type SseEvent = { text: string } | { error: string } | { done: true } | null;

const MODELSCOPE_CHAT_URL = 'https://api-inference.modelscope.cn/v1/chat/completions';
const ZHIPU_CHAT_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const CONNECT_TIMEOUT_MS = 90_000;

const encoder = new TextEncoder();

export type ProviderConfig =
  | { ok: true; provider: Provider; apiKey: string; model: string; providerName: string }
  | { ok: false; status: number; error: string };

export function resolveProvider(): ProviderConfig {
  const providerSetting = (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase();
  if (providerSetting !== 'gemini' && providerSetting !== 'modelscope' && providerSetting !== 'zhipu') {
    return { ok: false, status: 500, error: 'AI_PROVIDER 僅支援 gemini、modelscope 或 zhipu。' };
  }
  const provider = providerSetting as Provider;
  const apiKey = provider === 'modelscope'
    ? process.env.MODELSCOPE_API_KEY
    : provider === 'zhipu' ? process.env.ZHIPU_API_KEY : process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    return {
      ok: false,
      status: 503,
      error: provider === 'modelscope'
        ? '伺服器尚未設定 MODELSCOPE_API_KEY。'
        : provider === 'zhipu'
          ? '伺服器尚未設定 ZHIPU_API_KEY。'
          : '伺服器尚未設定 GEMINI_API_KEY。',
    };
  }

  const model = provider === 'modelscope'
    ? (process.env.MODELSCOPE_MODEL || 'Qwen/Qwen3.5-35B-A3B').trim()
    : provider === 'zhipu'
      ? (process.env.ZHIPU_MODEL || 'glm-4.7-flash').trim()
      : (process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim();
  const modelPattern = provider === 'gemini' ? /^[a-zA-Z0-9._-]{1,80}$/ : /^[a-zA-Z0-9._/-]{1,160}$/;
  if (!modelPattern.test(model)) {
    return {
      ok: false,
      status: 500,
      error: `${provider === 'modelscope' ? 'ModelScope' : provider === 'zhipu' ? '智譜' : 'Gemini'} 模型設定無效。`,
    };
  }

  return {
    ok: true,
    provider,
    apiKey: apiKey.trim(),
    model,
    providerName: provider === 'modelscope' ? 'ModelScope' : provider === 'zhipu' ? '智譜' : 'Gemini',
  };
}

/** 輸出長度上限：縮短可明顯減少尾段等待；可用 AI_MAX_TOKENS 覆寫。 */
export function resolveMaxOutputTokens(): number {
  const raw = Number(process.env.AI_MAX_TOKENS ?? 1400);
  return Number.isFinite(raw) ? Math.min(Math.max(Math.round(raw), 400), 4000) : 1400;
}

function sanitizeFourPillars(value: unknown): [string, string, string, string] | undefined {
  const stems = '甲乙丙丁戊己庚辛壬癸';
  const branches = '子醜寅卯辰巳午未申酉戌亥';
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every((pillar) =>
      typeof pillar === 'string' &&
      [...pillar].length === 2 &&
      stems.includes(pillar[0]) &&
      branches.includes(pillar[1])
    )
  ) return undefined;
  return value as [string, string, string, string];
}

function toTraditionalStringLeaves(value: unknown): unknown {
  if (typeof value === 'string') return toTraditionalDisplayText(value);
  if (Array.isArray(value)) return value.map(toTraditionalStringLeaves);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, toTraditionalStringLeaves(item)]),
    );
  }
  return value;
}

/** 將命盤轉為匿名化、去識別化的 JSON 字串，供模型參考。 */
export function toChartContext(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const chart = value as Partial<ZiweiChart>;
  if (!Array.isArray(chart.palaces) || chart.palaces.length !== 12) return null;

  const birthInfo = chart.birthInfo;
  const palaces = chart.palaces.map((palace) => ({
    name: toTraditionalDisplayText(String(palace.name ?? '').slice(0, 20)),
    branch: palace.branch,
    stem: palace.stem,
    isMingGong: Boolean(palace.isMingGong),
    isShenGong: Boolean(palace.isShenGong),
    daXianAge: palace.daXianAge,
    stars: Array.isArray(palace.stars)
      ? palace.stars.slice(0, 40).map((star) => ({
          name: toTraditionalDisplayText(String(star.name ?? '').slice(0, 20)),
          type: star.type,
          siHua: typeof star.siHua === 'string' ? toTraditionalDisplayText(star.siHua) : star.siHua,
          brightness: star.brightnessRaw,
        }))
      : [],
  }));

  // 不把姓名、出生地、經度或公曆生日傳給模型；解讀只使用排盤所需資訊。
  return JSON.stringify(toTraditionalStringLeaves({
    gender: birthInfo?.gender === 'female' ? '女' : birthInfo?.gender === 'male' ? '男' : '未提供',
    hourBranch: Number.isInteger(birthInfo?.hour) ? birthInfo?.hour : null,
    currentAge: chart.currentAge,
    wuxingJu: toTraditionalDisplayText(String(chart.wuxingJuName ?? '').slice(0, 20)),
    mingGongBranch: chart.mingGongBranch,
    shenGongBranch: chart.shenGongBranch,
    currentDaXian: Number.isInteger(chart.currentDaXianIndex) && (chart.currentDaXianIndex ?? -1) >= 0
      ? chart.daXians?.[chart.currentDaXianIndex ?? -1]
      : undefined,
    fourPillarsSolarTerm: sanitizeFourPillars(chart.lunarInfo?.fourPillars),
    fourPillarsLunar: sanitizeFourPillars(chart.lunarInfo?.fourPillarsLunar),
    baziFacts: calculateBaziFacts(sanitizeFourPillars(chart.lunarInfo?.fourPillars) ?? []),
    solarTermPrecision: chart.lunarInfo?.solarTermPrecision === 'exact-minute' ? 'exact-minute' : 'hour-midpoint',
    solarTermBoundaryWarning: chart.lunarInfo?.solarTermBoundaryWarning === true,
    palaces,
  }));
}

function parseSseEvent(event: string, provider: Provider): SseEvent {
  const data = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!data) return null;
  if (data === '[DONE]') return { done: true };

  try {
    const payload = JSON.parse(data) as {
      error?: { message?: string } | string;
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
      choices?: Array<{ delta?: { content?: string | Array<{ text?: string }> } }>;
    };

    if (payload.error) {
      const message = typeof payload.error === 'string' ? payload.error : payload.error.message;
      return { error: String(message || '上游 AI 服務回傳錯誤。') };
    }

    if (provider === 'gemini') {
      const text = payload.candidates?.[0]?.content?.parts
        ?.filter((part) => !part.thought && typeof part.text === 'string')
        .map((part) => part.text)
        .join('');
      return text ? { text } : null;
    }

    const content = payload.choices?.[0]?.delta?.content;
    if (typeof content === 'string') return content ? { text: content } : null;
    if (Array.isArray(content)) {
      const text = content.map((part) => part.text ?? '').join('');
      return text ? { text } : null;
    }
    return null;
  } catch {
    return null;
  }
}

export interface StreamCompletionOptions {
  request: Request;
  config: Extract<ProviderConfig, { ok: true }>;
  systemInstruction: string;
  messages: ChatMessage[];
  /** 上游在輸出任何內容前就失敗時呼叫（用於退回已扣次數）。 */
  onNoOutputFailure?: () => Promise<void> | void;
  /** 額外標籤，僅用於日誌。 */
  logTag?: string;
}

export type StreamCompletionResult =
  | { ok: true; response: Response }
  | { ok: false; status: number; error: string };

export async function streamCompletion(options: StreamCompletionOptions): Promise<StreamCompletionResult> {
  const { request, config, systemInstruction, messages, onNoOutputFailure, logTag = '' } = options;
  const { provider, apiKey, model, providerName } = config;

  const MAX_OUTPUT_TOKENS = resolveMaxOutputTokens();
  // Qwen3 系列預設可能開啟 thinking，會先產生大量推理內容才輸出正文（首字延遲 10-30 秒）。
  // 可用 MODELSCOPE_ENABLE_THINKING=true 還原；若上游不支援該參數會自動重試一次。
  const modelscopeDisableThinking = process.env.MODELSCOPE_ENABLE_THINKING !== 'true';
  const buildOpenAiBody = (withThinkingFlag: boolean) => JSON.stringify({
    model,
    messages: [{ role: 'system', content: systemInstruction }, ...messages],
    stream: true,
    temperature: 0.7,
    max_tokens: MAX_OUTPUT_TOKENS,
    ...(provider === 'zhipu' ? { thinking: { type: 'disabled' } } : {}),
    ...(provider === 'modelscope' && withThinkingFlag ? { enable_thinking: false } : {}),
  });

  const connectController = new AbortController();
  const connectTimer = setTimeout(() => connectController.abort(), CONNECT_TIMEOUT_MS);
  const upstreamSignal = AbortSignal.any([request.signal, connectController.signal]);
  const buildStartedAt = Date.now();
  const label = logTag ? `${providerName}${logTag}` : providerName;
  const failWithoutOutput = async () => {
    if (onNoOutputFailure) await onNoOutputFailure();
  };

  let upstream: Response;
  try {
    if (provider === 'modelscope' || provider === 'zhipu') {
      const chatUrl = provider === 'modelscope' ? MODELSCOPE_CHAT_URL : ZHIPU_CHAT_URL;
      const send = (withThinkingFlag: boolean) => fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: buildOpenAiBody(withThinkingFlag),
        cache: 'no-store',
        signal: upstreamSignal,
      });

      upstream = await send(provider === 'modelscope' && modelscopeDisableThinking);

      // 上游不認得 enable_thinking 時，去掉參數重試一次
      if (provider === 'modelscope' && modelscopeDisableThinking && upstream.status === 400) {
        const detail = await upstream.text().catch(() => '');
        if (/enable_thinking|thinking/i.test(detail)) {
          console.warn('[ModelScope] enable_thinking 不受支援，改用預設參數重試');
          upstream = await send(false);
        }
      }
    } else {
      upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: messages.map((message) => ({
              role: message.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: message.content }],
            })),
            generationConfig: { temperature: 0.7, maxOutputTokens: MAX_OUTPUT_TOKENS },
          }),
          cache: 'no-store',
          signal: upstreamSignal,
        },
      );
    }
  } catch (error) {
    const cause = error instanceof Error && 'cause' in error
      ? (error as Error & { cause?: { code?: unknown } }).cause?.code
      : undefined;
    console.error(`[${label}] upstream fetch failed`, {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      networkCode: typeof cause === 'string' ? cause : undefined,
    });
    await failWithoutOutput();
    return connectController.signal.aborted
      ? { ok: false, status: 504, error: `${providerName} API 連線逾時（${CONNECT_TIMEOUT_MS / 1000} 秒），請稍後重試。` }
      : { ok: false, status: 502, error: `無法連線至 ${providerName} API，請稍後重試。` };
  } finally {
    clearTimeout(connectTimer);
  }

  console.info(`[${label}] upstream ${upstream.status} in ${Date.now() - buildStartedAt}ms (model=${model}, max_tokens=${MAX_OUTPUT_TOKENS})`);

  if (!upstream.ok || !upstream.body) {
    await failWithoutOutput();
    const status = upstream.status;
    if (provider === 'modelscope' || provider === 'zhipu') {
      if (status === 400) return { ok: false, status: 502, error: `${providerName} API 拒絕請求（HTTP ${status}）。請確認模型 ID 與請求格式。` };
      if (status === 401 || status === 403) return { ok: false, status: 502, error: `${providerName} API 拒絕憑證（HTTP ${status}）。請確認 API Key 及其產品許可權。` };
      if (status === 429) return { ok: false, status: 429, error: `${providerName} API 目前流量或配額已達限制，請稍後重試。` };
      return { ok: false, status: 502, error: `${providerName} API 暫時無法服務（HTTP ${status}）。` };
    }
    if (status === 400 || status === 401 || status === 403) {
      return { ok: false, status: 502, error: `Gemini API 拒絕請求（HTTP ${status}）。請確認 API Key、Generative Language API 許可權與模型設定。` };
    }
    if (status === 429) return { ok: false, status: 429, error: 'Gemini API 目前流量或配額已達限制，請稍後重試。' };
    return { ok: false, status: 502, error: `Gemini API 暫時無法服務（HTTP ${status}）。` };
  }

  const upstreamReader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let emittedText = false;

  const response = new Response(new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = '';
      let closed = false;
      const finish = () => {
        if (closed) return;
        console.info(`[${label}] stream done in ${Date.now() - buildStartedAt}ms`);
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        closed = true;
      };
      const handleEvent = (event: string): boolean => {
        const parsed = parseSseEvent(event, provider);
        if (parsed && 'error' in parsed) {
          const safeMessage = parsed.error.replaceAll(apiKey, '[redacted]').slice(0, 400);
          if (!emittedText) void failWithoutOutput();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `${providerName} 串流錯誤：${safeMessage}` })}\n\n`));
          finish();
          return false;
        }
        if (parsed && 'text' in parsed && parsed.text) {
          if (!emittedText) {
            console.info(`[${label}] first token in ${Date.now() - buildStartedAt}ms`);
          }
          emittedText = true;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: { text: parsed.text } })}\n\n`));
        }
        if (parsed && 'done' in parsed) {
          finish();
          return false;
        }
        return true;
      };

      try {
        while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.match(/\r?\n\r?\n/);
          while (boundary && boundary.index !== undefined) {
            const event = buffer.slice(0, boundary.index);
            buffer = buffer.slice(boundary.index + boundary[0].length);
            if (!handleEvent(event)) {
              await upstreamReader.cancel().catch(() => undefined);
              return;
            }
            boundary = buffer.match(/\r?\n\r?\n/);
          }
        }
        buffer += decoder.decode();
        if (buffer.trim() && !handleEvent(buffer)) return;
        finish();
      } catch {
        if (!closed) {
          if (!emittedText) void failWithoutOutput();
          const message = `${providerName} 串流中斷，請重試。`;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
          finish();
        }
      } finally {
        upstreamReader.releaseLock();
      }
    },
    async cancel() {
      await upstreamReader.cancel().catch(() => undefined);
      if (!emittedText) await failWithoutOutput();
    },
  }), {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });

  return { ok: true, response };
}
