import { Router } from "express";
import type { IRouter } from "express";
import { db, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken } from "../lib/auth.js";
import { requireAuth } from "../middlewares/auth.js";
import { RegisterTeamBody, LoginTeamBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterTeamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, password, members } = parsed.data;

  const [existing] = await db.select().from(teamsTable).where(eq(teamsTable.name, name)).limit(1);
  if (existing) {
    res.status(400).json({ error: "Team name already taken" });
    return;
  }

  const passwordHash = hashPassword(password);
  const [team] = await db.insert(teamsTable).values({
    name,
    passwordHash,
    members: members || [],
  }).returning();

  const token = generateToken(team.id, team.name);

  res.status(201).json({
    team: {
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
    },
    token,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginTeamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, password } = parsed.data;

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.name, name)).limit(1);
  if (!team || !verifyPassword(password, team.passwordHash)) {
    res.status(401).json({ error: "Invalid team name or password" });
    return;
  }

  const token = generateToken(team.id, team.name);

  res.json({
    team: {
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
    },
    token,
  });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, req.team!.id)).limit(1);
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  res.json({
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
  });
});

export default router;
