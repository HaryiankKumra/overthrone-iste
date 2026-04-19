import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth.js";
import { db, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      team?: {
        id: number;
        name: string;
        isAdmin: boolean;
        isEliminated: boolean;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const [team] = await db.select({
    id: teamsTable.id,
    name: teamsTable.name,
    isAdmin: teamsTable.isAdmin,
    isEliminated: teamsTable.isEliminated,
  }).from(teamsTable).where(eq(teamsTable.id, payload.teamId)).limit(1);

  if (!team) {
    res.status(401).json({ error: "Team not found" });
    return;
  }

  req.team = team;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    if (!req.team?.isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}
