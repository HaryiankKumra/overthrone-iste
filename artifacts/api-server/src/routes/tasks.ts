import { Router } from "express";
import type { IRouter } from "express";
import { db, tasksTable, teamsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { GetTaskParams, SubmitTaskAnswerParams, SubmitTaskAnswerBody, ListTasksQueryParams } from "@workspace/api-zod";
import { broadcast } from "../lib/ws";
import { logEvent } from "../lib/gameEvents";

const router: IRouter = Router();

function formatTask(task: typeof tasksTable.$inferSelect, hideAnswer = true) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    difficulty: task.difficulty,
    apReward: task.apReward,
    content: task.content,
    isActive: task.isActive,
    ...(hideAnswer ? {} : { answer: task.answer }),
  };
}

router.get("/tasks", async (req, res): Promise<void> => {
  const queryParams = ListTasksQueryParams.safeParse(req.query);
  let query = db.select().from(tasksTable).$dynamic();

  if (queryParams.success && queryParams.data.difficulty) {
    query = db.select().from(tasksTable).where(
      and(
        eq(tasksTable.isActive, true),
        eq(tasksTable.difficulty, queryParams.data.difficulty)
      )
    ).$dynamic();
  } else {
    query = db.select().from(tasksTable).where(eq(tasksTable.isActive, true)).$dynamic();
  }

  const tasks = await query;
  res.json(tasks.map((t) => formatTask(t)));
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
    res.status(400).json({ error: "This task is not your active task. Use the Task Card first." });
    return;
  }

  const correct = body.data.answer.trim().toLowerCase() === task.answer.trim().toLowerCase();

  if (correct) {
    const apEarned = task.apReward;
    await db.update(teamsTable).set({
      ap: team.ap + apEarned,
      activeTaskId: null,
      tasksCompleted: team.tasksCompleted + 1,
    }).where(eq(teamsTable.id, team.id));

    await logEvent({
      type: "task_completed",
      fromTeamId: team.id,
      fromTeamName: team.name,
      description: `${team.name} completed "${task.title}" (${task.difficulty}) and earned ${apEarned} AP!`,
    });

    broadcast("teamUpdate", { teamId: team.id });

    res.json({ correct: true, apEarned, message: `Correct! You earned ${apEarned} AP.` });
  } else {
    res.json({ correct: false, apEarned: 0, message: "Wrong answer. Keep trying." });
  }
});

export default router;
