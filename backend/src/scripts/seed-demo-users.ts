import { prisma } from '../lib/prisma.js';
import { RoleType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { HierarchyAssignmentService } from '../modules/auth/services/hierarchy-assignment.service.js';

export async function seedDemoAccounts() {
  console.log('--- Starting Demo Accounts Seeding ---');

  const org = await prisma.organisation.findFirst();
  const state = await prisma.state.findFirst();
  const zone = await prisma.zone.findFirst();
  const parl = await prisma.parliament.findFirst();
  const ac = await prisma.constituency.findFirst();
  const mandal = await prisma.mandal.findFirst();
  const village = await prisma.village.findFirst();
  const booth = await prisma.booth.findFirst();
  const vg = await prisma.voterGroup.findFirst();

  const passwordHash = await bcrypt.hash('Demo@123456', 10);

  const demoAccounts = [
    {
      role: RoleType.SUPER_ADMIN,
      email: 'superadmin@politicalconnect.in',
      mobile: '9848099999',
      name: 'Super Administrator',
      assign: { stateId: state?.id },
    },
    {
      role: RoleType.STATE_ADMIN,
      email: 'stateincharge@politicalconnect.in',
      mobile: '9848088888',
      name: 'Telangana State Incharge',
      assign: { stateId: state?.id },
    },
    {
      role: RoleType.ZONE_INCHARGE,
      email: 'zone@politicalconnect.in',
      mobile: '9848099998',
      name: 'Zone Coordinator',
      assign: { stateId: state?.id, zoneId: zone?.id },
    },
    {
      role: RoleType.PARLIAMENT_INCHARGE,
      email: 'mp@politicalconnect.in',
      mobile: '9848088887',
      name: 'Parliament Incharge',
      assign: { stateId: state?.id, zoneId: zone?.id, parliamentId: parl?.id },
    },
    {
      role: RoleType.CONSTITUENCY_INCHARGE,
      email: 'incharge@politicalconnect.in',
      mobile: '9848012345',
      name: 'Constituency Incharge',
      assign: { constituencyId: ac?.id },
    },
    {
      role: RoleType.MANDAL_INCHARGE,
      email: 'mandal@politicalconnect.in',
      mobile: '9848077777',
      name: 'Mandal President',
      assign: { constituencyId: ac?.id, mandalId: mandal?.id },
    },
    {
      role: RoleType.VILLAGE_INCHARGE,
      email: 'village@politicalconnect.in',
      mobile: '9848010001',
      name: 'Village Incharge',
      assign: { constituencyId: ac?.id, mandalId: mandal?.id, villageId: village?.id },
    },
    {
      role: RoleType.BOOTH_PRESIDENT,
      email: 'booth@politicalconnect.in',
      mobile: '9848010002',
      name: 'Booth President',
      assign: { constituencyId: ac?.id, mandalId: mandal?.id, villageId: village?.id, boothId: booth?.id },
    },
    {
      role: RoleType.POLLING_AGENT,
      email: 'agent@politicalconnect.in',
      mobile: '9848010004',
      name: 'Polling Agent',
      assign: { constituencyId: ac?.id, mandalId: mandal?.id, villageId: village?.id, boothId: booth?.id },
    },
    {
      role: RoleType.VOTER_100_INCHARGE,
      email: 'voter100@politicalconnect.in',
      mobile: '9848010003',
      name: '100 Voter Incharge',
      assign: { constituencyId: ac?.id, mandalId: mandal?.id, villageId: village?.id, boothId: booth?.id, voterGroupId: vg?.id },
    },
    {
      role: RoleType.VIEWER,
      email: 'viewer@politicalconnect.in',
      mobile: '9848010005',
      name: 'Observer / Viewer',
      assign: { constituencyId: ac?.id },
    },
  ];

  for (const acc of demoAccounts) {
    // 1. Check if user already exists by mobile or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: acc.email },
          { mobileNumber: acc.mobile },
        ],
      },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          email: acc.email,
          mobileNumber: acc.mobile,
          name: acc.name,
          role: acc.role,
          passwordHash,
          accountStatus: 'ACTIVE',
          isVerified: true,
          organisationId: org?.id || user.organisationId,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          organisationId: org?.id,
          userCode: `DEMO-${acc.role.slice(0, 3)}-${acc.mobile.slice(-4)}`,
          name: acc.name,
          email: acc.email,
          mobileNumber: acc.mobile,
          passwordHash,
          role: acc.role,
          accountStatus: 'ACTIVE',
          isVerified: true,
        },
      });
    }

    // 2. Ensure Hierarchy Assignment
    const existingAssign = await prisma.userHierarchyAssignment.findFirst({
      where: { userId: user.id },
    });

    const assignData: any = {
      userId: user.id,
      roleType: acc.role,
      isActive: true,
      ...acc.assign,
    };

    if (existingAssign) {
      await prisma.userHierarchyAssignment.update({
        where: { id: existingAssign.id },
        data: assignData,
      });
    } else {
      await prisma.userHierarchyAssignment.create({
        data: assignData,
      });
    }

    // 3. Resolve unit
    await HierarchyAssignmentService.resolveUnitAndAssignment(user, acc.role);

    console.log(`✅ Seeded demo account: ${acc.email} (${acc.role})`);
  }

  console.log('--- Finished Demo Accounts Seeding ---');
}

seedDemoAccounts()
  .catch((err) => {
    console.error('Failed to seed demo accounts:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
