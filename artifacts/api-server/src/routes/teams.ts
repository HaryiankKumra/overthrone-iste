import { Router } from "express";
import { db, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetTeamParams } from "@workspace/api-zod";

const router = Router();

function formatTeam(team: typeof teamsTable.$inferSelect) {
  return {
    id: team.id,
    name: team.name,
    hp: team.hp,
    ap: team.ap,
    members: team.members,
    isEliminated: team.isEliminated,
    allianceId: team.allianceId ?? null,
    activeTaskId: team.activeTaskId ?? null,
    isAdmin: team.isAdmin,
    createdAt: team.createdAt.toISOString(),
  };
}

router.get("/teams", async (_req, res): Promise<void> => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);
  res.json(teams.map(formatTeam));
});

router.get("/teams/:id", async (req, res): Promise<void> => {
  const params = GetTeamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, params.data.id)).limit(1);
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  res.json(formatTeam(team));
});

export default router;
