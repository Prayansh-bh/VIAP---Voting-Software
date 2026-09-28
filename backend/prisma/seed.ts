/**
 * Telangana Congress Connect — Full Data Seed Script
 * Seeds: State (Telangana) -> 5 Zones -> 17 Parliament Seats -> Constituencies -> Mandals -> Villages -> Booths -> VoterGroups
 * Party: Indian National Congress (INC/TPCC)
 */
import { PrismaClient, RoleType, Gender, VoterStatus, SurveyStatus, VoterLocationStatus, TaskPriority, TaskStatus, OrgHierarchyLevel, GroundReportType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Telangana Congress Connect full data seed...\n');

  // ─── 1. ORGANISATION ──────────────────────────────────────────────────────
  let org = await prisma.organisation.findFirst({ where: { code: 'TPCC-ORG' } });
  if (!org) {
    org = await prisma.organisation.create({
      data: {
        name: 'Telangana Pradesh Congress Committee (TPCC)',
        code: 'TPCC-ORG',
        description: 'Integrated Voter Management & Command Center for Telangana Congress (INC)',
        website: 'https://telangana-congress.in',
        isActive: true,
      },
    });
    console.log('✅ Organisation created:', org.name);
  } else {
    console.log('ℹ️  Organisation exists:', org.name);
  }

  // ─── 2. CMS CONFIG ────────────────────────────────────────────────────────
  await prisma.cMSConfiguration.upsert({
    where: { configKey: 'default' },
    update: {
      organisationName: 'Telangana Congress Connect',
      stateName: 'Telangana',
    },
    create: {
      organisationId: org.id,
      configKey: 'default',
      organisationName: 'Telangana Congress Connect',
      stateName: 'Telangana',
      defaultLanguage: 'te-IN',
      hierarchyLabels: {
        STATE: 'State Incharge',
        ZONE: 'Zone Coordinator',
        PARLIAMENT: 'Parliament Incharge',
        CONSTITUENCY: 'Constituency Incharge',
        MANDAL: 'Mandal President',
        VILLAGE: 'Village Incharge',
        BOOTH: 'Booth President',
        VOTER_GROUP: '100 Voters Incharge',
      },
      featureToggles: {
        voterManagement: true,
        fakeVoterFlagging: true,
        migrationTracking: true,
        liveVoteTracking: true,
        casteAnalytics: true,
        cadreNetwork: true,
        training: true,
        tasks: true,
        groundReports: true,
        aiStrategicIntelligence: true,
        electionProjection: true,
      },
      headerTitle: 'Telangana Congress Connect',
      slogan: 'Praja Palana — Congress Ki Guarantee for Telangana',
      primaryColor: '#FF6600',
      secondaryColor: '#138808',
      accentColor: '#0038A8',
      activePartyCode: 'INC',
      appScope: 'STATE',
      activeHierarchyLevels: ['VOTER_GROUP', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY', 'PARLIAMENT', 'ZONE', 'STATE'],
      aiEnabled: true,
    },
  });
  console.log('✅ CMS Config ready');

  // ─── 3. POLITICAL PARTIES ────────────────────────────────────────────────
  const parties = [
    { code: 'INC', name: 'Indian National Congress', shortName: 'INC', symbolName: 'Hand', primaryColor: '#FF6600', secondaryColor: '#138808', accentColor: '#0038A8', sortOrder: 1 },
    { code: 'BRS', name: 'Bharat Rashtra Samithi', shortName: 'BRS', symbolName: 'Car', primaryColor: '#ec4899', secondaryColor: '#831843', accentColor: '#6366f1', sortOrder: 2 },
    { code: 'BJP', name: 'Bharatiya Janata Party', shortName: 'BJP', symbolName: 'Lotus', primaryColor: '#f97316', secondaryColor: '#1e293b', accentColor: '#3b82f6', sortOrder: 3 },
    { code: 'AIMIM', name: 'All India Majlis-E-Ittehadul Muslimeen', shortName: 'AIMIM', symbolName: 'Kite', primaryColor: '#15803d', secondaryColor: '#1e293b', accentColor: '#3b82f6', sortOrder: 4 },
    { code: 'TDP', name: 'Telugu Desam Party', shortName: 'TDP', symbolName: 'Bicycle', primaryColor: '#eab308', secondaryColor: '#1e293b', accentColor: '#3b82f6', sortOrder: 5 },
    { code: 'CPI', name: 'Communist Party of India', shortName: 'CPI', symbolName: 'Ears of Corn', primaryColor: '#dc2626', secondaryColor: '#1e293b', accentColor: '#3b82f6', sortOrder: 6 },
    { code: 'NEUTRAL', name: 'Neutral / Undecided', shortName: 'Neutral', symbolName: 'Scale', primaryColor: '#64748b', secondaryColor: '#1e293b', accentColor: '#3b82f6', sortOrder: 7 },
    { code: 'OTH', name: 'Other Parties / Independents', shortName: 'OTH', symbolName: 'Star', primaryColor: '#a855f7', secondaryColor: '#1e293b', accentColor: '#3b82f6', sortOrder: 8 },
  ];
  for (const party of parties) {
    await prisma.politicalParty.upsert({
      where: { code: party.code },
      update: { primaryColor: party.primaryColor, secondaryColor: party.secondaryColor },
      create: { ...party, organisationId: org.id, isActive: true },
    });
  }
  console.log('✅ Political Parties seeded (8)');

  // ─── 4. TELANGANA STATE ────────────────────────────────────────────────────
  let state = await prisma.state.findFirst({ where: { code: 'TS' } });
  if (!state) {
    state = await prisma.state.create({
      data: { name: 'Telangana', code: 'TS', organisationId: org.id, totalVoters: 33517327 },
    });
    console.log('✅ State created: Telangana');
  } else { console.log('ℹ️  State exists:', state.name); }

  // ─── 5. ZONES (5 zones of Telangana) ──────────────────────────────────────
  const zonesData = [
    { name: 'Hyderabad Zone', code: 'TS-HYD-ZONE', headquarters: 'Hyderabad' },
    { name: 'Warangal Zone', code: 'TS-WGL-ZONE', headquarters: 'Warangal' },
    { name: 'Karimnagar Zone', code: 'TS-KMR-ZONE', headquarters: 'Karimnagar' },
    { name: 'Nalgonda Zone', code: 'TS-NLG-ZONE', headquarters: 'Nalgonda' },
    { name: 'Adilabad Zone', code: 'TS-ADB-ZONE', headquarters: 'Adilabad' },
  ];
  const zoneMap: Record<string, any> = {};
  for (const z of zonesData) {
    let zone = await prisma.zone.findFirst({ where: { code: z.code } });
    if (!zone) {
      zone = await prisma.zone.create({
        data: { name: z.name, code: z.code, stateId: state.id, headquarters: z.headquarters, totalVoters: Math.floor(Math.random() * 7000000) + 5000000 },
      });
    }
    zoneMap[z.code] = zone;
  }
  console.log('✅ Zones seeded (5)');

  // ─── 6. PARLIAMENT SEATS (17 of Telangana) ────────────────────────────────
  const parliamentData = [
    { name: 'Adilabad Parliament', code: 'TS-LS-01', zoneCode: 'TS-ADB-ZONE', number: 1 },
    { name: 'Peddapalle Parliament', code: 'TS-LS-02', zoneCode: 'TS-KMR-ZONE', number: 2 },
    { name: 'Karimnagar Parliament', code: 'TS-LS-03', zoneCode: 'TS-KMR-ZONE', number: 3 },
    { name: 'Nizamabad Parliament', code: 'TS-LS-04', zoneCode: 'TS-KMR-ZONE', number: 4 },
    { name: 'Zaheerabad Parliament', code: 'TS-LS-05', zoneCode: 'TS-HYD-ZONE', number: 5 },
    { name: 'Medak Parliament', code: 'TS-LS-06', zoneCode: 'TS-HYD-ZONE', number: 6 },
    { name: 'Malkajgiri Parliament', code: 'TS-LS-07', zoneCode: 'TS-HYD-ZONE', number: 7 },
    { name: 'Secunderabad Parliament', code: 'TS-LS-08', zoneCode: 'TS-HYD-ZONE', number: 8 },
    { name: 'Hyderabad Parliament', code: 'TS-LS-09', zoneCode: 'TS-HYD-ZONE', number: 9 },
    { name: 'Chevella Parliament', code: 'TS-LS-10', zoneCode: 'TS-NLG-ZONE', number: 10 },
    { name: 'Mahbubnagar Parliament', code: 'TS-LS-11', zoneCode: 'TS-NLG-ZONE', number: 11 },
    { name: 'Nagarkurnool Parliament', code: 'TS-LS-12', zoneCode: 'TS-NLG-ZONE', number: 12 },
    { name: 'Nalgonda Parliament', code: 'TS-LS-13', zoneCode: 'TS-NLG-ZONE', number: 13 },
    { name: 'Bhongir Parliament', code: 'TS-LS-14', zoneCode: 'TS-NLG-ZONE', number: 14 },
    { name: 'Warangal Parliament', code: 'TS-LS-15', zoneCode: 'TS-WGL-ZONE', number: 15 },
    { name: 'Mahabubabad Parliament', code: 'TS-LS-16', zoneCode: 'TS-WGL-ZONE', number: 16 },
    { name: 'Khammam Parliament', code: 'TS-LS-17', zoneCode: 'TS-WGL-ZONE', number: 17 },
  ];
  const parliamentMap: Record<string, any> = {};
  for (const p of parliamentData) {
    let parliament = await prisma.parliament.findFirst({ where: { code: p.code } });
    if (!parliament) {
      parliament = await prisma.parliament.create({
        data: { name: p.name, code: p.code, parliamentNumber: p.number, zoneId: zoneMap[p.zoneCode].id, totalVoters: Math.floor(Math.random() * 2000000) + 1000000 },
      });
    }
    parliamentMap[p.code] = parliament;
  }
  console.log('✅ Parliament seats seeded (17)');

  // ─── 7. KEY CONSTITUENCIES (subset for detailed data) ─────────────────────
  const constituenciesData = [
    // Hyderabad Parliament
    { name: 'Secunderabad Cantonment', code: 'TS-AC-70', number: 70, parliamentCode: 'TS-LS-08', voters: 265000 },
    { name: 'Secunderabad', code: 'TS-AC-71', number: 71, parliamentCode: 'TS-LS-08', voters: 258000 },
    // Nalgonda Parliament
    { name: 'Nalgonda', code: 'TS-AC-92', number: 92, parliamentCode: 'TS-LS-13', voters: 220000 },
    { name: 'Munugode', code: 'TS-AC-91', number: 91, parliamentCode: 'TS-LS-13', voters: 215000 },
    // Karimnagar Parliament
    { name: 'Karimnagar', code: 'TS-AC-26', number: 26, parliamentCode: 'TS-LS-03', voters: 260000 },
    { name: 'Choppadandi', code: 'TS-AC-25', number: 25, parliamentCode: 'TS-LS-03', voters: 230000 },
    // Warangal Parliament
    { name: 'Warangal West', code: 'TS-AC-105', number: 105, parliamentCode: 'TS-LS-15', voters: 245000 },
    { name: 'Warangal East', code: 'TS-AC-106', number: 106, parliamentCode: 'TS-LS-15', voters: 238000 },
    // Khammam Parliament
    { name: 'Khammam', code: 'TS-AC-112', number: 112, parliamentCode: 'TS-LS-17', voters: 250000 },
    { name: 'Wyra', code: 'TS-AC-111', number: 111, parliamentCode: 'TS-LS-17', voters: 218000 },
  ];
  const constituencyMap: Record<string, any> = {};
  for (const c of constituenciesData) {
    let constituency = await prisma.constituency.findFirst({ where: { code: c.code } });
    if (!constituency) {
      constituency = await prisma.constituency.create({
        data: { name: c.name, code: c.code, constituencyNumber: c.number, parliamentId: parliamentMap[c.parliamentCode].id, totalVoters: c.voters },
      });
    }
    constituencyMap[c.code] = constituency;
  }
  console.log('✅ Constituencies seeded (10)');

  // ─── 8. MANDALS for Primary Constituency (Nalgonda - demo focus) ──────────
  const primaryConstituency = constituencyMap['TS-AC-92']; // Nalgonda
  const mandalData = [
    { name: 'Nalgonda Mandal', code: 'TS-NLG-MDL', villages: ['Nalgonda Town', 'Miryalaguda Colony', 'Pedda Adiserla'] },
    { name: 'Nakrekal Mandal', code: 'TS-NKL-MDL', villages: ['Nakrekal Town', 'Garidepally', 'Aler'] },
    { name: 'Chandur Mandal', code: 'TS-CHD-MDL', villages: ['Chandur Village', 'Neredcherla', 'Thipparthy'] },
    { name: 'Chityal Mandal', code: 'TS-CTL-MDL', villages: ['Chityal Town', 'Damaracherla', 'Huzurnagar Colony'] },
    { name: 'Marriguda Mandal', code: 'TS-MGD-MDL', villages: ['Marriguda Village', 'Addaguduru', 'Kattangur'] },
    { name: 'Nampally Mandal', code: 'TS-NMP-MDL', villages: ['Nampally Village', 'Thripuraram', 'Kodurupaka'] },
  ];

  for (const md of mandalData) {
    let mandal = await prisma.mandal.findFirst({ where: { code: md.code } });
    if (!mandal) {
      mandal = await prisma.mandal.create({
        data: { name: md.name, code: md.code, constituencyId: primaryConstituency.id, totalVoters: Math.floor(Math.random() * 25000) + 15000 },
      });
    }

    let boothNo = 1;
    for (const villageName of md.villages) {
      const vCode = `${md.code}-${villageName.replace(/\s+/g, '').slice(0, 5).toUpperCase()}`;
      let village = await prisma.village.findFirst({ where: { code: vCode } });
      if (!village) {
        village = await prisma.village.create({
          data: { name: villageName, code: vCode, mandalId: mandal.id, totalVoters: Math.floor(Math.random() * 5000) + 1500 },
        });
      }

      // 2 Booths per Village
      for (let b = 1; b <= 2; b++) {
        const bNum = `Booth ${boothNo++}`;
        const boothCode = `PS-${vCode}-${b}`;
        let booth = await prisma.booth.findFirst({ where: { code: boothCode } });
        if (!booth) {
          booth = await prisma.booth.create({
            data: { boothNumber: bNum, name: `${villageName} ${bNum}`, code: boothCode, pollingStation: boothCode, villageId: village.id, totalVoters: Math.floor(Math.random() * 1200) + 600 },
          });
        }

        const groupExists = await prisma.voterGroup.findFirst({ where: { boothId: booth.id } });
        if (!groupExists) {
          await prisma.voterGroup.create({
            data: { name: `${bNum} - Indiramma Team 1 (1-100)`, code: `${boothCode}-GRP1`, boothId: booth.id, totalVoters: 100 },
          });
        }
      }
    }
    console.log(`✅ Mandal seeded: ${md.name} (${md.villages.length} villages)`);
  }

  // ─── 9. USERS (key TPCC roles) ────────────────────────────────────────────
  const usersToCreate = [
    { name: 'TPCC Command Admin', mobile: '9000012345', role: RoleType.SUPER_ADMIN },
    { name: 'Telangana State Incharge', mobile: '9000012346', role: RoleType.STATE_ADMIN },
    { name: 'Nalgonda Constituency Incharge', mobile: '9000012347', role: RoleType.CONSTITUENCY_INCHARGE },
    { name: 'Nalgonda Mandal President', mobile: '9000012348', role: RoleType.MANDAL_INCHARGE },
    { name: 'Nakrekal Mandal President', mobile: '9000012349', role: RoleType.MANDAL_INCHARGE },
    { name: 'Booth President - Nalgonda Booth 1', mobile: '9000012350', role: RoleType.BOOTH_PRESIDENT },
    { name: 'Indiramma Incharge - Team 1', mobile: '9000012351', role: RoleType.VOTER_100_INCHARGE },
    { name: 'Karimnagar Zone Coordinator', mobile: '9000012352', role: RoleType.ZONE_INCHARGE },
    { name: 'Warangal Parliament Incharge', mobile: '9000012353', role: RoleType.PARLIAMENT_INCHARGE },
    { name: 'Nalgonda Village Incharge', mobile: '9000012354', role: RoleType.VILLAGE_INCHARGE },
  ];

  for (const u of usersToCreate) {
    const existingUser = await prisma.user.findFirst({ where: { mobileNumber: u.mobile } });
    if (!existingUser) {
      await prisma.user.create({
        data: {
          organisationId: org.id,
          userCode: `TPCC-${u.mobile.slice(-4)}-${Date.now().toString().slice(-4)}`,
          name: u.name, mobileNumber: u.mobile, role: u.role, accountStatus: 'ACTIVE',
        },
      });
    }
  }
  console.log('✅ Users seeded (10 TPCC roles)');

  // ─── 10. AI INSIGHTS ──────────────────────────────────────────────────────
  const aiInsightCount = await prisma.aIInsight.count();
  if (aiInsightCount === 0) {
    await prisma.aIInsight.createMany({
      data: [
        { constituencyId: primaryConstituency.id, category: 'TURNOUT_PREDICTION', title: 'Nalgonda Constituency: 78.4% Projected Turnout — Above State Average', content: 'Based on door-to-door surveys and historical data. INC has strong advantage in Miryalaguda and Nakrekal Mandals with 60%+ preference.', sentimentScore: 0.88, recommendedAction: 'Concentrate last-mile transport logistics in Chandur and Marriguda Mandals where turnout is projected at 68%.', tags: ['TurnoutForecast', 'Nalgonda', 'Election2024'] },
        { constituencyId: primaryConstituency.id, category: 'CASTE_DYNAMICS', title: 'BC Communities — Strong INC Support in Nalgonda (62%)', content: 'Field surveys show OBC communities in Nalgonda strongly favor INC-TPCC. Kamma 55%, Velama 48%, Reddy 52% preference for Congress.', sentimentScore: 0.78, recommendedAction: 'Deploy community leaders for outreach in Chityal and Nampally Mandals where support is marginally lower.', tags: ['CasteAnalysis', 'OBC', 'Nalgonda'] },
        { constituencyId: primaryConstituency.id, category: 'SENTIMENT_MONITORING', title: 'Social Media: TPCC Congress Positive Surge (+3.2x engagement)', content: 'Congress content in Telangana generated 3.2x more engagement than BRS in Nalgonda-related posts. Net sentiment: +0.71.', sentimentScore: 0.87, recommendedAction: 'Amplify local leader content on WhatsApp groups. Prioritize Nalgonda Town and Nakrekal area.', tags: ['SocialSentiment', 'TPCC', 'DigitalCampaign'] },
        { constituencyId: primaryConstituency.id, category: 'FAKE_VOTER_DETECTION', title: 'Duplicate EPIC Cluster — Chandur Mandal Booth 4', content: '12 voter entries share identical House Number with conflicting father names. Possible BRS-influenced roll manipulation.', sentimentScore: 0.42, recommendedAction: 'Flag Booth 4 of Chandur for re-verification. Submit complaint to Election Commission immediately.', tags: ['FakeVoter', 'Chandur', 'Alert'] },
        { constituencyId: primaryConstituency.id, category: 'MIGRATION_STRATEGY', title: 'Hyderabad-Based Nalgonda Voters: 8,400 Registered for Return Transport', content: 'Over 8,400 Nalgonda-district voters residing in Hyderabad confirmed return via TSRTC and TPCC transport program.', sentimentScore: 0.93, recommendedAction: 'Setup reception desks at Nalgonda Bus Station and Miryalaguda Junction for voter slip guides.', tags: ['Migration', 'Nalgonda', 'TurnoutVelocity'] },
      ],
    });
    console.log('✅ AI Insights seeded (5)');
  }

  // ─── 11. TRAINING VIDEOS ──────────────────────────────────────────────────
  const trainingCount = await prisma.trainingVideo.count();
  if (trainingCount === 0) {
    await prisma.trainingVideo.createMany({
      data: [
        { title: 'TPCC Congress Connect App — Complete Guide for Field Workers', description: 'Step-by-step walkthrough for Booth Presidents, Mandal Presidents, and 100-Voter Indiramma Incharges.', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: '14 mins', category: 'APP_TRAINING', sortOrder: 1 },
        { title: 'Election Day Live Vote Tracking — TPCC Protocol', description: 'How to mark voters, flag fake/doubtful voters, and submit real-time booth reports.', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: '20 mins', category: 'ELECTION_PROCEDURE', sortOrder: 2 },
        { title: 'Telangana Constituency Demographics — Congress Analysis', description: 'Understanding Telangana voter demographics, OBC/SC/ST data interpretation for TPCC.', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: '16 mins', category: 'STRATEGY', sortOrder: 3 },
        { title: 'Fake Voter Identification — How to Flag & Report', description: 'TPCC guide for identifying and reporting fake/duplicate voters to the Election Commission.', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: '12 mins', category: 'ELECTION_PROCEDURE', sortOrder: 4 },
      ],
    });
    console.log('✅ Training Videos seeded (4)');
  }

  // ─── 12. TASKS ─────────────────────────────────────────────────────────────
  const taskCount = await prisma.task.count();
  const superAdmin = await prisma.user.findFirst({ where: { role: RoleType.SUPER_ADMIN } });
  if (taskCount === 0 && superAdmin) {
    await prisma.task.createMany({
      data: [
        { title: 'Complete Voter Verification — Nalgonda Mandal', description: 'Verify phone number, resident status, and political preference for all assigned voters.', priority: TaskPriority.HIGH, status: TaskStatus.PENDING, targetLevel: OrgHierarchyLevel.VOTER_GROUP, assignedBy: superAdmin.name, dueDate: new Date('2024-11-15') },
        { title: 'Deploy Migration Transport Helpline — All Mandals', description: 'Coordinate buses and TSRTC passes for voters residing in Hyderabad/Bengaluru.', priority: TaskPriority.URGENT, status: TaskStatus.IN_PROGRESS, targetLevel: OrgHierarchyLevel.MANDAL, assignedBy: superAdmin.name, dueDate: new Date('2024-11-20') },
        { title: 'Indiramma Committee Formation — All Booths', description: 'Form 100-voter Indiramma committees at all booths and upload member data.', priority: TaskPriority.HIGH, status: TaskStatus.PENDING, targetLevel: OrgHierarchyLevel.BOOTH, assignedBy: superAdmin.name, dueDate: new Date('2024-11-18') },
        { title: 'Fake Voter Report Submission — Chandur Mandal', description: 'Submit EC complaint for duplicate EPICs found in Chandur Mandal Booth 4.', priority: TaskPriority.URGENT, status: TaskStatus.PENDING, targetLevel: OrgHierarchyLevel.MANDAL, assignedBy: superAdmin.name, dueDate: new Date('2024-11-10') },
        { title: 'BC/ST Community Outreach — Nakrekal Mandal', description: 'Conduct doorstep meetings with OBC leaders in Nakrekal Mandal for last-mile voter confirmation.', priority: TaskPriority.MEDIUM, status: TaskStatus.PENDING, targetLevel: OrgHierarchyLevel.VILLAGE, assignedBy: superAdmin.name, dueDate: new Date('2024-11-25') },
      ],
    });
    console.log('✅ Tasks seeded (5)');
  }

  // ─── 13. ANNOUNCEMENTS ────────────────────────────────────────────────────
  const announcementCount = await prisma.announcement.count();
  if (announcementCount === 0) {
    await prisma.announcement.createMany({
      data: [
        { title: '🚨 Election Schedule — All TPCC Field Teams on Alert', content: 'Official election notification received for Telangana. All mandal presidents must submit final voter list verification.', priority: TaskPriority.URGENT, targetLevel: OrgHierarchyLevel.STATE },
        { title: '📱 TPCC Connect App Update — Live Vote Tracking Active', content: 'New version of Telangana Congress Connect is live. Booth Presidents must update before Election Day.', priority: TaskPriority.HIGH, targetLevel: OrgHierarchyLevel.BOOTH },
        { title: '🚌 Migration Transport — Registration Open', content: 'Voters from Hyderabad, Bengaluru can register for free TPCC return transport. Contact your Indiramma Incharge.', priority: TaskPriority.HIGH, targetLevel: OrgHierarchyLevel.VOTER_GROUP },
        { title: '🤝 Indiramma Committee Verification Drive', content: 'All 100-Voter Incharges must complete Indiramma committee formation and submit details by November 15.', priority: TaskPriority.HIGH, targetLevel: OrgHierarchyLevel.VOTER_GROUP },
      ],
    });
    console.log('✅ Announcements seeded (4)');
  }

  // ─── 14. GROUND REPORTS ──────────────────────────────────────────────────
  const reportCount = await prisma.groundReport.count();
  if (reportCount === 0 && superAdmin) {
    await prisma.groundReport.createMany({
      data: [
        { reportType: GroundReportType.GENERAL_UPDATE, description: 'Nalgonda Town voter sentiment strongly positive after CM Revanth Reddy road show. Estimated 12,000+ attendance at evening rally.', createdById: superAdmin.id, issueCategory: 'POSITIVE_ACTIVITY' },
        { reportType: GroundReportType.COMPLAINT_ISSUE, description: 'Booth 4 in Chandur Mandal has duplicate voter entries. 12 EPIC numbers with same address but different names.', createdById: superAdmin.id, issueCategory: 'BOOTH_ISSUE', affectedVotersCount: 12 },
        { reportType: GroundReportType.GENERAL_UPDATE, description: 'Youth voters in Nakrekal Mandal (18-30 age group) showing 71% INC preference based on field survey by NSUI volunteers.', createdById: superAdmin.id, issueCategory: 'YOUTH_SENTIMENT' },
        { reportType: GroundReportType.GENERAL_UPDATE, description: 'Women voters in Chityal Mandal expressing strong support for Congress due to Telangana welfare schemes (Gruha Jyothi, Gruha Lakshmi).', createdById: superAdmin.id, issueCategory: 'WOMEN_OUTREACH' },
      ],
    });
    console.log('✅ Ground Reports seeded (4)');
  }

  // ─── FINAL SUMMARY ────────────────────────────────────────────────────────
  const counts = {
    states: await prisma.state.count(),
    zones: await prisma.zone.count(),
    parliaments: await prisma.parliament.count(),
    constituencies: await prisma.constituency.count(),
    mandals: await prisma.mandal.count(),
    villages: await prisma.village.count(),
    booths: await prisma.booth.count(),
    voterGroups: await prisma.voterGroup.count(),
    users: await prisma.user.count(),
    voters: await prisma.voter.count(),
    tasks: await prisma.task.count(),
    trainingVideos: await prisma.trainingVideo.count(),
    aiInsights: await prisma.aIInsight.count(),
    announcements: await prisma.announcement.count(),
    groundReports: await prisma.groundReport.count(),
    parties: await prisma.politicalParty.count(),
  };

  console.log('\n==========================================');
  console.log('✅ TPCC SEED COMPLETE — Telangana Congress Connect');
  console.log('==========================================');
  Object.entries(counts).forEach(([k, v]) => console.log(`  ${k.padEnd(20)}: ${v}`));
  console.log('==========================================\n');
  console.log('🎉 Telangana Pradesh Congress Committee (TPCC) system ready!');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
