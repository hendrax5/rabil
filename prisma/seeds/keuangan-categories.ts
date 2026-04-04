import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Transaction Categories for Keuangan module
 * These are exported for use in seed-all.ts
 */
export const TRANSACTION_CATEGORIES = [
  // INCOME Categories
  { id: 'cat-income-pppoe', name: 'Pembayaran PPPoE', type: 'INCOME', description: 'Pendapatan dari pembayaran pelanggan PPPoE bulanan' },
  { id: 'cat-income-hotspot', name: 'Pembayaran Hotspot', type: 'INCOME', description: 'Pendapatan dari penjualan voucher hotspot' },
  { id: 'cat-income-instalasi', name: 'Biaya Instalasi', type: 'INCOME', description: 'Pendapatan dari biaya instalasi pelanggan baru' },
  { id: 'cat-income-lainnya', name: 'Pendapatan Lain-lain', type: 'INCOME', description: 'Pendapatan dari sumber lain' },

  // EXPENSE Categories
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

/**
 * Seed Keuangan Categories
 * Can be run standalone: npx tsx prisma/seeds/keuangan-categories.ts
 */
export async function seedKeuanganCategories() {
  console.log('🌱 Seeding Keuangan Categories...');

  for (const category of TRANSACTION_CATEGORIES) {
    await prisma.transactionCategory.upsert({
      where: { id: category.id },
      update: { name: category.name, type: category.type as any, description: category.description },
      create: { ...category, type: category.type as any, isActive: true },
    });
    console.log(`  ✓ ${category.name}`);
  }

  console.log(`✅ ${TRANSACTION_CATEGORIES.length} categories seeded!\n`);
}

// Run if called directly
if (require.main === module) {
  seedKeuanganCategories()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
