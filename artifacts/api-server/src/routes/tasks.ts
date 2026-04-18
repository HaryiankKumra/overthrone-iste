import { Router } from "express";
import type { IRouter } from "express";
import { db, tasksTable, teamsTable, alliancesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { GetTaskParams, SubmitTaskAnswerParams, SubmitTaskAnswerBody, ListTasksQueryParams } from "@workspace/api-zod";
import { broadcast } from "../lib/ws";
import { logEvent } from "../lib/gameEvents";
import { verifyToken } from "../lib/auth";

const router: IRouter = Router();

function formatTask(task: typeof tasksTable.$inferSelect, hideAnswer = true, completedByTeam = false) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    difficulty: task.difficulty,
    apReward: task.apReward,
    content: task.content,
    isActive: task.isActive,
    completedByTeam,
    ...(hideAnswer ? {} : { answer: task.answer }),
  };
}

async function getOptionalTeamCompletedTaskIds(authHeader?: string): Promise<number[]> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return [];

  const payload = verifyToken(token);
  if (!payload) return [];

  const [team] = await db
    .select({ completedTaskIds: teamsTable.completedTaskIds })
    .from(teamsTable)
    .where(eq(teamsTable.id, payload.teamId))
    .limit(1);

  return team?.completedTaskIds ?? [];
}

router.get("/tasks", async (req, res): Promise<void> => {
  const queryParams = ListTasksQueryParams.safeParse(req.query);

  const completedIds = await getOptionalTeamCompletedTaskIds(req.headers.authorization);

  let query = db.select().from(tasksTable).$dynamic();

  if (queryParams.success && queryParams.data.difficulty) {
    query = db.select().from(tasksTable).where(
      and(eq(tasksTable.isActive, true), eq(tasksTable.difficulty, queryParams.data.difficulty))
    ).$dynamic();
  } else {
    query = db.select().from(tasksTable).where(eq(tasksTable.isActive, true)).$dynamic();
  }

  const tasks = await query;
  res.json(tasks.map(t => formatTask(t, true, completedIds.includes(t.id))));
});

router.get("/tasks/:id", async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id)).limit(1);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(formatTask(task));
});

router.post("/tasks/:id/submit", requireAuth, async (req, res): Promise<void> => {
  const params = SubmitTaskAnswerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = SubmitTaskAnswerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id)).limit(1);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  if (team.activeTaskId !== task.id) {
    res.status(400).json({ error: "This task is not your active task. Use the Task Card first.", correct: false, apEarned: 0, message: "This task is not your active task." });
    return;
  }

  const correct = body.data.answer.trim().toLowerCase() === task.answer.trim().toLowerCase();

  if (!correct) {
    res.json({ correct: false, apEarned: 0, message: "Wrong answer. Keep trying." });
    return;
  }

  const apEarned = task.apReward;
  const newCompletedIds = [...(team.completedTaskIds ?? []), task.id];

  await db.update(teamsTable).set({
    ap: team.ap + apEarned,
    activeTaskId: null,
    tasksCompleted: team.tasksCompleted + 1,
    completedTaskIds: newCompletedIds,
    lastCompletedTaskAp: apEarned,
  }).where(eq(teamsTable.id, team.id));

  await logEvent({
    type: "task_completed",
    fromTeamId: team.id,
    fromTeamName: team.name,
    description: `${team.name} completed "${task.title}" (${task.difficulty}) and earned ${apEarned} AP!`,
  });

  broadcast("teamUpdate", { teamId: team.id });

  // Check if this was a backstab task completion
  if (team.allianceId != null) {
    const [alliance] = await db.select().from(alliancesTable).where(
      and(eq(alliancesTable.id, team.allianceId), eq(alliancesTable.isActive, true))
    ).limit(1);

    if (alliance && alliance.backstabInProgress && alliance.backstabInitiatorId === team.id) {
      const allyId = alliance.team1Id === team.id ? alliance.team2Id : alliance.team1Id;
      const [ally] = await db.select().from(teamsTable).where(eq(teamsTable.id, allyId)).limit(1);

      if (ally) {
        // Transfer only AP that actually exists on the ally to keep score accounting consistent.
        const configuredBonusAp = Math.max(0, alliance.backstabBonusAp);
        const stolenAp = Math.min(Math.max(ally.ap, 0), configuredBonusAp);
        const allyNewAp = Math.max(0, ally.ap - stolenAp);
        const backstabberNewAp = team.ap + apEarned + stolenAp;

        await db.update(teamsTable).set({
          ap: backstabberNewAp,
          allianceId: null,
        }).where(eq(teamsTable.id, team.id));

        await db.update(teamsTable).set({
          ap: allyNewAp,
          allianceId: null,
        }).where(eq(teamsTable.id, allyId));

        await db.update(alliancesTable).set({
          isActive: false,
          backstabbedBy: team.id,
          backstabInProgress: false,
          backstabInitiatorId: null,
          backstabBonusAp: 0,
          suspicionInProgress: false,
          suspicionInitiatorId: null,
          dissolvedAt: new Date(),
        }).where(eq(alliancesTable.id, alliance.id));

        await logEvent({
          type: "backstab",
          fromTeamId: team.id,
          fromTeamName: team.name,
          toTeamId: allyId,
          toTeamName: ally.name,
          description: `BETRAYAL! ${team.name} has backstabbed ${ally.name}! ${stolenAp > 0 ? `They stole ${stolenAp} bonus AP` : "Their ally had no AP left to steal"} and shattered the alliance!`,
        });

        broadcast("leaderboard", null);
        broadcast("mapData", null);

        res.json({
          correct: true,
          apEarned: apEarned + stolenAp,
          message: stolenAp > 0
            ? `Correct! Earned ${apEarned} AP + stole ${stolenAp} bonus AP from your ally. Alliance broken!`
            : `Correct! Earned ${apEarned} AP. Backstab succeeded, but your ally had no AP left to steal. Alliance broken!`,
        });
        return;
      }
    }

    // Check if this was a suspicion task completion
    if (alliance && alliance.suspicionInProgress && alliance.suspicionInitiatorId === team.id) {
      const allyId = alliance.team1Id === team.id ? alliance.team2Id : alliance.team1Id;
      const [ally] = await db.select().from(teamsTable).where(eq(teamsTable.id, allyId)).limit(1);

      if (alliance.backstabInProgress && alliance.backstabInitiatorId === allyId) {
        // Caught the backstab!
        await db.update(alliancesTable).set({
          backstabInProgress: false,
          backstabInitiatorId: null,
          backstabBonusAp: 0,
          suspicionInProgress: false,
          suspicionInitiatorId: null,
        }).where(eq(alliancesTable.id, alliance.id));

        await logEvent({
          type: "suspicion",
          fromTeamId: team.id,
          fromTeamName: team.name,
          toTeamId: allyId,
          toTeamName: ally?.name ?? "Unknown",
          description: `${team.name}'s suspicion FOILED ${ally?.name ?? "ally"}'s backstab attempt! The alliance is saved!`,
        });

        res.json({
          correct: true,
          apEarned,
          message: `Correct! Earned ${apEarned} AP — and your suspicion caught the traitor! Backstab foiled.`,
        });
        return;
      } else {
        // No betrayal was active when suspicion resolved.
        await db.update(alliancesTable).set({
          suspicionInProgress: false,
          suspicionInitiatorId: null,
        }).where(eq(alliancesTable.id, alliance.id));

        res.json({
          correct: true,
          apEarned,
          message: `Correct! Earned ${apEarned} AP — no active betrayal was detected when your suspicion resolved.`,
        });
        return;
      }
    }
  }

  res.json({ correct: true, apEarned, message: `Correct! You earned ${apEarned} AP.` });
});

export default router;
