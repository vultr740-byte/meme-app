// Simple in-memory token store (per server instance)
let bearerToken: string | null = null;
let tokenExpiresAt: number | null = null; // epoch ms

export function setBearerToken(token: string, ttlSeconds?: number) {
  bearerToken = token;
  tokenExpiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
}

export function getBearerToken() {
  return bearerToken;
}

export function isTokenExpired() {
  return tokenExpiresAt != null && Date.now() > tokenExpiresAt;
}

export async function refreshPrivyToken(): Promise<string> {
  const REFRESH_URL = 'https://auth.privy.io/api/v1/sessions';
  const refreshToken = process.env.PRIVY_REFRESH_TOKEN;
  const clientId = process.env.PRIVY_CLIENT_ID || 'client-WY5gFSayQjxnQhG4rP6SnwPAyPZWZpNRhJ6xkhmfgbmVh';
  const appId = process.env.PRIVY_APP_ID || 'cm6h485o300n3zj9yl6vpedq7';
  const authorization = process.env.PRIVY_AUTHORIZATION_BEARER;
  if (!refreshToken || !authorization) {
    throw new Error('Missing PRIVY_REFRESH_TOKEN or PRIVY_AUTHORIZATION_BEARER');
  }
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
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Privy refresh failed ${res.status}: ${text}`);
  }
  const data = await res.json();
  
  // Try multiple possible token paths (same order as refresh-token/route.ts)
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
  
  let nextToken: string | undefined = undefined;
  for (const path of possibleTokenPaths) {
    const value = path.split('.').reduce((obj, key) => obj?.[key], data);
    if (value && typeof value === 'string') {
      nextToken = value;
      break;
    }
  }
  
  if (!nextToken) throw new Error('No token in Privy response');
  // Privy response may not have ttl; default to 15m, refresh early (14m)
  setBearerToken(nextToken, 14 * 60);
  return nextToken;
}

export async function ensureFreshToken(): Promise<string | null> {
  if (!bearerToken || isTokenExpired()) {
    try {
      return await refreshPrivyToken();
    } catch (error) {
      console.log('❌ Token refresh failed:', error);
      return null;
    }
  }
  return bearerToken;
}


