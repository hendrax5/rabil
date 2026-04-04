import { PrismaClient, AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PERMISSIONS, ROLE_TEMPLATES } from './permissions';

const prisma = new PrismaClient();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-this-32';
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function generateStrongPassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 24; i++) {
        pass += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return pass;
}


/**
 * Complete seed file based on actual production database
 * Run with: npx prisma db seed
 */

// =============================================
// TRANSACTION CATEGORIES (Keuangan)
// =============================================
const transactionCategories = [
  // INCOME
  { id: 'cat-income-pppoe', name: 'Pembayaran PPPoE', type: 'INCOME', description: 'Pendapatan dari pembayaran pelanggan PPPoE bulanan' },
  { id: 'cat-income-hotspot', name: 'Pembayaran Hotspot', type: 'INCOME', description: 'Pendapatan dari penjualan voucher hotspot' },
  { id: 'cat-income-instalasi', name: 'Biaya Instalasi', type: 'INCOME', description: 'Pendapatan dari biaya instalasi pelanggan baru' },
  { id: 'cat-income-lainnya', name: 'Pendapatan Lain-lain', type: 'INCOME', description: 'Pendapatan dari sumber lain' },
  // EXPENSE
  { id: 'cat-expense-bandwidth', name: 'Bandwidth & Upstream', type: 'EXPENSE', description: 'Biaya bandwidth dan koneksi upstream' },
  { id: 'cat-expense-gaji', name: 'Gaji Karyawan', type: 'EXPENSE', description: 'Biaya gaji dan upah karyawan' },
  { id: 'cat-expense-listrik', name: 'Listrik', type: 'EXPENSE', description: 'Biaya listrik untuk operasional' },
  { id: 'cat-expense-maintenance', name: 'Maintenance & Repair', type: 'EXPENSE', description: 'Biaya perawatan dan perbaikan perangkat' },
  { id: 'cat-expense-hardware', name: 'Peralatan & Hardware', type: 'EXPENSE', description: 'Pembelian peralatan dan hardware jaringan' },
  { id: 'cat-expense-sewa', name: 'Sewa Tempat', type: 'EXPENSE', description: 'Biaya sewa kantor atau tempat operasional' },
  { id: 'cat-expense-komisi', name: 'Komisi Agent', type: 'EXPENSE', description: 'Biaya komisi untuk agent voucher' },
  { id: 'cat-expense-marketing', name: 'Marketing & Promosi', type: 'EXPENSE', description: 'Biaya marketing, iklan, dan promosi' },
  { id: 'cat-expense-lainnya', name: 'Operasional Lainnya', type: 'EXPENSE', description: 'Biaya operasional lainnya' },
];

// =============================================
// HOTSPOT PROFILES (Sample)
// =============================================
const hotspotProfiles = [
  {
    id: 'profile-12jam',
    name: '12JAM',
    speed: '5M/5M',
    validityValue: 12,
    validityUnit: 'HOURS',
    costPrice: 2000,
    sellingPrice: 3000,
    resellerFee: 1000,
    sharedUsers: 1,
    groupProfile: 'VOUCHER_12JAM',
    agentAccess: true,
    eVoucherAccess: true,
    isActive: true,
  },
  {
    id: 'profile-1hari',
    name: '1 HARI',
    speed: '5M/5M',
    validityValue: 1,
    validityUnit: 'DAYS',
    costPrice: 3000,
    sellingPrice: 5000,
    resellerFee: 1500,
    sharedUsers: 1,
    groupProfile: 'VOUCHER_1HARI',
    agentAccess: true,
    eVoucherAccess: true,
    isActive: true,
  },
  {
    id: 'profile-3hari',
    name: '3 HARI',
    speed: '10M/10M',
    validityValue: 3,
    validityUnit: 'DAYS',
    costPrice: 7000,
    sellingPrice: 10000,
    resellerFee: 2000,
    sharedUsers: 1,
    groupProfile: 'VOUCHER_3HARI',
    agentAccess: true,
    eVoucherAccess: true,
    isActive: true,
  },
  {
    id: 'profile-7hari',
    name: '7 HARI',
    speed: '10M/10M',
    validityValue: 7,
    validityUnit: 'DAYS',
    costPrice: 15000,
    sellingPrice: 20000,
    resellerFee: 3000,
    sharedUsers: 1,
    groupProfile: 'VOUCHER_7HARI',
    agentAccess: true,
    eVoucherAccess: true,
    isActive: true,
  },
  {
    id: 'profile-30hari',
    name: '30 HARI',
    speed: '15M/15M',
    validityValue: 30,
    validityUnit: 'DAYS',
    costPrice: 50000,
    sellingPrice: 75000,
    resellerFee: 10000,
    sharedUsers: 1,
    groupProfile: 'VOUCHER_30HARI',
    agentAccess: true,
    eVoucherAccess: true,
    isActive: true,
  },
];

// =============================================
// ADMIN USER (Default Super Admin)
// =============================================
const adminUser = {
  id: 'admin-superadmin',
  username: 'superadmin',
  email: 'admin@example.com',
  password: 'admin123', // Will be hashed
  name: 'Super Administrator',
  role: 'SUPER_ADMIN',
  isActive: true,
};

// =============================================
// WHATSAPP TEMPLATES
// =============================================
const whatsappTemplates = [
  {
    type: 'registration-approval',
    name: 'Persetujuan Pendaftaran',
    message: `Halo {{customerName}},

Pendaftaran Anda telah disetujui!

*Detail Akun:*
Username: {{username}}
Password: {{password}}
Paket: {{profileName}}
Biaya Instalasi: {{installationFee}}

Silakan lakukan pembayaran instalasi untuk aktivasi.

Terima kasih,
{{companyName}}
{{companyPhone}}`,
  },
  {
    type: 'installation-invoice',
    name: 'Invoice Instalasi',
    message: `Halo {{customerName}},

Berikut invoice instalasi Anda:

*Detail Invoice:*
No. Invoice: {{invoiceNumber}}
Jumlah: {{amount}}
Jatuh Tempo: {{dueDate}}

Link Pembayaran:
{{paymentLink}}

Terima kasih,
{{companyName}}
{{companyPhone}}`,
  },
  {
    type: 'admin-create-user',
    name: 'Admin Create User Manual',
    message: `Halo {{customerName}},

Akun internet Anda telah dibuat!

*Detail Akun:*
Username: {{username}}
Password: {{password}}
Paket: {{profileName}}

Silakan gunakan kredensial di atas untuk login.

Terima kasih,
{{companyName}}
{{companyPhone}}`,
  },
  {
    type: 'invoice-reminder',
    name: 'Invoice Bulanan / Jatuh Tempo',
    message: `Halo {{customerName}},

Tagihan internet Anda akan jatuh tempo.

*Detail Invoice:*
Username: {{username}}
No. Invoice: {{invoiceNumber}}
Jumlah: {{amount}}
Jatuh Tempo: {{dueDate}}
Sisa Waktu: {{daysRemaining}} hari

Link Pembayaran:
{{paymentLink}}

Terima kasih,
{{companyName}}
{{companyPhone}}`,
  },
  {
    type: 'payment-success',
    name: 'Pembayaran Berhasil',
    message: `Halo {{customerName}},

Pembayaran Anda telah berhasil!

*Detail Pembayaran:*
No. Invoice: {{invoiceNumber}}
Jumlah: {{amount}}

*Akun Aktif:*
Username: {{username}}
Password: {{password}}
Paket: {{profileName}}

Akun Anda sekarang aktif. Terima kasih!

{{companyName}}
{{companyPhone}}`,
  },
  {
    type: 'voucher-purchase-success',
    name: 'E-Voucher Purchase Success',
    message: `Halo {{customerName}},

Terima kasih telah membeli E-Voucher!

*Detail Pesanan*
Nomor Order: {{orderNumber}}
Paket: {{profileName}}
Jumlah: {{quantity}} voucher
Masa Berlaku: {{validity}}

*Kode Voucher Anda:*
{{voucherCodes}}

Simpan kode voucher ini dengan baik. Gunakan kode ini untuk login ke hotspot.

Terima kasih,
{{companyName}}
{{companyPhone}}`,
  },
];

// =============================================
// PERMISSIONS - Using imported from permissions.ts
// =============================================
// Permissions are imported from './permissions' for consistency

// =============================================
// MAIN SEED FUNCTION
// =============================================
export async function seedAll() {
  console.log('🌱 Starting complete database seed...\n');

  // 1. Seed Transaction Categories
  console.log('📊 Seeding Transaction Categories...');
  for (const cat of transactionCategories) {
    await prisma.transactionCategory.upsert({
      where: { id: cat.id },
      update: { name: cat.name, type: cat.type as any, description: cat.description },
      create: { ...cat, type: cat.type as any, isActive: true },
    });
  }
  console.log(`   ✅ ${transactionCategories.length} categories seeded\n`);

  // 2. Seed Permissions
  console.log('🔐 Seeding Permissions...');
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { name: perm.name, category: perm.category, description: perm.description },
      create: {
        id: crypto.randomUUID(),
        key: perm.key,
        name: perm.name,
        category: perm.category,
        description: perm.description,
        isActive: true,
      },
    });
  }
  console.log(`   ✅ ${PERMISSIONS.length} permissions seeded\n`);

  // 2.5 Seed Role Permission Templates
  console.log('👥 Seeding Role Permission Templates...');
  for (const [role, permissionKeys] of Object.entries(ROLE_TEMPLATES)) {
    // Delete existing role permissions
    await prisma.rolePermission.deleteMany({
      where: { role: role as AdminRole },
    });

    // Create new role permissions
    let count = 0;
    for (const key of permissionKeys) {
      const permission = await prisma.permission.findUnique({
        where: { key },
      });

      if (permission) {
        await prisma.rolePermission.create({
          data: {
            id: crypto.randomUUID(),
            role: role as AdminRole,
            permissionId: permission.id,
          },
        });
        count++;
      }
    }
    console.log(`   ✅ Role ${role}: ${count} permissions`);
  }
  console.log('');

  // 3. Seed Admin User
  console.log('👤 Seeding Admin User...');
  const hashedPassword = await bcrypt.hash(adminUser.password, 10);
  const existingAdmin = await prisma.adminUser.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });
  
  if (!existingAdmin) {
    await prisma.adminUser.create({
      data: {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        password: hashedPassword,
        name: adminUser.name,
        role: adminUser.role as any,
        isActive: adminUser.isActive,
      },
    });
    console.log(`   ✅ Admin user created: ${adminUser.username} / ${adminUser.password}\n`);
  } else {
    console.log(`   ⊙ Admin user already exists: ${existingAdmin.username}\n`);
  }

  // 4. Seed Hotspot Profiles
  console.log('📶 Seeding Hotspot Profiles...');
  for (const profile of hotspotProfiles) {
    const existing = await prisma.hotspotProfile.findUnique({
      where: { name: profile.name },
    });
    
    if (!existing) {
      await prisma.hotspotProfile.create({
        data: {
          id: profile.id,
          name: profile.name,
          speed: profile.speed,
          validityValue: profile.validityValue,
          validityUnit: profile.validityUnit as any,
          costPrice: profile.costPrice,
          sellingPrice: profile.sellingPrice,
          resellerFee: profile.resellerFee,
          sharedUsers: profile.sharedUsers,
          groupProfile: profile.groupProfile,
          agentAccess: profile.agentAccess,
          eVoucherAccess: profile.eVoucherAccess,
          isActive: profile.isActive,
        },
      });
      console.log(`   ✅ Profile: ${profile.name}`);
    } else {
      console.log(`   ⊙ Profile exists: ${profile.name}`);
    }
  }
  console.log('');

  // 5. Seed WhatsApp Templates
  console.log('💬 Seeding WhatsApp Templates...');
  for (const template of whatsappTemplates) {
    await prisma.whatsapp_templates.upsert({
      where: { type: template.type },
      update: { name: template.name, message: template.message },
      create: {
        id: crypto.randomUUID(),
        type: template.type,
        name: template.name,
        message: template.message,
        isActive: true,
      },
    });
    console.log(`   ✅ Template: ${template.name}`);
  }
  console.log('');

  // 6. Setup RADIUS isolir group
  console.log('🔧 Setting up RADIUS isolir group...');
  await prisma.$executeRaw`DELETE FROM radgroupreply WHERE groupname = 'isolir'`;
  await prisma.$executeRaw`
    INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES
    ('isolir', 'Mikrotik-Group', ':=', 'isolir')
  `;
  console.log('   ✅ Isolir group configured\n');

  // 7. Auto-configure Built-in GenieACS
  console.log('📡 Provisioning built-in GenieACS connection...');
  const existingAcs = await prisma.genieacsSettings.findFirst({ where: { isActive: true } });
  if (!existingAcs) {
    const strongPassword = generateStrongPassword();
    await prisma.genieacsSettings.create({
      data: {
        id: "default-acs-config",
        host: "http://aibill-genieacs:7557",
        username: "admin",
        password: encrypt(strongPassword),
        isActive: true,
      }
    });
    console.log('   ✅ GenieACS auto-configured with secure 24-character password\n');
  } else {
    console.log('   ⊙ GenieACS config already exists\n');
  }

  console.log('🎉 Database seeding completed!\n');
  console.log('================================');
  console.log('Default Admin Login:');
  console.log(`  Username: ${adminUser.username}`);
  console.log(`  Password: ${adminUser.password}`);
  console.log('================================\n');
}

// Run if called directly
if (require.main === module) {
  seedAll()
    .catch((e) => {
      console.error('❌ Seeding error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
