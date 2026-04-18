import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gameStateTable = pgTable("game_state", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("waiting"),
  currentEpoch: integer("current_epoch").notNull().default(0),
  epochStartedAt: timestamp("epoch_started_at", { withTimezone: true }),
  epochEndsAt: timestamp("epoch_ends_at", { withTimezone: true }),
  epochDurationSeconds: integer("epoch_duration_seconds").notNull().default(900),
  totalEpochs: integer("total_epochs").notNull().default(16),
  phase: text("phase").notNull().default("task"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const alliancesTable = pgTable("alliances", {
  id: serial("id").primaryKey(),
  team1Id: integer("team1_id").notNull(),
  team2Id: integer("team2_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  backstabbedBy: integer("backstabbed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  dissolvedAt: timestamp("dissolved_at", { withTimezone: true }),
});

export const allianceRequestsTable = pgTable("alliance_requests", {
  id: serial("id").primaryKey(),
  fromTeamId: integer("from_team_id").notNull(),
  toTeamId: integer("to_team_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameEventsTable = pgTable("game_events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  fromTeamId: integer("from_team_id"),
  fromTeamName: text("from_team_name"),
  toTeamId: integer("to_team_id"),
  toTeamName: text("to_team_name"),
  description: text("description").notNull(),
  epoch: integer("epoch").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGameEventSchema = createInsertSchema(gameEventsTable).omit({ id: true, createdAt: true });
export type InsertGameEvent = z.infer<typeof insertGameEventSchema>;
export type GameEvent = typeof gameEventsTable.$inferSelect;
