import Stripe from 'stripe';
import { getPool, hasDatabase } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 只讀健康檢查：驗證 Stripe 金鑰與 Price 是否可用。
 * 只回報狀態與非敏感資訊，絕不回傳金鑰本身。
 */
export async function GET() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const result: {
    keyConfigured: boolean;
    keyStatus: 'missing' | 'valid' | 'invalid' | 'restricted' | 'unknown';
    livemode: boolean | null;
    keyError?: string;
    prices: Record<string, unknown>;
    database: string;
  } = {
    keyConfigured: Boolean(secretKey),
    keyStatus: secretKey ? 'unknown' : 'missing',
    livemode: null,
    prices: {},
    database: hasDatabase() ? 'configured' : 'missing',
  };

  if (!secretKey) {
    return Response.json(result);
  }

  const stripe = new Stripe(secretKey);

  try {
    const balance = await stripe.balance.retrieve();
    result.keyStatus = 'valid';
    result.livemode = balance.livemode;
  } catch (error) {
    const detail = error as { type?: string; code?: string; statusCode?: number; message?: string };
    if (detail.type === 'StripeAuthenticationError' || detail.code === 'api_key_invalid' || detail.statusCode === 401) {
      result.keyStatus = 'invalid';
    } else if (detail.statusCode === 403) {
      // 金鑰能通過認證，但沒有 balance 讀取權限（restricted key 常見）
      result.keyStatus = 'restricted';
    } else {
      result.keyStatus = 'unknown';
    }
    result.keyError = detail.message?.slice(0, 200) ?? 'unknown';
  }

  const priceVars: Array<[string, string]> = [
    ['single', 'STRIPE_PRICE_SINGLE'],
    ['pack5', 'STRIPE_PRICE_PACK5'],
  ];

  for (const [pack, envName] of priceVars) {
    const priceId = process.env[envName]?.trim();
    if (!priceId) {
      result.prices[pack] = { configured: false };
      continue;
    }
    try {
      const price = await stripe.prices.retrieve(priceId);
      result.prices[pack] = {
        configured: true,
        ok: true,
        active: price.active,
        currency: price.currency,
        unitAmount: price.unit_amount,
        livemode: price.livemode,
      };
    } catch (error) {
      result.prices[pack] = {
        configured: true,
        ok: false,
        error: (error as { message?: string }).message?.slice(0, 200) ?? 'unknown',
      };
    }
  }

  if (hasDatabase()) {
    try {
      await getPool().query('select 1');
      result.database = 'ok';
    } catch {
      result.database = 'error';
    }
  }

  return Response.json(result);
}
