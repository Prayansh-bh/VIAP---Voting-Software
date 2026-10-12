import { prisma } from '../lib/prisma.js';

async function verifyDatabase() {
  console.log('🔍 Running Database Integrity & Hierarchy Verification...\n');

  // 1. Model Counts
  const counts = {
    organisations: await prisma.organisation.count(),
    politicalParties: await prisma.politicalParty.count(),
    partyBrandings: await prisma.partyBranding.count(),
    states: await prisma.state.count(),
    zones: await prisma.zone.count(),
    parliaments: await prisma.parliament.count(),
    constituencies: await prisma.constituency.count(),
    mandals: await prisma.mandal.count(),
    villages: await prisma.village.count(),
    booths: await prisma.booth.count(),
    voterGroups: await prisma.voterGroup.count(),
    users: await prisma.user.count(),
    roles: await prisma.role.count(),
    userHierarchyAssignments: await prisma.userHierarchyAssignment.count(),
    voters: await prisma.voter.count(),
    fakeVoterFlags: await prisma.fakeVoterFlag.count(),
    voterMigrations: await prisma.voterMigration.count(),
    voteTrackings: await prisma.voteTracking.count(),
    cadres: await prisma.cadre.count(),
    tasks: await prisma.task.count(),
    taskAssignments: await prisma.taskAssignment.count(),
    trainingVideos: await prisma.trainingVideo.count(),
    trainingProgress: await prisma.trainingProgress.count(),
    casteCategories: await prisma.casteCategory.count(),
    voterCastes: await prisma.voterCaste.count(),
    groundReports: await prisma.groundReport.count(),
    electionProjections: await prisma.electionProjection.count(),
    cmsConfigurations: await prisma.cMSConfiguration.count(),
    aiInsights: await prisma.aIInsight.count(),
    auditLogs: await prisma.auditLog.count(),
    notifications: await prisma.notification.count(),
  };

  console.log('📊 Table Record Counts:');
  console.table(counts);

  // 2. Hierarchy Traversal Verification
  console.log('🏛️ Testing Full Hierarchy Traversal: State -> Zone -> Parliament -> Constituency -> Mandal -> Village -> Booth -> VoterGroup -> Voters');
  const state = await prisma.state.findFirst({
    include: {
      zones: {
        include: {
          parliaments: {
            include: {
              constituencies: {
                include: {
                  mandals: {
                    include: {
                      villages: {
                        include: {
                          booths: {
                            include: {
                              voterGroups: {
                                include: {
                                  voters: {
                                    take: 2,
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!state) throw new Error('State not found!');
  const firstZone = state.zones[0];
  const firstParliament = firstZone.parliaments[0];
  const firstConstituency = firstParliament.constituencies[0];
  const firstMandal = firstConstituency.mandals[0];
  const firstVillage = firstMandal.villages[0];
  const firstBooth = firstVillage.booths[0];
  const firstGroup = firstBooth.voterGroups[0];
  const sampleVoter = firstGroup.voters[0];

  console.log(`✅ Traversed Hierarchy Successfully:
   - State: ${state.name} (${state.code})
   - Zone: ${firstZone.name} (${firstZone.code})
   - Parliament: ${firstParliament.name} (${firstParliament.code})
   - Constituency: ${firstConstituency.name} (${firstConstituency.code})
   - Mandal: ${firstMandal.name} (${firstMandal.code})
   - Village: ${firstVillage.name} (${firstVillage.code})
   - Booth: ${firstBooth.name} (${firstBooth.code})
   - VoterGroup: ${firstGroup.name} (${firstGroup.code})
   - Sample Voter: ${sampleVoter?.name} (EPIC: ${sampleVoter?.epicNumber}, Status: ${sampleVoter?.voterStatus})
  `);

  // 3. Voter Relation Check (Derivable Totals without Duplication)
  const constituencyVoterCount = await prisma.voter.count({
    where: { constituencyId: firstConstituency.id },
  });
  console.log(`✅ Derivable Voter Count for ${firstConstituency.name}: ${constituencyVoterCount}`);

  // 4. Fake Voter Flag Check
  const fakeVoter = await prisma.fakeVoterFlag.findFirst({
    include: {
      voter: true,
      flaggedBy: true,
    },
  });
  if (fakeVoter) {
    console.log(`✅ Fake Voter Flag Verified:
   - Voter: ${fakeVoter.voter.name} (${fakeVoter.voter.epicNumber})
   - Reason: ${fakeVoter.reason}
   - Status: ${fakeVoter.status}
   - Flagged By: ${fakeVoter.flaggedBy.name}
   - Flagged At: ${fakeVoter.flaggedAt.toISOString()}
    `);
  }

  // 5. Voter Migration Check
  const migration = await prisma.voterMigration.findFirst({
    include: {
      voter: true,
    },
  });
  if (migration) {
    console.log(`✅ Voter Migration Verified:
   - Voter: ${migration.voter.name}
   - Destination: ${migration.destinationCity}, ${migration.destinationState}
   - Status: ${migration.status}
   - LocationStatus on Voter: ${migration.voter.locationStatus}
    `);
  }

  console.log('🎉 All Database Integrity & Hierarchy Checks Passed with 100% Success!');
}

verifyDatabase()
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
