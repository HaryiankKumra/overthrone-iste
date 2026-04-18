import crypto from "crypto";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "overthrone_salt_2024").digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function generateToken(teamId: number, teamName: string): string {
  const payload = `${teamId}:${teamName}:${Date.now()}`;
  const sig = crypto.createHmac("sha256", process.env.SESSION_SECRET || "dev-secret").update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64");
}

export function verifyToken(token: string): { teamId: number; teamName: string } | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length < 4) return null;
    const [teamIdStr, teamName, , sig] = parts;
    const payload = parts.slice(0, 3).join(":");
    const expectedSig = crypto.createHmac("sha256", process.env.SESSION_SECRET || "dev-secret").update(payload).digest("hex");
    if (sig !== expectedSig) return null;
    return { teamId: parseInt(teamIdStr, 10), teamName };
  } catch {
    return null;
  }
}
