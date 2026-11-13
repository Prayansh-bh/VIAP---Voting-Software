import 'dotenv/config';
import { prisma } from './src/lib/prisma.js';

async function listUsers() {
  const users = await prisma.user.findMany({
    select: { mobileNumber: true, name: true, role: true, accountStatus: true },
    take: 10,
  });
  console.log('Registered Users in DB:');
  console.table(users);
  await prisma.$disconnect();
}

listUsers();
