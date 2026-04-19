import { Router } from "express";
import type { IRouter } from "express";
import { db, teamsTable, tasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth.js";
import { EliminateTeamParams, CreateTaskBody } from "@workspace/api-zod";
import { logEvent } from "../lib/gameEvents.js";
import { broadcast } from "../lib/ws.js";

const router: IRouter = Router();

router.get("/admin/teams", requireAdmin, async (_req, res): Promise<void> => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);
  res.json(teams.map(t => ({
    id: t.id,
    name: t.name,
    hp: t.hp,
    ap: t.ap,
    members: t.members,
    isEliminated: t.isEliminated,
    allianceId: t.allianceId ?? null,
    activeTaskId: t.activeTaskId ?? null,
    isAdmin: t.isAdmin,
    tasksCompleted: t.tasksCompleted,
    attacksMade: t.attacksMade,
    createdAt: t.createdAt.toISOString(),
  })));
});

router.post("/admin/teams/:id/eliminate", requireAdmin, async (req, res): Promise<void> => {
  const params = EliminateTeamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, params.data.id)).limit(1);
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  await db.update(teamsTable).set({ isEliminated: true, allianceId: null }).where(eq(teamsTable.id, team.id));

  await logEvent({
    type: "team_eliminated",
    toTeamId: team.id,
    toTeamName: team.name,
    description: `${team.name} has been eliminated by the admin.`,
  });

  broadcast("leaderboard", null);
  broadcast("mapData", null);

  res.json({ success: true });
});

router.post("/admin/tasks", requireAdmin, async (req, res): Promise<void> => {
  const body = CreateTaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const apRewardMap: Record<string, number> = { easy: 150, medium: 300, hard: 500 };
  const apReward = apRewardMap[body.data.difficulty] ?? 150;

  const [task] = await db.insert(tasksTable).values({
    ...body.data,
    apReward,
  }).returning();

  res.status(201).json({
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    difficulty: task.difficulty,
    apReward: task.apReward,
    content: task.content,
    isActive: task.isActive,
  });
});

export default router;
