import { OrgHierarchyLevel, Prisma, TaskStatus, TrainingStatus, VoterLocationStatus, VoterStatus, VoteStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export class AnalyticsService {
  static async computeAnalyticsForUnit(unitId: string) {
    const allUnits = await prisma.organizationUnit.findMany({
      select: { id: true, parentId: true, level: true, name: true, code: true },
    });

    const byParent = new Map<string | null, typeof allUnits>();
    allUnits.forEach((u) => {
      const p = u.parentId ?? null;
      const list = byParent.get(p) ?? [];
      list.push(u);
      byParent.set(p, list);
    });

    const descendantUnitIds: string[] = [unitId];
    const queue = [unitId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const kids = byParent.get(curr) ?? [];
      kids.forEach((k) => {
        descendantUnitIds.push(k.id);
        queue.push(k.id);
      });
    }

    const currentUnit = allUnits.find((u) => u.id === unitId);

    // Fetch all voters in this hierarchy subtree
    const voters = await prisma.voter.findMany({
      where: { unitId: { in: descendantUnitIds } },
    });

    // Counts
    const totalVoters = voters.length;
    const voted = voters.filter((v) => v.voteStatus === VoteStatus.VOTE_DONE).length;
    const notVoted = totalVoters - voted;
    const turnoutPct = totalVoters > 0 ? Math.round((voted / totalVoters) * 1000) / 10 : 0;

    const fakeVoters = voters.filter((v) => v.voterStatus === VoterStatus.FAKE).length;
    const doubtfulVoters = voters.filter((v) => v.voterStatus === VoterStatus.DOUBTFUL).length;
    const shiftedVoters = voters.filter((v) => v.voterStatus === VoterStatus.SHIFTED).length;
    const deceasedVoters = voters.filter((v) => v.voterStatus === VoterStatus.DECEASED).length;
    const activeVoters = voters.filter((v) => v.voterStatus === VoterStatus.ACTIVE).length;

    const migratedVoters = voters.filter((v) => v.voterLocationStatus === VoterLocationStatus.MIGRATED).length;
    const localVoters = voters.filter((v) => v.voterLocationStatus === VoterLocationStatus.LOCAL).length;

    // Party Preference
    const partyPreference: Record<string, number> = {
      TDP: 0,
      YSRCP: 0,
      JSP: 0,
      BJP: 0,
      INC: 0,
      NEUTRAL: 0,
      OTH: 0,
    };
    voters.forEach((v) => {
      const pref = v.politicalPreference || 'NEUTRAL';
      partyPreference[pref] = (partyPreference[pref] ?? 0) + 1;
    });

    // Caste Breakdown
    const caste: Record<string, number> = {};
    voters.forEach((v) => {
      const c = v.caste || 'Unknown';
      caste[c] = (caste[c] ?? 0) + 1;
    });

    // Profession Breakdown
    const profession: Record<string, number> = {};
    voters.forEach((v) => {
      const p = v.profession || 'Other';
      profession[p] = (profession[p] ?? 0) + 1;
    });

    // Age Brackets
    const age = {
      '18-25': 0,
      '26-40': 0,
      '41-60': 0,
      '60+': 0,
    };
    voters.forEach((v) => {
      if (v.age <= 25) age['18-25'] += 1;
      else if (v.age <= 40) age['26-40'] += 1;
      else if (v.age <= 60) age['41-60'] += 1;
      else age['60+'] += 1;
    });

    // Gender Split
    const gender = {
      Male: voters.filter((v) => v.gender === 'MALE').length,
      Female: voters.filter((v) => v.gender === 'FEMALE').length,
      Other: voters.filter((v) => v.gender === 'OTHER').length,
    };

    // Child Areas Winning/Trailing Rollup
    const directChildren = allUnits.filter((u) => u.parentId === unitId);
    const childrenStats = directChildren.map((child) => {
      const childDescendants = new Set<string>([child.id]);
      const childQueue = [child.id];
      while (childQueue.length > 0) {
        const c = childQueue.shift()!;
        (byParent.get(c) ?? []).forEach((k) => {
          childDescendants.add(k.id);
          childQueue.push(k.id);
        });
      }

      const childVoters = voters.filter((v) => v.unitId && childDescendants.has(v.unitId));
      const tdp = childVoters.filter((v) => v.politicalPreference === 'TDP').length;
      const ysrcp = childVoters.filter((v) => v.politicalPreference === 'YSRCP').length;
      const total = childVoters.length;
      const diff = tdp - ysrcp;
      const diffPct = total > 0 ? Math.abs(diff / total) * 100 : 0;
      const status = diffPct < 4 ? 'CLOSE_CONTEST' : tdp > ysrcp ? 'WINNING' : 'TRAILING';

      return {
        unitId: child.id,
        name: child.name,
        level: child.level,
        totalVoters: total,
        tdp,
        ysrcp,
        lead: Math.abs(diff),
        leadingParty: tdp >= ysrcp ? 'TDP' : 'YSRCP',
        status,
      };
    });

    const winningAreas = childrenStats.filter((c) => c.status === 'WINNING');
    const trailingAreas = childrenStats.filter((c) => c.status === 'TRAILING');
    const closeContestAreas = childrenStats.filter((c) => c.status === 'CLOSE_CONTEST');

    // Cadre & Team Performance
    const cadres = await prisma.user.findMany({
      where: { unitId: { in: descendantUnitIds } },
      include: {
        cadreProfile: true,
        assignedTasks: true,
        trainingProgress: true,
      },
    });

    const teamStrength = cadres.length;
    const cadrePerformance = {
      totalCadres: teamStrength,
      averageScore: cadres.length > 0
        ? Math.round(cadres.reduce((s, c) => s + (c.cadreProfile?.performanceScore ?? 80), 0) / cadres.length)
        : 0,
    };

    const taskRecords = await prisma.task.findMany({
      where: { unitId: { in: descendantUnitIds } },
    });
    const taskPerformance = {
      totalTasks: taskRecords.length,
      completed: taskRecords.filter((t) => t.status === TaskStatus.COMPLETED).length,
      pending: taskRecords.filter((t) => t.status === TaskStatus.PENDING).length,
      inProgress: taskRecords.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
      completionRate: taskRecords.length > 0
        ? Math.round((taskRecords.filter((t) => t.status === TaskStatus.COMPLETED).length / taskRecords.length) * 100)
        : 0,
    };

    const trainingRecords = await prisma.trainingProgress.findMany({
      where: { user: { unitId: { in: descendantUnitIds } } },
    });
    const trainingPerformance = {
      totalAssigned: trainingRecords.length,
      completed: trainingRecords.filter((t) => t.status === TrainingStatus.COMPLETED).length,
      completionRate: trainingRecords.length > 0
        ? Math.round((trainingRecords.filter((t) => t.status === TrainingStatus.COMPLETED).length / trainingRecords.length) * 100)
        : 0,
    };

    return {
      unit: currentUnit,
      summary: {
        totalVoters,
        voted,
        notVoted,
        turnoutPercentage: turnoutPct,
        fakeVoters,
        doubtfulVoters,
        shiftedVoters,
        deceasedVoters,
        activeVoters,
        migratedVoters,
        localVoters,
      },
      demographics: {
        caste,
        profession,
        age,
        gender,
      },
      partyPreference,
      projections: {
        winningAreasCount: winningAreas.length,
        trailingAreasCount: trailingAreas.length,
        closeContestAreasCount: closeContestAreas.length,
        winningAreas,
        trailingAreas,
        closeContestAreas,
      },
      operations: {
        teamStrength,
        cadrePerformance,
        taskPerformance,
        trainingPerformance,
      },
    };
  }
}
