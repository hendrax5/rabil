import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    
    const logs = await prisma.provision_log.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        olt: {
          select: {
            name: true,
            ipAddress: true,
          }
        }
      }
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching provision logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch provision logs' },
      { status: 500 }
    );
  }
}
