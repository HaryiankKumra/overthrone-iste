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

  const activeTeams = teams
    .filter((team) => !team.isEliminated)
    .sort((a, b) => b.hp - a.hp);
  const eliminatedTeams = teams.filter((team) => team.isEliminated);
  const maxHp = Math.max(...activeTeams.map((team) => Math.max(team.hp, 1)), 1);

  const columnCount = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(Math.max(activeTeams.length, 1)))));
  const rowCount = Math.max(1, Math.ceil(activeTeams.length / columnCount));
  const xStart = 13;
  const yStart = 18;
  const usableWidth = 74;
  const usableHeight = 58;
  const columnStep = columnCount > 1 ? usableWidth / (columnCount - 1) : 0;
  const rowStep = rowCount > 1 ? usableHeight / (rowCount - 1) : 0;

  const activeEntries = activeTeams.map((team, index) => {
    const row = Math.floor(index / columnCount);
    const col = index % columnCount;
    const jitterSeed = team.id * 9301 + 49297;
    const jitterX = ((jitterSeed % 7) - 3) * 0.55;
    const jitterY = (((jitterSeed >> 3) % 7) - 3) * 0.45;
    const x = Math.max(8, Math.min(92, xStart + col * columnStep + jitterX));
    const y = Math.max(10, Math.min(84, yStart + row * rowStep + jitterY));

    const normalizedHp = Math.max(team.hp, 0) / maxHp;
    const size = 12 + Math.sqrt(normalizedHp) * 22;

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

  const eliminatedEntries = eliminatedTeams.map((team, index) => {
    const count = Math.max(eliminatedTeams.length, 1);
    const x = 8 + ((index + 0.5) * 84) / count;
    const y = 92;

    return {
      teamId: team.id,
      teamName: team.name,
      hp: team.hp,
      ap: team.ap,
      isEliminated: team.isEliminated,
      allianceId: team.allianceId ?? null,
      x,
      y,
      size: 8,
    };
  });

  const entries = [...activeEntries, ...eliminatedEntries];

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
