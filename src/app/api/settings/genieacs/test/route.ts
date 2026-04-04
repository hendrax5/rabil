import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-this-32';
const ALGORITHM = 'aes-256-cbc';

function decrypt(text: string): string {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return '';
  }
}

// POST - Test GenieACS connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { host, username, password } = body;

    if (!host) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Host URL is required' 
        },
        { status: 400 }
      );
    }

    // If UI obscured the password (hasPassword: true passed as empty string)
    // Or if password wasn't provided, try fetching it from DB to perform the test
    if (!password) {
      const existing = await prisma.genieacsSettings.findFirst({
        where: { host: host }
      });
      if (existing && existing.password) {
        password = decrypt(existing.password);
        username = existing.username || username;
      }
    }
    // Validate host URL format
    let validatedHost = host;
    try {
      const url = new URL(host);
      validatedHost = url.origin; // Ensure clean URL
    } catch {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid host URL format. Please use format like http://192.168.1.100:7557' 
        },
        { status: 400 }
      );
    }

    // Test connection by fetching devices with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const fetchHeaders: HeadersInit = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };
      
      if (username || password) {
        fetchHeaders['Authorization'] = 'Basic ' + Buffer.from(`${username || ''}:${password || ''}`).toString('base64');
      }

      const response = await fetch(`${validatedHost}/devices?limit=1`, {
        method: 'GET',
        headers: fetchHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          return NextResponse.json(
            { 
              success: false,
              error: 'Authentication failed. Invalid username or password.' 
            },
            { status: 200 } // Return 200 so frontend can handle properly
          );
        }
        throw new Error(`GenieACS returned status ${response.status}`);
      }

      const data = await response.json();
      const deviceCount = Array.isArray(data) ? data.length : 0;

      return NextResponse.json({
        success: true,
        message: `Connection successful! Found ${deviceCount} device(s).`,
        deviceCount,
        host: validatedHost
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { 
            success: false,
            error: 'Connection timeout. Please check if GenieACS server is running and accessible.' 
          },
          { status: 200 }
        );
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error('Error testing GenieACS connection:', error);
    
    let errorMessage = 'Connection failed. Please check your settings.';
    
    if (error.message?.includes('fetch failed') || error.cause?.code === 'ECONNREFUSED') {
      errorMessage = 'Unable to connect to GenieACS server. Please check:\n- The host URL is correct\n- GenieACS server is running\n- Network/firewall allows the connection';
    } else if (error.message?.includes('ENOTFOUND')) {
      errorMessage = 'Host not found. Please check the host URL.';
    } else if (error.message?.includes('ETIMEDOUT')) {
      errorMessage = 'Connection timed out. Please check if the server is accessible.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 200 } // Return 200 so frontend can handle gracefully
    );
  }
}
