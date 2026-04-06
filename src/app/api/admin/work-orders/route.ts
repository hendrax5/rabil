import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createWorkOrderSchema = z.object({
  technicianId: z.string().optional().nullable(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().min(1, 'Customer phone is required'),
  customerAddress: z.string().min(1, 'Customer address is required'),
  issueType: z.string().min(1, 'Issue type is required'),
  description: z.string().min(1, 'Description is required'),
  priority: z.string().optional(),
  status: z.string().optional(),
  scheduledDate: z.string().optional().nullable(),
  estimatedHours: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';
    const technicianId = searchParams.get('technicianId') || '';

    const where: any = {};

    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (technicianId) {
      // If filtering for unassigned
      if (technicianId === 'unassigned') {
        where.technicianId = null;
      } else {
        where.technicianId = technicianId;
      }
    }

    const workOrders = await prisma.workOrder.findMany({
      where,
      include: {
        technician: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(workOrders);
  } catch (error) {
    console.error('Failed to fetch work orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch work orders' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createWorkOrderSchema.parse(body);

    // Initial status determined by whether it's assigned to a technician immediately
    const initialStatus = validatedData.status || (validatedData.technicianId ? 'ASSIGNED' : 'OPEN');
    const assignedDate = validatedData.technicianId ? new Date() : null;

    const newWorkOrder = await prisma.workOrder.create({
      data: {
        technicianId: validatedData.technicianId || null,
        customerName: validatedData.customerName,
        customerPhone: validatedData.customerPhone,
        customerAddress: validatedData.customerAddress,
        issueType: validatedData.issueType,
        description: validatedData.description,
        priority: validatedData.priority || 'MEDIUM',
        status: initialStatus,
        scheduledDate: validatedData.scheduledDate ? new Date(validatedData.scheduledDate) : null,
        estimatedHours: validatedData.estimatedHours || null,
        notes: validatedData.notes || null,
        assignedAt: assignedDate,
      },
      include: {
        technician: true,
      },
    });

    // TODO: Send WhatsApp notification to the assigned technician if integrated

    return NextResponse.json(newWorkOrder, { status: 201 });
  } catch (error) {
    console.error('Failed to create work order:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.format() },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create work order' },
      { status: 500 }
    );
  }
}
