import { NextRequest, NextResponse } from 'next/server';
import { getGenieACSCredentials } from '../route';

// GET - Debug endpoint to see raw device data structure
export async function GET(request: NextRequest) {
  try {
    const credentials = await getGenieACSCredentials();

    if (!credentials) {
      return NextResponse.json(
        { error: 'GenieACS not configured' },
        { status: 400 }
      );
    }

    const { host, username, password } = credentials;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      // Get just first device for debugging
      const response = await fetch(`${host}/devices?limit=1`, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json(
          { error: `GenieACS API returned ${response.status}` },
          { status: response.status }
        );
      }

      const devices = await response.json();
      
      if (devices.length === 0) {
        return NextResponse.json({ message: 'No devices found', devices: [] });
      }

      const device = devices[0];
      
      // Extract relevant keys for debugging
      const debugInfo = {
        _id: device._id,
        _deviceId: device._deviceId,
        _lastInform: device._lastInform,
        _tags: device._tags,
        // Check what keys exist at top level
        topLevelKeys: Object.keys(device),
        // Check DeviceID structure
        DeviceID: device.DeviceID,
        // Check VirtualParameters
        VirtualParameters: device.VirtualParameters,
        // Check InternetGatewayDevice.DeviceInfo
        DeviceInfo: device.InternetGatewayDevice?.DeviceInfo,
        // Check InternetGatewayDevice.ManagementServer
        ManagementServer: device.InternetGatewayDevice?.ManagementServer,
        // Check InternetGatewayDevice.WANDevice
        WANDevice: device.InternetGatewayDevice?.WANDevice,
      };

      return NextResponse.json({
        success: true,
        debug: debugInfo,
        rawDeviceKeys: Object.keys(device),
        // Limit raw device to prevent huge response
        rawDevice: JSON.stringify(device).substring(0, 10000)
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error: any) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
