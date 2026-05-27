import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withOlt } from '@/lib/olt';

/**
 * POST /api/network/olts/[id]/exec
 * Execute a single command on the OLT via SSH/Telnet
 * Used by Web Terminal feature
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { command } = body;

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ success: false, error: 'Command is required' }, { status: 400 });
    }

    // Block destructive commands
    const blocked = ['no ', 'delete ', 'erase ', 'format ', 'reload', 'reboot'];
    const cmdLower = command.toLowerCase().trim();
    if (blocked.some(b => cmdLower.startsWith(b))) {
      return NextResponse.json({
        success: false,
        error: `Command "${command}" is blocked for safety. Only read-only commands are allowed via Web Terminal.`,
      }, { status: 403 });
    }

    const olt = await prisma.networkOLT.findUnique({ where: { id } });
    if (!olt) return NextResponse.json({ success: false, error: 'OLT not found' }, { status: 404 });
    if (!olt.username || !olt.password) {
      return NextResponse.json({ success: false, error: 'OLT credentials not configured' }, { status: 422 });
    }

    const result = await withOlt(
      {
        host: olt.ipAddress,
        port: olt.port || 22,
        username: olt.username,
        password: olt.password,
        protocol: (olt.connection as any) || 'ssh',
        vendor: (olt.vendor as any) || 'zte',
      },
      async (driver) => {
        await driver.exec('terminal length 0');
        return driver.exec(command);
      }
    );

    return NextResponse.json({
      success: result.success,
      output: result.output,
      error: result.errorMsg,
    });
  } catch (error: any) {
    console.error('[OLT Exec]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
