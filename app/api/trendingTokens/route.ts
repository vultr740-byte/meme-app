import { NextResponse } from 'next/server';
import { ensureFreshToken } from '../tokenStore';

const TARGET_URL = 'https://prod-api.fomo.family/proxy/trendingTokens';

const FOMO_API_TOKEN = process.env.FOMO_API_TOKEN;

async function fetchTrendingTokens() {
  const token = (await ensureFreshToken()) || FOMO_API_TOKEN;
  if (!token) throw new Error('Missing bearer token');
  const response = await fetch(TARGET_URL, {
    method: 'POST',
    // No request body; explicitly omit 'body' and content-type
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Upstream error ${response.status}: ${text || 'No body'}`);
  }

  return response.json();
}

export async function GET() {
  try {
    const data = await fetchTrendingTokens();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 }
    );
  }
}

export async function POST() {
  // Our route also supports POST and forwards as POST without body
  try {
    const data = await fetchTrendingTokens();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 }
    );
  }
}


