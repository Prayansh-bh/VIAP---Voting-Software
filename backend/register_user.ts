import 'dotenv/config';
import { prisma } from './src/lib/prisma.js';

async function addIncharge() {
  const number = '9340423885';
  
  // Find or create organisation
  let org = await prisma.organisation.findFirst();
  
  const user = await prisma.user.upsert({
    where: { mobileNumber: number },
    update: {
      accountStatus: 'ACTIVE',
      role: 'CONSTITUENCY_INCHARGE',
    },
    create: {
      mobileNumber: number,
      name: 'Field Incharge',
      role: 'CONSTITUENCY_INCHARGE',
      accountStatus: 'ACTIVE',
      userCode: 'INC-9340423885',
      organisationId: org ? org.id : undefined,
    },
  });

  console.log('User registered successfully:', user);
  await prisma.$disconnect();
}

addIncharge().catch(console.error);
