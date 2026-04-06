import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        technician: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    return NextResponse.json(workOrder);
  } catch (error) {
    console.error('Failed to get work order:', error);
    return NextResponse.json(
      { error: 'Failed to get work order' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const existingWorkOrder = await prisma.workOrder.findUnique({
      where: { id },
    });

    if (!existingWorkOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {
      ...body,
    };

    // Keep completedAt if already completed, update if it changes to completed
    if (updateData.status === 'COMPLETED' && existingWorkOrder.status !== 'COMPLETED') {
        updateData.completedAt = new Date();
    } else if (updateData.status !== 'COMPLETED') {
        updateData.completedAt = null;
    }

    // Update assignment tracking
    if (updateData.technicianId && existingWorkOrder.technicianId !== updateData.technicianId) {
        // Technically newly assigned or reassigned
        updateData.assignedAt = new Date();
        if(!updateData.status || updateData.status === 'OPEN') {
           updateData.status = 'ASSIGNED';
        }
    } else if(updateData.technicianId === null) {
        updateData.assignedAt = null;
        if(!updateData.status || updateData.status === 'ASSIGNED') {
           updateData.status = 'OPEN';
        }
    }

    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id },
      data: updateData,
      include: {
        technician: true,
      },
    });

    return NextResponse.json(updatedWorkOrder);
  } catch (error) {
    console.error('Failed to update work order:', error);
    return NextResponse.json(
      { error: 'Failed to update work order' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.workOrder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete work order:', error);
    return NextResponse.json(
      { error: 'Failed to delete work order' },
      { status: 500 }
    );
  }
}
