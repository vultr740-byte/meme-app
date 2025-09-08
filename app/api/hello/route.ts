import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Hello from API route',
    time: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({
      received: body,
      status: 'ok',
    });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}


