import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  try {
    // Try systemctl first (for naked OS deployments)
    try {
      const { stdout } = await execAsync('systemctl status freeradius');
      const uptimeMatch = stdout.match(/Active: active \(running\) since (.+?); (.+?) ago/);
      const isActive = stdout.includes('Active: active (running)');
      let uptime = 'Unknown';
      
      if (uptimeMatch && uptimeMatch[2]) {
        uptime = uptimeMatch[2].trim();
      }
      return NextResponse.json({
        success: true,
        status: isActive ? 'running' : 'stopped',
        uptime: isActive ? uptime : 'N/A',
      });
    } catch (sysError) {
      // Fallback for Docker environment: check if freeradius host is pingable
      const { stdout } = await execAsync('ping -c 1 freeradius');
      const isActive = stdout.includes('1 packets received');
      return NextResponse.json({
        success: true,
        status: isActive ? 'running' : 'stopped',
        uptime: 'Managed by Docker',
      });
    }
  } catch (error: any) {
    console.error('RADIUS status check error:', error);
    return NextResponse.json({
      success: true,
      status: 'stopped',
      uptime: 'N/A',
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action !== 'restart') {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }
    
    // Restart FreeRADIUS service
    await execAsync('systemctl restart freeradius');
    
    // Wait a bit and check status
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { stdout } = await execAsync('systemctl status freeradius');
    const isActive = stdout.includes('Active: active (running)');
    
    if (isActive) {
      return NextResponse.json({
        success: true,
        message: 'FreeRADIUS restarted successfully',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Service failed to start' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('RADIUS restart error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
