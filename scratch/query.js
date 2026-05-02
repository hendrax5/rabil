process.env.DATABASE_URL = "mysql://root:root123@localhost:3306/aibill_radius?connection_limit=250&pool_timeout=40";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.pppoeUser.findMany({ 
    select: { id: true, username: true, syncedToRadius: true, status: true },
    orderBy: { createdAt: 'desc' }, 
    take: 2 
  });
  console.log('Users:', u);
  
  const r = await prisma.radcheck.findMany({ orderBy: { id: 'desc' }, take: 5 });
  console.log('Radcheck:', r);
}

main().finally(() => prisma.$disconnect());
