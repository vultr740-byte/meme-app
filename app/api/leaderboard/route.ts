import { NextResponse } from 'next/server';
import { ensureFreshToken } from '../tokenStore';

const LEADERBOARD_API_URL = 'https://prod-api.fomo.family/v2/leaderboard/24h?limit=100';
const FOMO_API_TOKEN = process.env.FOMO_API_TOKEN;

async function fetchLeaderboard() {
  const token = (await ensureFreshToken()) || FOMO_API_TOKEN;
  if (!token) throw new Error('Missing bearer token');
  
  console.log('🔍 请求排行榜数据，URL:', LEADERBOARD_API_URL);

  const response = await fetch(LEADERBOARD_API_URL, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Upstream error ${response.status}: ${text || 'No body'}`);
  }

  return response.json();
}

export async function GET() {
  try {
    const data = await fetchLeaderboard();
    console.log('✅ 排行榜数据获取成功');
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('❌ 获取排行榜数据失败:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 }
    );
  }
}
