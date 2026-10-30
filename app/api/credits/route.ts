import { billingEnabled, getBalance, getVisitor, missingBillingConfig, visitorCookieHeader } from '@/lib/credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const visitor = getVisitor(request);

  if (!billingEnabled()) {
    const response = Response.json({ credits: 0, enabled: false, missing: missingBillingConfig() });
    if (visitor.isNew) response.headers.append('Set-Cookie', visitorCookieHeader(visitor.id));
    return response;
  }

  try {
    const credits = await getBalance(visitor.id);
    const response = Response.json({ credits, enabled: true });
    if (visitor.isNew) response.headers.append('Set-Cookie', visitorCookieHeader(visitor.id));
    return response;
  } catch (error) {
    console.error('[credits] 讀取餘額失敗', error instanceof Error ? error.message : error);
    return Response.json({ credits: 0, enabled: true, error: 'DB_ERROR' }, { status: 500 });
  }
}
