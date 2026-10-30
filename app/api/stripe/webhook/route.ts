import Stripe from 'stripe';
import { grantCredits, isValidVisitorId } from '@/lib/credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
]);

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secretKey || !webhookSecret) {
    return new Response('stripe not configured', { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response('missing stripe-signature', { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = new Stripe(secretKey).webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('[stripe] Webhook 簽章驗證失敗', error instanceof Error ? error.message : error);
    return new Response('invalid signature', { status: 400 });
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return Response.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return Response.json({ received: true, ignored: `payment_status:${session.payment_status}` });
  }

  const visitorId = session.metadata?.visitorId ?? session.client_reference_id;
  const credits = Number(session.metadata?.credits ?? 0);
  if (!isValidVisitorId(visitorId) || !Number.isInteger(credits) || credits <= 0) {
    console.error('[stripe] Webhook 缺少有效的 visitorId/credits', {
      sessionId: session.id,
      visitorId,
      credits,
    });
    return Response.json({ received: true, ignored: 'invalid metadata' });
  }

  try {
    await grantCredits({
      sessionId: session.id,
      visitorId,
      credits,
      email: session.customer_details?.email ?? null,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
    });
  } catch (error) {
    console.error('[stripe] 入帳失敗', error instanceof Error ? error.message : error);
    // 回 500 讓 Stripe 重試
    return new Response('grant failed', { status: 500 });
  }

  return Response.json({ received: true });
}
