import { Router } from "express";
import type { IRouter } from "express";
import { db, teamsTable, tasksTable, alliancesTable, allianceRequestsTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { UseTaskCardBody, UseAttackCardBody, UseAllianceCardBody, RespondToAllianceBody } from "@workspace/api-zod";
import { broadcast } from "../lib/ws";
import { logEvent } from "../lib/gameEvents";

const router: IRouter = Router();

router.post("/cards/task", requireAuth, async (req, res): Promise<void> => {
  const body = UseTaskCardBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message, success: false, message: body.error.message });
    return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
  if (!team) {
    res.status(404).json({ success: false, message: "Team not found" });
    return;
  }

  if (team.isEliminated) {
    res.status(400).json({ success: false, message: "Your kingdom has fallen. You cannot act." });
    return;
  }

  if (team.activeTaskId != null) {
    res.status(400).json({ success: false, message: "You already have an active task. Finish it first." });
    return;
  }

  const [task] = await db.select().from(tasksTable).where(
    and(eq(tasksTable.id, body.data.taskId), eq(tasksTable.isActive, true))
  ).limit(1);

  if (!task) {
    res.status(404).json({ success: false, message: "Task not found or inactive" });
    return;
  }

  await db.update(teamsTable).set({ activeTaskId: task.id }).where(eq(teamsTable.id, team.id));

  const updatedTeam = await db.select().from(teamsTable).where(eq(teamsTable.id, team.id)).limit(1);
  const t = updatedTeam[0];

  res.json({
    success: true,
    message: `Task "${task.title}" is now active. Solve it to earn ${task.apReward} AP.`,
    teamState: {
      id: t.id, name: t.name, hp: t.hp, ap: t.ap, members: t.members,
      isEliminated: t.isEliminated, allianceId: t.allianceId ?? null,
      activeTaskId: t.activeTaskId ?? null, isAdmin: t.isAdmin,
      createdAt: t.createdAt.toISOString(),
    },
  });
});

router.post("/cards/attack", requireAuth, async (req, res): Promise<void> => {
  const body = UseAttackCardBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message, success: false, message: body.error.message });
    return;
  }

  const [attacker] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
  if (!attacker || attacker.isEliminated) {
    res.status(400).json({ success: false, message: "Cannot attack - your kingdom has fallen." });
    return;
  }

  const [target] = await db.select().from(teamsTable).where(eq(teamsTable.id, body.data.targetTeamId)).limit(1);
  if (!target || target.isEliminated) {
    res.status(400).json({ success: false, message: "Target team not found or already eliminated." });
    return;
  }

  if (target.id === attacker.id) {
    res.status(400).json({ success: false, message: "You cannot attack yourself." });
    return;
  }

  if (attacker.allianceId && attacker.allianceId === target.allianceId) {
    res.status(400).json({ success: false, message: "You cannot attack your alliance partner. Use Backstab Card for that." });
    return;
  }

  const apSpent = body.data.apSpent;
  if (apSpent > attacker.ap) {
    res.status(400).json({ success: false, message: `Insufficient AP. You have ${attacker.ap} AP.` });
    return;
  }

  if (apSpent <= 0) {
    res.status(400).json({ success: false, message: "Must spend at least 1 AP to attack." });
    return;
  }

  const damageDealt = apSpent;
  const newTargetHp = Math.max(0, target.hp - damageDealt);
  const newAttackerAp = attacker.ap - apSpent;

  await db.update(teamsTable).set({
    ap: newAttackerAp,
    attacksMade: attacker.attacksMade + 1,
  }).where(eq(teamsTable.id, attacker.id));

  const wasEliminated = newTargetHp === 0;
  await db.update(teamsTable).set({
    hp: newTargetHp,
    isEliminated: wasEliminated,
    allianceId: wasEliminated ? null : target.allianceId,
  }).where(eq(teamsTable.id, target.id));

  await logEvent({
    type: "attack",
    fromTeamId: attacker.id,
    fromTeamName: attacker.name,
    toTeamId: target.id,
    toTeamName: target.name,
    description: `${attacker.name} unleashed ${damageDealt} damage upon ${target.name}!${wasEliminated ? " The kingdom has fallen!" : ""}`,
  });

  if (wasEliminated) {
    await logEvent({
      type: "team_eliminated",
      toTeamId: target.id,
      toTeamName: target.name,
      description: `${target.name} has been eliminated from the war!`,
    });
  }

  broadcast("leaderboard", null);
  broadcast("mapData", null);

  res.json({
    success: true,
    message: wasEliminated
      ? `${target.name} has been destroyed! Their kingdom falls!`
      : `Attack successful! Dealt ${damageDealt} damage to ${target.name}.`,
    damageDealt,
    apSpent,
    targetTeamId: target.id,
    targetTeamName: target.name,
  });
});

router.post("/cards/alliance", requireAuth, async (req, res): Promise<void> => {
  const body = UseAllianceCardBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ success: false, message: body.error.message });
    return;
  }

  const [requester] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
  const [target] = await db.select().from(teamsTable).where(eq(teamsTable.id, body.data.targetTeamId)).limit(1);

  if (!requester || !target) {
    res.status(404).json({ success: false, message: "Team not found" });
    return;
  }

  if (requester.allianceId != null) {
    res.status(400).json({ success: false, message: "You are already in an alliance." });
    return;
  }

  if (target.allianceId != null) {
    res.status(400).json({ success: false, message: "Target team is already in an alliance." });
    return;
  }

  await db.insert(allianceRequestsTable).values({
    fromTeamId: requester.id,
    toTeamId: target.id,
    status: "pending",
  });

  await logEvent({
    type: "alliance_formed",
    fromTeamId: requester.id,
    fromTeamName: requester.name,
    toTeamId: target.id,
    toTeamName: target.name,
    description: `${requester.name} has sent an alliance proposal to ${target.name}!`,
  });

  const t = requester;
  res.json({
    success: true,
    message: `Alliance request sent to ${target.name}. Await their response.`,
    teamState: {
      id: t.id, name: t.name, hp: t.hp, ap: t.ap, members: t.members,
      isEliminated: t.isEliminated, allianceId: t.allianceId ?? null,
      activeTaskId: t.activeTaskId ?? null, isAdmin: t.isAdmin,
      createdAt: t.createdAt.toISOString(),
    },
  });
});

router.post("/cards/alliance/respond", requireAuth, async (req, res): Promise<void> => {
  const body = RespondToAllianceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ success: false, message: body.error.message });
    return;
  }

  const [request] = await db.select().from(allianceRequestsTable).where(
    and(
      eq(allianceRequestsTable.fromTeamId, body.data.requestingTeamId),
      eq(allianceRequestsTable.toTeamId, req.team!.id),
      eq(allianceRequestsTable.status, "pending")
    )
  ).limit(1);

  if (!request) {
    res.status(404).json({ success: false, message: "Alliance request not found." });
    return;
  }

  if (!body.data.accept) {
    await db.update(allianceRequestsTable).set({ status: "rejected" }).where(eq(allianceRequestsTable.id, request.id));
    const [t] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
    res.json({
      success: true,
      message: "Alliance request rejected.",
      teamState: {
        id: t.id, name: t.name, hp: t.hp, ap: t.ap, members: t.members,
        isEliminated: t.isEliminated, allianceId: t.allianceId ?? null,
        activeTaskId: t.activeTaskId ?? null, isAdmin: t.isAdmin,
        createdAt: t.createdAt.toISOString(),
      },
    });
    return;
  }

  const [team1] = await db.select().from(teamsTable).where(eq(teamsTable.id, body.data.requestingTeamId)).limit(1);
  const [team2] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);

  if (!team1 || !team2) {
    res.status(404).json({ success: false, message: "Team not found" });
    return;
  }

  const [alliance] = await db.insert(alliancesTable).values({
    team1Id: team1.id,
    team2Id: team2.id,
  }).returning();

  await db.update(teamsTable).set({ allianceId: alliance.id }).where(eq(teamsTable.id, team1.id));
  await db.update(teamsTable).set({ allianceId: alliance.id }).where(eq(teamsTable.id, team2.id));
  await db.update(allianceRequestsTable).set({ status: "accepted" }).where(eq(allianceRequestsTable.id, request.id));

  await logEvent({
    type: "alliance_formed",
    fromTeamId: team1.id,
    fromTeamName: team1.name,
    toTeamId: team2.id,
    toTeamName: team2.name,
    description: `${team1.name} and ${team2.name} have forged an alliance! Their kingdoms are now one!`,
  });

  broadcast("leaderboard", null);
  broadcast("mapData", null);

  const [t] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
  res.json({
    success: true,
    message: `Alliance formed with ${team1.name}! You now fight as one.`,
    teamState: {
      id: t.id, name: t.name, hp: t.hp, ap: t.ap, members: t.members,
      isEliminated: t.isEliminated, allianceId: t.allianceId ?? null,
      activeTaskId: t.activeTaskId ?? null, isAdmin: t.isAdmin,
      createdAt: t.createdAt.toISOString(),
    },
  });
});

router.post("/cards/backstab", requireAuth, async (req, res): Promise<void> => {
  const [attacker] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);

  if (!attacker || attacker.allianceId == null) {
    res.status(400).json({ success: false, message: "You are not in an alliance. Cannot backstab." });
    return;
  }

  const [alliance] = await db.select().from(alliancesTable).where(
    and(eq(alliancesTable.id, attacker.allianceId), eq(alliancesTable.isActive, true))
  ).limit(1);

  if (!alliance) {
    res.status(400).json({ success: false, message: "Alliance not found or already dissolved." });
    return;
  }

  const allyId = alliance.team1Id === attacker.id ? alliance.team2Id : alliance.team1Id;
  const [ally] = await db.select().from(teamsTable).where(eq(teamsTable.id, allyId)).limit(1);

  if (!ally) {
    res.status(404).json({ success: false, message: "Ally not found." });
    return;
  }

  const stolenAp = Math.floor(ally.ap * 0.5);
  await db.update(teamsTable).set({
    ap: attacker.ap + stolenAp,
    allianceId: null,
  }).where(eq(teamsTable.id, attacker.id));
  await db.update(teamsTable).set({
    ap: ally.ap - stolenAp,
    allianceId: null,
  }).where(eq(teamsTable.id, ally.id));
  await db.update(alliancesTable).set({
    isActive: false,
    backstabbedBy: attacker.id,
    dissolvedAt: new Date(),
  }).where(eq(alliancesTable.id, alliance.id));

  await logEvent({
    type: "backstab",
    fromTeamId: attacker.id,
    fromTeamName: attacker.name,
    toTeamId: ally.id,
    toTeamName: ally.name,
    description: `BETRAYAL! ${attacker.name} has backstabbed ${ally.name}! Stole ${stolenAp} AP and shattered the alliance!`,
  });

  broadcast("leaderboard", null);
  broadcast("mapData", null);

  const [t] = await db.select().from(teamsTable).where(eq(teamsTable.id, attacker.id)).limit(1);
  res.json({
    success: true,
    message: `Betrayal complete! You stole ${stolenAp} AP from ${ally.name} and broke the alliance.`,
    teamState: {
      id: t.id, name: t.name, hp: t.hp, ap: t.ap, members: t.members,
      isEliminated: t.isEliminated, allianceId: t.allianceId ?? null,
      activeTaskId: t.activeTaskId ?? null, isAdmin: t.isAdmin,
      createdAt: t.createdAt.toISOString(),
    },
  });
});

router.post("/cards/suspicion", requireAuth, async (req, res): Promise<void> => {
  const [accuser] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);

  if (!accuser || accuser.allianceId == null) {
    res.status(400).json({ success: false, message: "You are not in an alliance. Nothing to suspect." });
    return;
  }

  const [alliance] = await db.select().from(alliancesTable).where(
    eq(alliancesTable.id, accuser.allianceId)
  ).limit(1);

  if (!alliance) {
    res.status(400).json({ success: false, message: "Alliance not found." });
    return;
  }

  const allyId = alliance.team1Id === accuser.id ? alliance.team2Id : alliance.team1Id;
  const wasBackstabbed = alliance.backstabbedBy === allyId;

  if (wasBackstabbed) {
    await db.update(teamsTable).set({ isEliminated: true, allianceId: null }).where(eq(teamsTable.id, allyId));
    await logEvent({
      type: "suspicion",
      fromTeamId: accuser.id,
      fromTeamName: accuser.name,
      toTeamId: allyId,
      description: `${accuser.name}'s suspicion was CORRECT! The traitor has been eliminated!`,
    });
    res.json({ correct: true, message: "Your suspicion was correct! The traitor has been eliminated.", accusingTeamEliminated: false, accusedTeamEliminated: true });
  } else {
    await db.update(teamsTable).set({ isEliminated: true, allianceId: null }).where(eq(teamsTable.id, accuser.id));
    await logEvent({
      type: "suspicion",
      fromTeamId: accuser.id,
      fromTeamName: accuser.name,
      description: `${accuser.name} accused an innocent ally and has been DISQUALIFIED!`,
    });
    res.json({ correct: false, message: "Your accusation was false! Your kingdom has been struck down for dishonor.", accusingTeamEliminated: true, accusedTeamEliminated: false });
  }

  broadcast("leaderboard", null);
  broadcast("mapData", null);
});

router.post("/cards/task/abandon", requireAuth, async (req, res): Promise<void> => {
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);

  if (!team) {
    res.status(404).json({ success: false, message: "Team not found" });
    return;
  }

  if (team.activeTaskId == null) {
    res.status(400).json({ success: false, message: "You have no active task to abandon." });
    return;
  }

  const PENALTY = 50;
  const newAp = Math.max(0, team.ap - PENALTY);

  await db.update(teamsTable).set({
    activeTaskId: null,
    ap: newAp,
  }).where(eq(teamsTable.id, team.id));

  await logEvent({
    type: "task_completed",
    fromTeamId: team.id,
    fromTeamName: team.name,
    description: `${team.name} abandoned their task and lost ${PENALTY} AP as penalty.`,
  });

  const [updated] = await db.select().from(teamsTable).where(eq(teamsTable.id, team.id)).limit(1);
  const t = updated;

  res.json({
    success: true,
    message: `Task abandoned. ${PENALTY} AP deducted as penalty. You now have ${newAp} AP.`,
    teamState: {
      id: t.id, name: t.name, hp: t.hp, ap: t.ap, members: t.members,
      isEliminated: t.isEliminated, allianceId: t.allianceId ?? null,
      activeTaskId: t.activeTaskId ?? null, isAdmin: t.isAdmin,
      createdAt: t.createdAt.toISOString(),
    },
  });
});

export default router;
