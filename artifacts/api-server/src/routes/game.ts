import { Router } from "express";
import type { IRouter } from "express";
import { db, gameStateTable, teamsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth.js";
import { broadcast } from "../lib/ws.js";
import { logEvent } from "../lib/gameEvents.js";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

async function getOrCreateGameState() {
  const [state] = await db.select().from(gameStateTable).limit(1);
  if (state) return state;
  const [newState] = await db.insert(gameStateTable).values({}).returning();
  return newState;
}

function formatGameState(state: typeof gameStateTable.$inferSelect) {
  return {
    status: state.status,
    currentEpoch: state.currentEpoch,
    epochStartedAt: state.epochStartedAt?.toISOString() ?? null,
    epochEndsAt: state.epochEndsAt?.toISOString() ?? null,
    epochDurationSeconds: state.epochDurationSeconds,
    totalEpochs: state.totalEpochs,
    phase: state.phase,
  };
}

router.get("/game/state", async (_req, res): Promise<void> => {
  const state = await getOrCreateGameState();
  res.json(formatGameState(state));
});

router.post("/game/start", requireAdmin, async (_req, res): Promise<void> => {
  const state = await getOrCreateGameState();
  const now = new Date();
  const epochEnd = new Date(now.getTime() + state.epochDurationSeconds * 1000);

  const [updated] = await db.update(gameStateTable).set({
    status: "active",
    currentEpoch: 1,
    epochStartedAt: now,
    epochEndsAt: epochEnd,
    phase: "task",
  }).returning();

  await logEvent({ type: "attack", description: "The war has begun. Epoch 1 has started!", fromTeamName: "ISTE Admin" });

  const formatted = formatGameState(updated);
  broadcast("gameState", formatted);
  res.json(formatted);
});

router.post("/game/reset", requireAdmin, async (_req, res): Promise<void> => {
  await db.update(gameStateTable).set({
    status: "waiting",
    currentEpoch: 0,
    epochStartedAt: null,
    epochEndsAt: null,
    phase: "task",
  });

  await db.update(teamsTable).set({
    hp: 10000,
    ap: 0,
    isEliminated: false,
    allianceId: null,
    activeTaskId: null,
    tasksCompleted: 0,
    attacksMade: 0,
  });

  broadcast("gameState", { status: "waiting", currentEpoch: 0, phase: "task" });
  res.json({ success: true });
});

router.post("/game/advance-epoch", requireAdmin, async (_req, res): Promise<void> => {
  const state = await getOrCreateGameState();
  const now = new Date();
  const nextEpoch = state.currentEpoch + 1;
  const isLastEpoch = nextEpoch > state.totalEpochs;

  let updateData: Partial<typeof gameStateTable.$inferInsert>;

  if (isLastEpoch) {
    updateData = { status: "ended", phase: "task" };
    await logEvent({ type: "attack", description: "The war is over. Long live the victors!" });
  } else {
    const epochEnd = new Date(now.getTime() + state.epochDurationSeconds * 1000);
    updateData = {
      currentEpoch: nextEpoch,
      epochStartedAt: now,
      epochEndsAt: epochEnd,
      phase: "task",
      status: "active",
    };
    await logEvent({ type: "attack", description: `Epoch ${nextEpoch} begins. Sharpen your blades.` });
  }

  const [updated] = await db.update(gameStateTable).set(updateData).returning();
  const formatted = formatGameState(updated);
  broadcast("gameState", formatted);
  res.json(formatted);
});

export default router;
