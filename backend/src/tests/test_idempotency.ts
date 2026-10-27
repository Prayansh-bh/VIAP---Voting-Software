import { prisma } from '../lib/prisma.js';
import { ApplicationsService } from '../modules/applications/applications.service.js';

async function testIdempotency() {
  console.log('Testing import idempotency with 5 real rows from Kondapi...');
  const constituency = await prisma.constituency.findFirst({
    where: { constituencyNumber: 110 },
  });
  if (!constituency) throw new Error('Constituency 110 not found');

  const countBefore = await prisma.voter.count({ where: { constituencyId: constituency.id } });
  const boothsBefore = await prisma.booth.count({ where: { village: { mandal: { constituencyId: constituency.id } } } });
  const groupsBefore = await prisma.voterGroup.count({ where: { booth: { village: { mandal: { constituencyId: constituency.id } } } } });

  // Select 5 real sample voters
  const sampleVoters = await prisma.voter.findMany({
    where: { constituencyId: constituency.id },
    take: 5,
    include: {
      booth: {
        include: {
          village: {
            include: {
              mandal: true,
            },
          },
        },
      },
    },
  });

  const rows = sampleVoters.map((v) => ({
    'PART NO': v.booth?.boothNumber || '1',
    'NEW SERIAL NO': v.serialNumber,
    'EPIC ID NO': v.epicNumber,
    'VOTER NAME': v.name,
    'RELATION': 'FATHER',
    'RELATIVE NAME': v.fatherHusbandName || '',
    'AGE': v.age,
    'GENDER': v.gender,
    'ACTIVE/DELETE': v.voterStatus === 'SHIFTED' ? 'DELETE' : 'ACTIVE',
    'VILLAGE NAME': v.booth?.village?.name || 'VILLAGE',
    'POLLING STATION NAME': v.booth?.name || 'PS',
    'HOUSE NUMBER': v.houseNumber || '',
    'CONSTITUENCY': '110 KONDAPI (SC)',
    'MANDAL NAME': v.booth?.village?.mandal?.name || 'MARRIPUDI',
  }));

  const res = await ApplicationsService.importData('default', 'VOTER', rows, {
    importMode: 'REFRESH',
    targetConstituencyId: constituency.id,
    fileName: 'idempotency_test.xlsx',
  });

  const countAfter = await prisma.voter.count({ where: { constituencyId: constituency.id } });
  const boothsAfter = await prisma.booth.count({ where: { village: { mandal: { constituencyId: constituency.id } } } });
  const groupsAfter = await prisma.voterGroup.count({ where: { booth: { village: { mandal: { constituencyId: constituency.id } } } } });

  console.log('Idempotency Results:', {
    importSuccessCount: res.successCount,
    votersBefore: countBefore,
    votersAfter: countAfter,
    voterDelta: countAfter - countBefore,
    boothsBefore,
    boothsAfter,
    boothDelta: boothsAfter - boothsBefore,
    groupsBefore,
    groupsAfter,
    groupDelta: groupsAfter - groupsBefore,
    isIdempotent: countAfter === countBefore && boothsAfter === boothsBefore && groupsAfter === groupsBefore,
  });
}

testIdempotency()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
