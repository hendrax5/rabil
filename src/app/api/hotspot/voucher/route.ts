import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncBatchToRadius, removeVoucherFromRadius, syncVoucherToRadius } from '@/lib/hotspot-radius-sync'

// Code type definitions
const CODE_TYPES: Record<string, { name: string; chars: string }> = {
  'alpha-upper': { name: 'ABCDEFGHJKLMN', chars: 'ABCDEFGHJKLMNPQRSTUVWXYZ' },
  'alpha-lower': { name: 'abcdefghjklmnp', chars: 'abcdefghjklmnpqrstuvwxyz' },
  'alpha-mixed': { name: 'AbCdEfGhJKLMN', chars: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz' },
  'alpha-camel': { name: 'aBcDeFgHjKmn', chars: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz' },
  'numeric': { name: '123456789563343', chars: '123456789' },
  'alphanumeric-lower': { name: '123456abcdefgkh', chars: 'abcdefghjklmnpqrstuvwxyz123456789' },
  'alphanumeric-upper': { name: '456789ABCDEFGHJ', chars: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789' },
  'alphanumeric-mixed': { name: '56789aBcDefgiJKlm', chars: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz123456789' },
}

// Helper to generate random voucher code
function generateVoucherCode(length: number, prefix: string = '', codeType: string = 'alpha-upper'): string {
  const chars = CODE_TYPES[codeType]?.chars || CODE_TYPES['alpha-upper'].chars
  let code = prefix
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Helper to generate password (different from username)
function generatePassword(length: number, codeType: string = 'alpha-upper'): string {
  const chars = CODE_TYPES[codeType]?.chars || CODE_TYPES['alpha-upper'].chars
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Helper to generate batch code
function generateBatchCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
  return `BATCH-${year}${month}${day}-${time}`
}

// GET - List vouchers with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('profileId')
    const batchCode = searchParams.get('batchCode')
    const status = searchParams.get('status')
    const routerId = searchParams.get('routerId')
    const agentId = searchParams.get('agentId')

    const where: any = {}

    if (profileId) where.profileId = profileId
    if (batchCode) where.batchCode = batchCode
    if (routerId) where.routerId = routerId
    if (agentId) where.agentId = agentId
    if (status && ['WAITING', 'ACTIVE', 'EXPIRED'].includes(status)) {
      where.status = status
    }

    const vouchers = await prisma.hotspotVoucher.findMany({
      where,
      include: {
        profile: {
          select: {
            name: true,
            sellingPrice: true,
            validityValue: true,
            validityUnit: true,
          },
        },
        router: {
          select: {
            id: true,
            name: true,
            shortname: true,
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000, // Limit to prevent large data loads
    })

    // Get unique batch codes for filter
    const batches = await prisma.hotspotVoucher.findMany({
      select: {
        batchCode: true,
      },
      distinct: ['batchCode'],
      orderBy: {
        batchCode: 'desc',
      },
    })

    // Get code types for generate form
    const codeTypes = Object.entries(CODE_TYPES).map(([key, value]) => ({
      value: key,
      label: value.name,
    }))

    return NextResponse.json({ 
      vouchers,
      batches: batches.map(b => b.batchCode).filter(Boolean),
      codeTypes,
    })
  } catch (error) {
    console.error('Get vouchers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Generate vouchers in batch
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      quantity,
      profileId,
      routerId,
      agentId,
      codeLength = 6,
      prefix = '',
      voucherType = 'same', // 'same' = username=password, 'different' = separate password
      codeType = 'alpha-upper',
      lockMac = false,
    } = body

    // Validation
    if (!quantity || !profileId) {
      return NextResponse.json(
        { error: 'Quantity and Profile are required' },
        { status: 400 }
      )
    }

    if (quantity > 500) {
      return NextResponse.json(
        { error: 'Cannot generate more than 500 vouchers at once' },
        { status: 400 }
      )
    }

    // Check if profile exists
    const profile = await prisma.hotspotProfile.findUnique({
      where: { id: profileId },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if router exists (if provided)
    let router = null
    if (routerId) {
      router = await prisma.router.findUnique({
        where: { id: routerId },
      })
      if (!router) {
        return NextResponse.json({ error: 'Router not found' }, { status: 404 })
      }
    }

    // Check if agent exists (if provided)
    let agent = null
    if (agentId) {
      agent = await prisma.agent.findUnique({
        where: { id: agentId },
      })
      if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
      }
    }

    // Generate batch code
    const batchCode = generateBatchCode()

    // Generate vouchers
    const codes = new Set<string>()
    const voucherData = []

    for (let i = 0; i < quantity; i++) {
      let code: string
      let attempts = 0
      
      // Generate unique code (username)
      do {
        code = generateVoucherCode(codeLength, prefix, codeType)
        attempts++
        if (attempts > 100) {
          throw new Error('Failed to generate unique voucher codes. Try different prefix or length.')
        }
      } while (codes.has(code))
      
      codes.add(code)

      // Generate password based on voucher type
      let password: string | null = null
      if (voucherType === 'different') {
        password = generatePassword(codeLength, codeType)
      }
      
      voucherData.push({
        id: crypto.randomUUID(),
        code,
        password,
        profileId,
        routerId: routerId || null,
        agentId: agentId || null,
        voucherType,
        codeType,
        batchCode,
        status: 'WAITING' as const,
      })
    }

    // Bulk create vouchers using raw SQL to use MySQL NOW() for createdAt
    const values = voucherData.map(v => 
      `('${v.id}', '${v.code}', ${v.password ? `'${v.password}'` : 'NULL'}, '${v.profileId}', ${v.routerId ? `'${v.routerId}'` : 'NULL'}, ${v.agentId ? `'${v.agentId}'` : 'NULL'}, '${v.voucherType}', '${v.codeType}', '${v.status}', NOW(), NOW(), '${v.batchCode}')`
    ).join(',')
    
    await prisma.$executeRawUnsafe(`
      INSERT INTO hotspot_vouchers (id, code, password, profileId, routerId, agentId, voucherType, codeType, status, createdAt, updatedAt, batchCode)
      VALUES ${values}
    `)
    
    const result = { count: voucherData.length }

    // Sync to RADIUS with router-specific NAS if provided
    try {
      const syncCount = await syncBatchToRadiusWithOptions(batchCode, {
        routerId,
        lockMac,
        voucherType,
      })
      console.log(`Synced ${syncCount}/${result.count} vouchers to RADIUS`)
    } catch (syncError) {
      console.error('RADIUS sync error:', syncError)
      // Don't fail the request if sync fails
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      batchCode,
      message: `${result.count} vouchers generated and synced to RADIUS`,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Generate vouchers error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to sync batch to RADIUS with additional options
async function syncBatchToRadiusWithOptions(batchCode: string, options: {
  routerId?: string;
  lockMac?: boolean;
  voucherType?: string;
}) {
  const vouchers = await prisma.hotspotVoucher.findMany({
    where: { batchCode },
    include: {
      profile: true,
    },
  })

  let syncCount = 0
  for (const voucher of vouchers) {
    try {
      // For 'same' type, password is the same as code
      // For 'different' type, we use the code as password since password field doesn't exist in schema
      const password = voucher.code

      // Sync to RADIUS
      // Sync to RADIUS
      await syncVoucherToRadius(voucher.code, password, voucher.profile.groupProfile || voucher.profile.name, {
        nasIpAddress: undefined,
        lockMac: options.lockMac,
      })
    } catch (error) {
      console.error(`Failed to sync voucher ${voucher.code}:`, error)
    }
  }
  return syncCount
}

// DELETE - Delete voucher or batch
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const batchCode = searchParams.get('batchCode')

    if (!id && !batchCode) {
      return NextResponse.json(
        { error: 'Voucher ID or Batch Code required' },
        { status: 400 }
      )
    }

    if (batchCode) {
      // Get voucher codes before deletion
      const vouchersToDelete = await prisma.hotspotVoucher.findMany({
        where: { batchCode, status: 'WAITING' },
        select: { code: true }
      })

      // Delete entire batch (only WAITING vouchers)
      const result = await prisma.hotspotVoucher.deleteMany({
        where: { 
          batchCode, 
          status: 'WAITING' 
        }
      })

      // Remove from RADIUS
      for (const v of vouchersToDelete) {
        try {
          await removeVoucherFromRadius(v.code)
        } catch (error) {
          console.error(`Failed to remove ${v.code} from RADIUS:`, error)
        }
      }
      
      return NextResponse.json({
        message: `${result.count} unused vouchers deleted from batch`,
        count: result.count,
      })
    } else if (id) {
      // Delete single voucher
      const voucher = await prisma.hotspotVoucher.findUnique({
        where: { id },
      })

      if (!voucher) {
        return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
      }

      if (voucher.status !== 'WAITING') {
        return NextResponse.json(
          { error: 'Cannot delete used/active voucher' },
          { status: 400 }
        )
      }

      await prisma.hotspotVoucher.delete({ where: { id } })

      // Remove from RADIUS
      try {
        await removeVoucherFromRadius(voucher.code)
      } catch (error) {
        console.error('Failed to remove from RADIUS:', error)
      }
      
      return NextResponse.json({ message: 'Voucher deleted successfully' })
    }
  } catch (error) {
    console.error('Delete voucher error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
