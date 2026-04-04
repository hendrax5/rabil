import { NextRequest, NextResponse } from 'next/server';
import { getGenieACSCredentials } from '../../../route';

// POST - Reboot a specific device
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    
    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'Device ID is required' },
        { status: 400 }
      );
    }

    const credentials = await getGenieACSCredentials();

    if (!credentials) {
      return NextResponse.json(
        { success: false, error: 'GenieACS not configured' },
        { status: 400 }
      );
    }

    const { host, username, password } = credentials;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    // Create reboot task for the device
    const taskBody = {
      name: 'reboot'
    };

    const response = await fetch(`${host}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(taskBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GenieACS reboot error:', errorText);
      return NextResponse.json(
        { success: false, error: `Failed to send reboot task: ${response.status}` },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Reboot task sent successfully',
      deviceId
    });

  } catch (error: unknown) {
    console.error('Error rebooting device:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to reboot device';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
