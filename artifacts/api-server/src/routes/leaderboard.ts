import { Router } from "express";
import type { IRouter } from "express";
import { db, teamsTable, alliancesTable, gameEventsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/leaderboard", async (_req, res): Promise<void> => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);
  const alliances = await db.select().from(alliancesTable).where(eq(alliancesTable.isActive, true));

  const allianceMap = new Map<number, { id: number; team1Id: number; team2Id: number }>();
  for (const a of alliances) {
    allianceMap.set(a.id, a);
  }

  const allianceStatsMap = new Map<number, { hp: number; ap: number; name: string }>();
  for (const alliance of alliances) {
    const t1 = teams.find(t => t.id === alliance.team1Id);
    const t2 = teams.find(t => t.id === alliance.team2Id);
    if (t1 && t2) {
      allianceStatsMap.set(alliance.id, {
        hp: t1.hp + t2.hp,
        ap: t1.ap + t2.ap,
        name: `${t1.name} & ${t2.name}`,
      });
    }
  }

  const entries = teams.map((team) => {
    const totalScore = team.hp + team.ap;
    const allianceStats = team.allianceId ? allianceStatsMap.get(team.allianceId) : null;
    return {
      teamId: team.id,
      teamName: team.name,
      hp: team.hp,
      ap: team.ap,
      totalScore,
      isEliminated: team.isEliminated,
      allianceId: team.allianceId ?? null,
      allianceName: allianceStats?.name ?? null,
      allianceHP: allianceStats?.hp ?? null,
      allianceAP: allianceStats?.ap ?? null,
    };
  });

  entries.sort((a, b) => {
    if (a.isEliminated && !b.isEliminated) return 1;
    if (!a.isEliminated && b.isEliminated) return -1;
    return b.totalScore - a.totalScore;
  });

  const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));

  res.json({ entries: ranked, updatedAt: new Date().toISOString() });
});

router.get("/leaderboard/map", async (_req, res): Promise<void> => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);

  const gridSize = Math.ceil(Math.sqrt(teams.length));
  const entries = teams.map((team, i) => {
    const col = i % gridSize;
    const row = Math.floor(i / gridSize);
    const x = (col / (gridSize - 1 || 1)) * 800 + 100;
    const y = (row / (Math.ceil(teams.length / gridSize) - 1 || 1)) * 500 + 100;
    const maxHp = 10000;
    const size = 30 + (team.hp / maxHp) * 70;

    return {
      teamId: team.id,
      teamName: team.name,
      hp: team.hp,
      ap: team.ap,
      isEliminated: team.isEliminated,
      allianceId: team.allianceId ?? null,
      x,
      y,
      size,
    };
  });

  res.json(entries);
});

router.get("/events/recent", async (_req, res): Promise<void> => {
  const events = await db.select().from(gameEventsTable).orderBy(desc(gameEventsTable.createdAt)).limit(50);
  res.json(events.map(e => ({
    id: e.id,
    type: e.type,
    fromTeamId: e.fromTeamId ?? null,
    fromTeamName: e.fromTeamName ?? null,
    toTeamId: e.toTeamId ?? null,
    toTeamName: e.toTeamName ?? null,
    description: e.description,
    epoch: e.epoch,
    createdAt: e.createdAt.toISOString(),
  })));
});

export default router;
