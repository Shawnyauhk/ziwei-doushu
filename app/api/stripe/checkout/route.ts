import Stripe from 'stripe';
import { billingEnabled, getVisitor, visitorCookieHeader } from '@/lib/credits';
import { SITE_URL } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PACKS = {
  single: { priceEnv: 'STRIPE_PRICE_SINGLE', credits: 1 },
  pack5: { priceEnv: 'STRIPE_PRICE_PACK5', credits: 5 },
} as const;

type PackKey = keyof typeof PACKS;

let stripeClient: Stripe | null = null;

function getStripe(secretKey: string): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

export async function POST(request: Request) {
  if (!billingEnabled()) {
    return Response.json({ error: '收費功能尚未啟用（缺少 DATABASE_URL 或 STRIPE_SECRET_KEY）。' }, { status: 503 });
  }
  const secretKey = process.env.STRIPE_SECRET_KEY!.trim();

  const body = (await request.json().catch(() => null)) as { pack?: unknown } | null;
  const packKey = (typeof body?.pack === 'string' ? body.pack : 'single') as PackKey;
  const pack = PACKS[packKey];
  if (!pack) {
    return Response.json({ error: '無效的購買方案。' }, { status: 400 });
  }

  const priceId = process.env[pack.priceEnv]?.trim();
  if (!priceId) {
    return Response.json({ error: `伺服器尚未設定 ${pack.priceEnv}。` }, { status: 503 });
  }

  const visitor = getVisitor(request);
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL).replace(/\/+$/, '');

  try {
    const session = await getStripe(secretKey).checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/chart?purchase=success`,
      cancel_url: `${origin}/chart?purchase=cancel`,
      client_reference_id: visitor.id,
      metadata: {
        visitorId: visitor.id,
        credits: String(pack.credits),
        pack: packKey,
      },
      customer_creation: 'always',
      allow_promotion_codes: true,
      locale: 'zh-HK',
    });

    if (!session.url) {
      return Response.json({ error: '無法建立付款頁面，請稍後重試。' }, { status: 502 });
    }

    const response = Response.json({ url: session.url });
    if (visitor.isNew) response.headers.append('Set-Cookie', visitorCookieHeader(visitor.id));
    return response;
  } catch (error) {
    console.error('[stripe] 建立 Checkout Session 失敗', error instanceof Error ? error.message : error);
    return Response.json({ error: '無法建立付款頁面，請稍後重試。' }, { status: 500 });
  }
}
