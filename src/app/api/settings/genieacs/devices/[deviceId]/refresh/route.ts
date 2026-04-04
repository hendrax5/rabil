import { NextRequest, NextResponse } from 'next/server';
import { getGenieACSCredentials } from '../../../route';

// POST - Refresh parameters for a specific device
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

    // Create refresh task for the device
    // This will trigger GenieACS to refresh all parameters from the device
    const taskBody = {
      name: 'refreshObject',
      objectName: ''  // Empty string means refresh all objects
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
      // Try alternative approach - getParameterValues task
      const altTaskBody = {
        name: 'getParameterValues',
        parameterNames: [
          'InternetGatewayDevice.',
          'Device.'
        ]
      };

      const altResponse = await fetch(`${host}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(altTaskBody),
      });

      if (!altResponse.ok) {
        const errorText = await altResponse.text();
        console.error('GenieACS refresh error:', errorText);
        return NextResponse.json(
          { success: false, error: `Failed to send refresh task: ${altResponse.status}` },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Refresh parameters task sent successfully',
      deviceId
    });

  } catch (error: unknown) {
    console.error('Error refreshing device parameters:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to refresh parameters';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
