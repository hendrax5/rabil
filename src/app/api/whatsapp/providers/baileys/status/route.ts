import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://wa-engine:3006/api/status', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error('Wa-engine returned ' + response.status);
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to connect to wa-engine:', error.message);
    return NextResponse.json({ status: 'offline', connected: false }, { status: 500 });
  }
}
