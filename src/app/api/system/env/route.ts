import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    vpnIpsecPsk: process.env.VPN_IPSEC_PSK || 'aibill-secret'
  });
}
