import { NextResponse } from 'next/server';
import { ensureFreshToken } from '../tokenStore';

const TARGET_URL = 'https://prod-api.fomo.family/feed?limit=50&feedTypes=single_user_buy&feedTypes=single_user_sell&feedTypes=user_trade_profit_milestone&feedTypes=large_buy&feedTypes=large_sell&feedTypes=manual&feedTypes=multi_user_buy&feedTypes=multi_user_sell&feedTypes=new_token_listing&feedTypes=price_since_listing';

export async function GET() {
  const token = (await ensureFreshToken()) || process.env.FOMO_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Missing FOMO_API_TOKEN' }, { status: 500 });
  }
  try {
    const response = await fetch(TARGET_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json({ error: `Upstream error ${response.status}: ${text}` }, { status: 502 });
    }
    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}


