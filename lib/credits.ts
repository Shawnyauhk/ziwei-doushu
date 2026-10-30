import { randomUUID } from 'node:crypto';
import { ensureSchema, getPool, hasDatabase } from './db';

/**
 * 匿名訪客以 httpOnly cookie 識別，次數記在 Postgres。
 * 尚未接入登入系統前，換裝置／清除 cookie 會視為新訪客。
 */
export const VISITOR_COOKIE = 'ziwei_vid';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Visitor {
  id: string;
  isNew: boolean;
}

export function getVisitor(request: Request): Visitor {
  const header = request.headers.get('cookie') ?? '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${VISITOR_COOKIE}=([^;]+)`));
  const value = match?.[1]?.trim();
  if (value && UUID_RE.test(value)) {
    return { id: value.toLowerCase(), isNew: false };
  }
  return { id: randomUUID(), isNew: true };
}

export function visitorCookieHeader(id: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${VISITOR_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;
}

/** 只有在同時配置資料庫與 Stripe 時才啟用收費，避免本地開發被鎖住。 */
export function billingEnabled(): boolean {
  return hasDatabase() && Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/** 回報缺少的計費環境變數名稱（不含任何密鑰值），方便部署排查。 */
export function missingBillingConfig(): string[] {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL?.trim()) missing.push('DATABASE_URL');
  if (!process.env.STRIPE_SECRET_KEY?.trim()) missing.push('STRIPE_SECRET_KEY');
  if (!process.env.STRIPE_PRICE_SINGLE?.trim()) missing.push('STRIPE_PRICE_SINGLE');
  if (!process.env.STRIPE_PRICE_PACK5?.trim()) missing.push('STRIPE_PRICE_PACK5');
  if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) missing.push('STRIPE_WEBHOOK_SECRET');
  return missing;
}

export async function getBalance(visitorId: string): Promise<number> {
  await ensureSchema();
  const result = await getPool().query<{ credits: number }>(
    'select credits from credit_balances where visitor_id = $1',
    [visitorId],
  );
  return result.rows[0]?.credits ?? 0;
}

/** 原子扣 1 次；餘額不足回傳 null。 */
export async function consumeCredit(visitorId: string): Promise<number | null> {
  await ensureSchema();
  const result = await getPool().query<{ credits: number }>(
    `update credit_balances
        set credits = credits - 1, updated_at = now()
      where visitor_id = $1 and credits > 0
      returning credits`,
    [visitorId],
  );
  return result.rowCount === 1 ? result.rows[0].credits : null;
}

/** 上游失敗時退回剛扣的 1 次。 */
export async function refundCredit(visitorId: string): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `update credit_balances
        set credits = credits + 1, updated_at = now()
      where visitor_id = $1`,
    [visitorId],
  );
}

export interface GrantInput {
  sessionId: string;
  visitorId: string;
  credits: number;
  email?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
}

/**
 * 付款成功後入帳。以 Stripe Checkout Session ID 做冪等鍵，
 * 重複的 webhook 不會重複加次數。
 */
export async function grantCredits(input: GrantInput): Promise<boolean> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('insert into visitors (id) values ($1) on conflict (id) do nothing', [input.visitorId]);

    const inserted = await client.query(
      `insert into purchases (session_id, visitor_id, email, credits, amount_total, currency)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (session_id) do nothing
       returning session_id`,
      [input.sessionId, input.visitorId, input.email ?? null, input.credits, input.amountTotal ?? null, input.currency ?? null],
    );

    if (inserted.rowCount === 0) {
      await client.query('rollback');
      return false;
    }

    await client.query(
      `insert into credit_balances (visitor_id, credits) values ($1, $2)
       on conflict (visitor_id)
       do update set credits = credit_balances.credits + excluded.credits, updated_at = now()`,
      [input.visitorId, input.credits],
    );

    await client.query('commit');
    return true;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function isValidVisitorId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
