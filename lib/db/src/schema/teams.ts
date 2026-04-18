import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  members: text("members").array().notNull().default([]),
  hp: integer("hp").notNull().default(10000),
  ap: integer("ap").notNull().default(0),
  isEliminated: boolean("is_eliminated").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  allianceId: integer("alliance_id"),
  activeTaskId: integer("active_task_id"),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  attacksMade: integer("attacks_made").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
