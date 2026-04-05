import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

const ALLOWED_CONTAINERS = [
  'aibill-l2tp',
  'aibill-freeradius',
  'aibill-genieacs',
  'aibill-db',
  'aibill-vpn',
  'aibill-app',
];

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = ((session?.user as any)?.role || '').toUpperCase();
    if (!session || !['SUPERADMIN', 'ADMIN'].includes(userRole)) {
      return NextResponse.json({ 
        error: `Unauthorized (Role: ${userRole || 'NONE'})`, 
        sessionExists: !!session 
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const service = searchParams.get('service');
    const tail = searchParams.get('tail') || '200';

    if (!service || !ALLOWED_CONTAINERS.includes(service)) {
      return NextResponse.json({ error: 'Invalid service container name' }, { status: 400 });
    }

    // Ensure tail is a relatively safe number
    const tailNum = parseInt(tail, 10);
    const safeTail = isNaN(tailNum) || tailNum > 2000 ? 500 : tailNum;

    // Use docker logs command
    // We append 2>&1 to capture both stdout and stderr
    const command = `docker logs --tail ${safeTail} ${service} 2>&1`;
    
    try {
      const { stdout, stderr } = await execAsync(command);
      // Wait, docker logs puts output in both stdout and stderr. 
      // Because we redirected 2>&1, stdout has everything.
      return NextResponse.json({ 
        success: true, 
        logs: stdout || 'No logs found or container is silent.',
        timestamp: new Date().toISOString()
      });
    } catch (execError: any) {
      console.error('Docker logs execution error:', execError);
      
      // If docker is not accessible or container doesn't exist
      let errorMessage = execError.message || 'Error executing docker logs';
      if (errorMessage.includes('permission denied') && errorMessage.includes('docker.sock')) {
        errorMessage = 'Docker socket permission denied. Please ensure /var/run/docker.sock is mounted as read-only in docker-compose.yml.';
      } else if (errorMessage.includes('No such container')) {
        errorMessage = `Container ${service} is not running or does not exist.`;
      } else if (errorMessage.includes('docker: not found')) {
        errorMessage = 'Docker CLI is not installed in the app container. Please rebuild the container.';
      }

      return NextResponse.json({ 
        success: false, 
        error: errorMessage,
        logs: execError.stdout || execError.stderr || ''
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Logs API Error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
