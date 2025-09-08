import { NextResponse } from 'next/server';
import { setBearerToken } from '../tokenStore';

const REFRESH_URL = 'https://auth.privy.io/api/v1/sessions';

export async function POST() {
  const refreshToken = process.env.PRIVY_REFRESH_TOKEN;
  const clientId = process.env.PRIVY_CLIENT_ID || 'client-WY5gFSayQjxnQhG4rP6SnwPAyPZWZpNRhJ6xkhmfgbmVh';
  const appId = process.env.PRIVY_APP_ID || 'cm6h485o300n3zj9yl6vpedq7';
  const authorization = process.env.PRIVY_AUTHORIZATION_BEARER;

  if (!refreshToken || !authorization) {
    console.log('⚠️ 缺少环境变量: PRIVY_REFRESH_TOKEN 或 PRIVY_AUTHORIZATION_BEARER');
    return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
  }

  try {
    const res = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'privy-client-id': clientId,
        'privy-client': 'expo:0.50.0',
        accept: 'application/json',
        authorization: `Bearer ${authorization}`,
        'accept-language': 'zh-CN,zh-Hans;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'privy-app-id': appId,
        'user-agent': 'fomo/108 CFNetwork/1494.0.7 Darwin/23.4.0',
        'x-native-app-identifier': 'family.fomo.app',
      },
      // Note: exclude Cookie header for security; server will manage
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json({ error: `Privy error ${res.status}: ${text}` }, { status: 502 });
    }
    const data = await res.json();
    
    // Try multiple possible token paths (same order as tokenStore.ts)
    const possibleTokenPaths = [
      'token',
      'privy_access_token', 
      'access_token',
      'session.token',
      'session.access_token',
      'accessToken',
      'authToken',
      'bearer_token'
    ];
    
    let nextToken = null;
    for (const path of possibleTokenPaths) {
      const value = path.split('.').reduce((obj, key) => obj?.[key], data);
      if (value && typeof value === 'string') {
        nextToken = value;
        console.log(`✅ 成功获取 token`);
        break;
      }
    }
    
    const expiresIn = data?.expires_in || data?.expiresIn || 15 * 60; // default 15m
    
    if (!nextToken) {
      console.log('❌ 在 Privy 响应中未找到 token');
      return NextResponse.json({ error: 'No token in Privy response' }, { status: 502 });
    }
    setBearerToken(nextToken, expiresIn);
    return NextResponse.json({ ok: true, expiresIn });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}


