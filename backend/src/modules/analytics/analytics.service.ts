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

    // Push aggregations into PostgreSQL directly; do NOT fetch 250,000 voter records into Node.js memory
    if (descendantUnitIds.length === 0) {
      return {
        unit: currentUnit,
        summary: {
          totalVoters: 0,
          voted: 0,
          notVoted: 0,
          turnoutPercentage: 0,
          fakeVoters: 0,
          doubtfulVoters: 0,
          shiftedVoters: 0,
          deceasedVoters: 0,
          activeVoters: 0,
          migratedVoters: 0,
          localVoters: 0,
        },
        demographics: {
          caste: {},
          profession: {},
          age: { '18-25': 0, '26-40': 0, '41-60': 0, '60+': 0 },
          gender: { Male: 0, Female: 0, Other: 0 },
        },
        partyPreference: { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, NEUTRAL: 0, OTH: 0 },
        projections: {
          winningAreasCount: 0,
          trailingAreasCount: 0,
          closeContestAreasCount: 0,
          winningAreas: [],
          trailingAreas: [],
          closeContestAreas: [],
        },
        operations: {
          teamStrength: 0,
          cadrePerformance: { totalCadres: 0, averageScore: 0 },
          taskPerformance: { totalTasks: 0, completed: 0, pending: 0, inProgress: 0, completionRate: 0 },
          trainingPerformance: { totalAssigned: 0, completed: 0, completionRate: 0 },
        },
      };
    }

    const unitSqlList = descendantUnitIds.map((id) => Prisma.sql`${id}::uuid`);

    // Execute PostgreSQL-level pushdown aggregations in parallel without loading voter objects into memory
    const [
      summaryRows,
      partyRows,
      casteRows,
      professionRows,
      unitAggregateRows,
      cadres,
      taskCounts,
      trainingCounts,
    ] = await Promise.all([
      prisma.$queryRaw<Array<{
        totalVoters: number;
        voted: number;
        fakeVoters: number;
        doubtfulVoters: number;
        shiftedVoters: number;
        deceasedVoters: number;
        activeVoters: number;
        migratedVoters: number;
        localVoters: number;
        age_18_25: number;
        age_26_40: number;
        age_41_60: number;
        age_60_plus: number;
        gender_male: number;
        gender_female: number;
        gender_other: number;
      }>>`
        SELECT
          COUNT(*)::int AS "totalVoters",
          COUNT(*) FILTER (WHERE "voteStatus" = 'VOTE_DONE')::int AS "voted",
          COUNT(*) FILTER (WHERE "voterStatus" = 'FAKE')::int AS "fakeVoters",
          COUNT(*) FILTER (WHERE "voterStatus" = 'DOUBTFUL')::int AS "doubtfulVoters",
          COUNT(*) FILTER (WHERE "voterStatus" = 'SHIFTED')::int AS "shiftedVoters",
          COUNT(*) FILTER (WHERE "voterStatus" = 'DECEASED')::int AS "deceasedVoters",
          COUNT(*) FILTER (WHERE "voterStatus" = 'ACTIVE')::int AS "activeVoters",
          COUNT(*) FILTER (WHERE "voterLocationStatus" = 'MIGRATED')::int AS "migratedVoters",
          COUNT(*) FILTER (WHERE "voterLocationStatus" = 'LOCAL')::int AS "localVoters",
          COUNT(*) FILTER (WHERE "age" <= 25)::int AS "age_18_25",
          COUNT(*) FILTER (WHERE "age" >= 26 AND "age" <= 40)::int AS "age_26_40",
          COUNT(*) FILTER (WHERE "age" >= 41 AND "age" <= 60)::int AS "age_41_60",
          COUNT(*) FILTER (WHERE "age" > 60)::int AS "age_60_plus",
          COUNT(*) FILTER (WHERE "gender" = 'MALE')::int AS "gender_male",
          COUNT(*) FILTER (WHERE "gender" = 'FEMALE')::int AS "gender_female",
          COUNT(*) FILTER (WHERE "gender" = 'OTHER')::int AS "gender_other"
        FROM "Voter"
        WHERE "unitId" IN (${Prisma.join(unitSqlList)})
      `,
      prisma.$queryRaw<Array<{ politicalPreference: string | null; count: number }>>`
        SELECT COALESCE("politicalPreference", 'NEUTRAL') AS "politicalPreference", COUNT(*)::int AS count
        FROM "Voter"
        WHERE "unitId" IN (${Prisma.join(unitSqlList)})
        GROUP BY "politicalPreference"
      `,
      prisma.$queryRaw<Array<{ caste: string | null; count: number }>>`
        SELECT COALESCE(NULLIF(TRIM("caste"), ''), 'Unknown') AS caste, COUNT(*)::int AS count
        FROM "Voter"
        WHERE "unitId" IN (${Prisma.join(unitSqlList)})
        GROUP BY COALESCE(NULLIF(TRIM("caste"), ''), 'Unknown')
      `,
      prisma.$queryRaw<Array<{ profession: string | null; count: number }>>`
        SELECT COALESCE(NULLIF(TRIM("profession"), ''), 'Other') AS profession, COUNT(*)::int AS count
        FROM "Voter"
        WHERE "unitId" IN (${Prisma.join(unitSqlList)})
        GROUP BY COALESCE(NULLIF(TRIM("profession"), ''), 'Other')
      `,
      prisma.$queryRaw<Array<{ unitId: string; total: number; tdp: number; ysrcp: number }>>`
        SELECT
          "unitId",
          COUNT(*)::int AS "total",
          COUNT(*) FILTER (WHERE "politicalPreference" = 'TDP')::int AS "tdp",
          COUNT(*) FILTER (WHERE "politicalPreference" = 'YSRCP')::int AS "ysrcp"
        FROM "Voter"
        WHERE "unitId" IN (${Prisma.join(unitSqlList)})
        GROUP BY "unitId"
      `,
      prisma.user.findMany({
        where: { unitId: { in: descendantUnitIds } },
        select: {
          id: true,
          cadreProfile: { select: { performanceScore: true } },
        },
      }),
      prisma.task.groupBy({
        by: ['status'],
        where: { unitId: { in: descendantUnitIds } },
        _count: { _all: true },
      }),
      prisma.trainingProgress.groupBy({
        by: ['status'],
        where: { user: { unitId: { in: descendantUnitIds } } },
        _count: { _all: true },
      }),
    ]);

    const s = summaryRows[0] || {
      totalVoters: 0,
      voted: 0,
      fakeVoters: 0,
      doubtfulVoters: 0,
      shiftedVoters: 0,
      deceasedVoters: 0,
      activeVoters: 0,
      migratedVoters: 0,
      localVoters: 0,
      age_18_25: 0,
      age_26_40: 0,
      age_41_60: 0,
      age_60_plus: 0,
      gender_male: 0,
      gender_female: 0,
      gender_other: 0,
    };

    const totalVoters = Number(s.totalVoters || 0);
    const voted = Number(s.voted || 0);
    const notVoted = totalVoters - voted;
    const turnoutPct = totalVoters > 0 ? Math.round((voted / totalVoters) * 1000) / 10 : 0;
    const fakeVoters = Number(s.fakeVoters || 0);
    const doubtfulVoters = Number(s.doubtfulVoters || 0);
    const shiftedVoters = Number(s.shiftedVoters || 0);
    const deceasedVoters = Number(s.deceasedVoters || 0);
    const activeVoters = Number(s.activeVoters || 0);
    const migratedVoters = Number(s.migratedVoters || 0);
    const localVoters = Number(s.localVoters || 0);

    const partyPreference: Record<string, number> = {
      TDP: 0,
      YSRCP: 0,
      JSP: 0,
      BJP: 0,
      INC: 0,
      NEUTRAL: 0,
      OTH: 0,
    };
    partyRows.forEach((r) => {
      const pref = r.politicalPreference || 'NEUTRAL';
      partyPreference[pref] = (partyPreference[pref] ?? 0) + Number(r.count || 0);
    });

    const caste: Record<string, number> = {};
    casteRows.forEach((r) => {
      const c = r.caste || 'Unknown';
      caste[c] = (caste[c] ?? 0) + Number(r.count || 0);
    });

    const profession: Record<string, number> = {};
    professionRows.forEach((r) => {
      const p = r.profession || 'Other';
      profession[p] = (profession[p] ?? 0) + Number(r.count || 0);
    });

    const age = {
      '18-25': Number(s.age_18_25 || 0),
      '26-40': Number(s.age_26_40 || 0),
      '41-60': Number(s.age_41_60 || 0),
      '60+': Number(s.age_60_plus || 0),
    };

    const gender = {
      Male: Number(s.gender_male || 0),
      Female: Number(s.gender_female || 0),
      Other: Number(s.gender_other || 0),
    };

    const unitMap = new Map<string, { total: number; tdp: number; ysrcp: number }>();
    unitAggregateRows.forEach((row) => {
      unitMap.set(row.unitId, {
        total: Number(row.total || 0),
        tdp: Number(row.tdp || 0),
        ysrcp: Number(row.ysrcp || 0),
      });
    });

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

      let total = 0;
      let tdp = 0;
      let ysrcp = 0;
      for (const uid of childDescendants) {
        const stats = unitMap.get(uid);
        if (stats) {
          total += stats.total;
          tdp += stats.tdp;
          ysrcp += stats.ysrcp;
        }
      }

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
    const teamStrength = cadres.length;
    const cadrePerformance = {
      totalCadres: teamStrength,
      averageScore: cadres.length > 0
        ? Math.round(cadres.reduce((sum, c) => sum + (c.cadreProfile?.performanceScore ?? 80), 0) / cadres.length)
        : 0,
    };

    let totalTasks = 0;
    let completedTasks = 0;
    let pendingTasks = 0;
    let inProgressTasks = 0;
    taskCounts.forEach((t) => {
      const c = Number(t._count._all || 0);
      totalTasks += c;
      if (t.status === TaskStatus.COMPLETED) completedTasks += c;
      else if (t.status === TaskStatus.PENDING) pendingTasks += c;
      else if (t.status === TaskStatus.IN_PROGRESS) inProgressTasks += c;
    });
    const taskPerformance = {
      totalTasks,
      completed: completedTasks,
      pending: pendingTasks,
      inProgress: inProgressTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };

    let totalTrainingAssigned = 0;
    let completedTraining = 0;
    trainingCounts.forEach((tr) => {
      const c = Number(tr._count._all || 0);
      totalTrainingAssigned += c;
      if (tr.status === TrainingStatus.COMPLETED) completedTraining += c;
    });
    const trainingPerformance = {
      totalAssigned: totalTrainingAssigned,
      completed: completedTraining,
      completionRate: totalTrainingAssigned > 0 ? Math.round((completedTraining / totalTrainingAssigned) * 100) : 0,
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
