const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['info', 'query'] });

async function main() {
  const users = await prisma.pppoeUser.findMany({ select: { id: true, username: true }, take: 1 });
  console.log('Users:', users);
}
main().finally(() => prisma.$disconnect());
