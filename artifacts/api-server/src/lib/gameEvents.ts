import { db, gameEventsTable, gameStateTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { broadcast } from "./ws.js";

export async function logEvent(data: {
  type: string;
  fromTeamId?: number | null;
  fromTeamName?: string | null;
  toTeamId?: number | null;
  toTeamName?: string | null;
  description: string;
}) {
  const [gameState] = await db.select({ currentEpoch: gameStateTable.currentEpoch }).from(gameStateTable).limit(1);
  const epoch = gameState?.currentEpoch ?? 0;
  await db.insert(gameEventsTable).values({ ...data, epoch });
  broadcast("recentEvents", null);
}

export async function getRecentEvents(limit = 50) {
  return db.select().from(gameEventsTable).orderBy(desc(gameEventsTable.createdAt)).limit(limit);
}
