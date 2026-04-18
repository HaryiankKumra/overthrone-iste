import { Router } from "express";
import type { IRouter } from "express";
import { db, teamsTable, tasksTable, alliancesTable, allianceRequestsTable } from "@workspace/db";
import { eq, and, notInArray, ne } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { UseTaskCardBody, UseAttackCardBody, UseAllianceCardBody, RespondToAllianceBody } from "@workspace/api-zod";
import { broadcast } from "../lib/ws";
import { logEvent } from "../lib/gameEvents";

const router: IRouter = Router();

function formatTeamState(t: typeof teamsTable.$inferSelect) {
  return {
    id: t.id, name: t.name, hp: t.hp, ap: t.ap, members: t.members,
    isEliminated: t.isEliminated, allianceId: t.allianceId ?? null,
    activeTaskId: t.activeTaskId ?? null, isAdmin: t.isAdmin,
    createdAt: t.createdAt.toISOString(),
  };
}

async function getRandomAvailableTask(excludeTaskIds: number[]) {
  let query = db.select().from(tasksTable).where(eq(tasksTable.isActive, true)).$dynamic();
  if (excludeTaskIds.length > 0) {
    query = db.select().from(tasksTable).where(
      and(eq(tasksTable.isActive, true), notInArray(tasksTable.id, excludeTaskIds))
    ).$dynamic();
  }
  const tasks = await query;
  if (tasks.length === 0) return null;
  return tasks[Math.floor(Math.random() * tasks.length)];
}

// ─── Task Card ────────────────────────────────────────────────────────────────

router.post("/cards/task", requireAuth, async (req, res): Promise<void> => {
  const body = UseTaskCardBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message, success: false, message: body.error.message });
    return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
  if (!team) { res.status(404).json({ success: false, message: "Team not found" }); return; }
  if (team.isEliminated) { res.status(400).json({ success: false, message: "Your kingdom has fallen. You cannot act." }); return; }
  if (team.activeTaskId != null) { res.status(400).json({ success: false, message: "You already have an active task. Finish it first." }); return; }

  const completedIds: number[] = team.completedTaskIds ?? [];
  if (completedIds.includes(body.data.taskId)) {
    res.status(400).json({ success: false, message: "Your house has already conquered this challenge. Choose another." });
    return;
  }

  const [task] = await db.select().from(tasksTable).where(
    and(eq(tasksTable.id, body.data.taskId), eq(tasksTable.isActive, true))
  ).limit(1);

  if (!task) { res.status(404).json({ success: false, message: "Task not found or inactive" }); return; }

  await db.update(teamsTable).set({ activeTaskId: task.id }).where(eq(teamsTable.id, team.id));
  const [t] = await db.select().from(teamsTable).where(eq(teamsTable.id, team.id)).limit(1);

  res.json({
    success: true,
    message: `Task "${task.title}" is now active. Solve it to earn ${task.apReward} AP.`,
    teamState: formatTeamState(t),
  });
});

// ─── Attack Card ──────────────────────────────────────────────────────────────

router.post("/cards/attack", requireAuth, async (req, res): Promise<void> => {
  const body = UseAttackCardBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message, success: false, message: body.error.message });
    return;
  }

  const [attacker] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
  if (!attacker || attacker.isEliminated) { res.status(400).json({ success: false, message: "Cannot attack — your kingdom has fallen." }); return; }

  const [target] = await db.select().from(teamsTable).where(eq(teamsTable.id, body.data.targetTeamId)).limit(1);
  if (!target || target.isEliminated) { res.status(400).json({ success: false, message: "Target not found or already eliminated." }); return; }
  if (target.id === attacker.id) { res.status(400).json({ success: false, message: "You cannot attack yourself." }); return; }
  if (attacker.allianceId && attacker.allianceId === target.allianceId) {
    res.status(400).json({ success: false, message: "You cannot attack your alliance partner. Use Backstab to betray them." });
    return;
  }

  const apSpent = body.data.apSpent;
  if (apSpent > attacker.ap) { res.status(400).json({ success: false, message: `Insufficient AP. You have ${attacker.ap} AP.` }); return; }
  if (apSpent <= 0) { res.status(400).json({ success: false, message: "Must spend at least 1 AP to attack." }); return; }

  const damageDealt = apSpent;
  const newTargetHp = Math.max(0, target.hp - damageDealt);
  const wasEliminated = newTargetHp === 0;

  await db.update(teamsTable).set({ ap: attacker.ap - apSpent, attacksMade: attacker.attacksMade + 1 }).where(eq(teamsTable.id, attacker.id));
  await db.update(teamsTable).set({ hp: newTargetHp, isEliminated: wasEliminated, allianceId: wasEliminated ? null : target.allianceId }).where(eq(teamsTable.id, target.id));

  await logEvent({
    type: "attack",
    fromTeamId: attacker.id, fromTeamName: attacker.name,
    toTeamId: target.id, toTeamName: target.name,
    description: `${attacker.name} unleashed ${damageDealt} damage upon ${target.name}!${wasEliminated ? " The kingdom has fallen!" : ""}`,
  });

  if (wasEliminated) {
    await logEvent({ type: "team_eliminated", toTeamId: target.id, toTeamName: target.name, description: `${target.name} has been eliminated from the war!` });
  }

  broadcast("leaderboard", null);
  broadcast("mapData", null);

  res.json({
    success: true,
    message: wasEliminated ? `${target.name} has been destroyed!` : `Attack successful! Dealt ${damageDealt} damage to ${target.name}.`,
    damageDealt, apSpent, targetTeamId: target.id, targetTeamName: target.name,
  });
});

// ─── Alliance Card ────────────────────────────────────────────────────────────

router.get("/cards/alliance/pending", requireAuth, async (req, res): Promise<void> => {
  const pending = await db.select({
    id: allianceRequestsTable.id,
    fromTeamId: allianceRequestsTable.fromTeamId,
    fromTeamName: teamsTable.name,
    createdAt: allianceRequestsTable.createdAt,
  })
    .from(allianceRequestsTable)
    .leftJoin(teamsTable, eq(teamsTable.id, allianceRequestsTable.fromTeamId))
    .where(and(eq(allianceRequestsTable.toTeamId, req.team!.id), eq(allianceRequestsTable.status, "pending")));

  res.json(pending.map(r => ({
    id: r.id,
    fromTeamId: r.fromTeamId,
    fromTeamName: r.fromTeamName ?? "Unknown",
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/cards/alliance", requireAuth, async (req, res): Promise<void> => {
  const body = UseAllianceCardBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ success: false, message: body.error.message }); return; }

  const [requester] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
  const [target] = await db.select().from(teamsTable).where(eq(teamsTable.id, body.data.targetTeamId)).limit(1);

  if (!requester || !target) { res.status(404).json({ success: false, message: "Team not found" }); return; }
  if (requester.isEliminated) { res.status(400).json({ success: false, message: "Your kingdom has fallen." }); return; }
  if (requester.id === target.id) { res.status(400).json({ success: false, message: "Cannot form alliance with yourself." }); return; }
  if (requester.allianceId != null) { res.status(400).json({ success: false, message: "You are already in an alliance." }); return; }
  if (target.allianceId != null) { res.status(400).json({ success: false, message: "Target team is already in an alliance." }); return; }
  if (target.isEliminated) { res.status(400).json({ success: false, message: "Cannot ally with an eliminated kingdom." }); return; }

  const existingRequest = await db.select().from(allianceRequestsTable).where(
    and(eq(allianceRequestsTable.fromTeamId, requester.id), eq(allianceRequestsTable.toTeamId, target.id), eq(allianceRequestsTable.status, "pending"))
  ).limit(1);

  if (existingRequest.length > 0) {
    res.status(400).json({ success: false, message: "Alliance request already sent. Await their response." });
    return;
  }

  await db.insert(allianceRequestsTable).values({ fromTeamId: requester.id, toTeamId: target.id, status: "pending" });

  await logEvent({
    type: "alliance_formed",
    fromTeamId: requester.id, fromTeamName: requester.name,
    toTeamId: target.id, toTeamName: target.name,
    description: `${requester.name} has sent an alliance proposal to ${target.name}!`,
  });

  broadcast("allianceRequest", { toTeamId: target.id, fromTeamName: requester.name });

  res.json({
    success: true,
    message: `Alliance request sent to ${target.name}. They will be notified.`,
    teamState: formatTeamState(requester),
  });
});

router.post("/cards/alliance/respond", requireAuth, async (req, res): Promise<void> => {
  const body = RespondToAllianceBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ success: false, message: body.error.message }); return; }

  const [request] = await db.select().from(allianceRequestsTable).where(
    and(
      eq(allianceRequestsTable.fromTeamId, body.data.requestingTeamId),
      eq(allianceRequestsTable.toTeamId, req.team!.id),
      eq(allianceRequestsTable.status, "pending")
    )
  ).limit(1);

  if (!request) { res.status(404).json({ success: false, message: "Alliance request not found." }); return; }

  if (!body.data.accept) {
    await db.update(allianceRequestsTable).set({ status: "rejected" }).where(eq(allianceRequestsTable.id, request.id));
    const [t] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
    res.json({ success: true, message: "Alliance request rejected.", teamState: formatTeamState(t) });
    return;
  }

  const [team1] = await db.select().from(teamsTable).where(eq(teamsTable.id, body.data.requestingTeamId)).limit(1);
  const [team2] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);

  if (!team1 || !team2) { res.status(404).json({ success: false, message: "Team not found" }); return; }
  if (team1.allianceId != null || team2.allianceId != null) {
    res.status(400).json({ success: false, message: "One or both teams already in an alliance." });
    return;
  }

  const [alliance] = await db.insert(alliancesTable).values({ team1Id: team1.id, team2Id: team2.id }).returning();

  await db.update(teamsTable).set({ allianceId: alliance.id }).where(eq(teamsTable.id, team1.id));
  await db.update(teamsTable).set({ allianceId: alliance.id }).where(eq(teamsTable.id, team2.id));
  await db.update(allianceRequestsTable).set({ status: "accepted" }).where(eq(allianceRequestsTable.id, request.id));

  await logEvent({
    type: "alliance_formed",
    fromTeamId: team1.id, fromTeamName: team1.name,
    toTeamId: team2.id, toTeamName: team2.name,
    description: `${team1.name} and ${team2.name} have forged an alliance! Their kingdoms stand as one!`,
  });

  broadcast("leaderboard", null);
  broadcast("mapData", null);

  const [t] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
  res.json({ success: true, message: `Alliance formed with ${team1.name}! You now fight as one.`, teamState: formatTeamState(t) });
});

// ─── Backstab Card ────────────────────────────────────────────────────────────
// Flow: Team A clicks Backstab → gets a secret random task → solves it →
//       steals ally's lastCompletedTaskAp and breaks alliance.
//       If ally used Suspicion before backstab resolves, backstab is foiled.

router.post("/cards/backstab", requireAuth, async (req, res): Promise<void> => {
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
  if (!team || team.allianceId == null) { res.status(400).json({ success: false, message: "You are not in an alliance. Nothing to backstab." }); return; }
  if (team.isEliminated) { res.status(400).json({ success: false, message: "Your kingdom has fallen." }); return; }
  if (team.activeTaskId != null) { res.status(400).json({ success: false, message: "Complete your current task before initiating a backstab." }); return; }

  const [alliance] = await db.select().from(alliancesTable).where(
    and(eq(alliancesTable.id, team.allianceId), eq(alliancesTable.isActive, true))
  ).limit(1);

  if (!alliance) { res.status(400).json({ success: false, message: "Alliance not found or already dissolved." }); return; }
  if (alliance.backstabInProgress) { res.status(400).json({ success: false, message: "A backstab is already in progress." }); return; }

  const allyId = alliance.team1Id === team.id ? alliance.team2Id : alliance.team1Id;
  const [ally] = await db.select().from(teamsTable).where(eq(teamsTable.id, allyId)).limit(1);
  if (!ally) { res.status(404).json({ success: false, message: "Ally not found." }); return; }

  // Assign a secret random task not yet completed by this team
  const completedIds: number[] = team.completedTaskIds ?? [];
  const secretTask = await getRandomAvailableTask(completedIds);
  if (!secretTask) { res.status(400).json({ success: false, message: "No available tasks to assign for backstab. Try again later." }); return; }

  const bonusAp = ally.lastCompletedTaskAp; // AP to steal when backstab resolves

  await db.update(teamsTable).set({ activeTaskId: secretTask.id }).where(eq(teamsTable.id, team.id));
  await db.update(alliancesTable).set({
    backstabInProgress: true,
    backstabInitiatorId: team.id,
    backstabBonusAp: bonusAp,
  }).where(eq(alliancesTable.id, alliance.id));

  const [t] = await db.select().from(teamsTable).where(eq(teamsTable.id, team.id)).limit(1);

  res.json({
    success: true,
    message: `Betrayal initiated. Solve the secret task to complete your backstab against ${ally.name}. If they suspect you first, it will be foiled!`,
    secretTaskTitle: secretTask.title,
    teamState: formatTeamState(t),
  });
});

// ─── Suspicion Card ───────────────────────────────────────────────────────────
// Flow: Team B uses Suspicion → gets a secret random task → solves it →
//       if ally has a backstab in progress, the backstab is foiled.
//       If no backstab, they just earn the task AP.

router.post("/cards/suspicion", requireAuth, async (req, res): Promise<void> => {
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
  if (!team || team.allianceId == null) { res.status(400).json({ success: false, message: "You are not in an alliance. Nothing to suspect." }); return; }
  if (team.isEliminated) { res.status(400).json({ success: false, message: "Your kingdom has fallen." }); return; }
  if (team.activeTaskId != null) { res.status(400).json({ success: false, message: "Complete your current task before casting suspicion." }); return; }

  const [alliance] = await db.select().from(alliancesTable).where(
    and(eq(alliancesTable.id, team.allianceId), eq(alliancesTable.isActive, true))
  ).limit(1);

  if (!alliance) { res.status(400).json({ success: false, message: "Alliance not found." }); return; }
  if (alliance.suspicionInProgress && alliance.suspicionInitiatorId === team.id) {
    res.status(400).json({ success: false, message: "You are already casting suspicion. Solve your active task." });
    return;
  }

  const completedIds: number[] = team.completedTaskIds ?? [];
  const secretTask = await getRandomAvailableTask(completedIds);
  if (!secretTask) { res.status(400).json({ success: false, message: "No available tasks for suspicion. Try again later." }); return; }

  await db.update(teamsTable).set({ activeTaskId: secretTask.id }).where(eq(teamsTable.id, team.id));
  await db.update(alliancesTable).set({
    suspicionInProgress: true,
    suspicionInitiatorId: team.id,
  }).where(eq(alliancesTable.id, alliance.id));

  const [t] = await db.select().from(teamsTable).where(eq(teamsTable.id, team.id)).limit(1);
  const allyId = alliance.team1Id === team.id ? alliance.team2Id : alliance.team1Id;

  const isBackstabInProgress = alliance.backstabInProgress && alliance.backstabInitiatorId === allyId;

  res.json({
    success: true,
    message: isBackstabInProgress
      ? `Suspicion cast! Solve the secret task quickly to foil the potential betrayal!`
      : `Suspicion cast! Solve the secret task. If your ally is innocent, you'll still earn the task AP.`,
    teamState: formatTeamState(t),
  });
});

// ─── Abandon Task ─────────────────────────────────────────────────────────────

router.post("/cards/task/abandon", requireAuth, async (req, res): Promise<void> => {
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
  if (!team) { res.status(404).json({ success: false, message: "Team not found" }); return; }
  if (team.activeTaskId == null) { res.status(400).json({ success: false, message: "You have no active task to abandon." }); return; }

  const PENALTY = 50;
  const newAp = Math.max(0, team.ap - PENALTY);

  await db.update(teamsTable).set({ activeTaskId: null, ap: newAp }).where(eq(teamsTable.id, team.id));

  // If this was a backstab or suspicion task, clean up the alliance tracking
  if (team.allianceId != null) {
    const [alliance] = await db.select().from(alliancesTable).where(
      and(eq(alliancesTable.id, team.allianceId), eq(alliancesTable.isActive, true))
    ).limit(1);

    if (alliance) {
      const updates: Partial<typeof alliancesTable.$inferInsert> = {};
      if (alliance.backstabInProgress && alliance.backstabInitiatorId === team.id) {
        updates.backstabInProgress = false;
        updates.backstabInitiatorId = null;
        updates.backstabBonusAp = 0;
      }
      if (alliance.suspicionInProgress && alliance.suspicionInitiatorId === team.id) {
        updates.suspicionInProgress = false;
        updates.suspicionInitiatorId = null;
      }
      if (Object.keys(updates).length > 0) {
        await db.update(alliancesTable).set(updates as any).where(eq(alliancesTable.id, alliance.id));
      }
    }
  }

  await logEvent({
    type: "task_completed",
    fromTeamId: team.id, fromTeamName: team.name,
    description: `${team.name} surrendered their task and lost ${PENALTY} AP as penalty.`,
  });

  const [t] = await db.select().from(teamsTable).where(eq(teamsTable.id, team.id)).limit(1);
  res.json({
    success: true,
    message: `Task abandoned. ${PENALTY} AP deducted. You now have ${newAp} AP.`,
    teamState: formatTeamState(t),
  });
});

export default router;
