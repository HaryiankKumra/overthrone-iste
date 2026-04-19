import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const resolveFrontendDistDir = (): string | null => {
  const candidates = [
    process.env.FRONTEND_DIST_DIR,
    path.resolve(process.cwd(), "artifacts", "overthrone", "dist", "public"),
    path.resolve(process.cwd(), "..", "overthrone", "dist", "public"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  return null;
};

const frontendDistDir = resolveFrontendDistDir();

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set in production.");
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use(router);

if (frontendDistDir) {
  app.use(express.static(frontendDistDir, { index: false }));
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
      next();
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }

    res.sendFile(path.join(frontendDistDir, "index.html"), (err) => {
      if (err) {
        next(err);
      }
    });
  });

  logger.info({ frontendDistDir }, "Serving frontend static assets");
}

// JSON error handler — must be last, after all routes
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  const status = (err as { status?: number; statusCode?: number }).status
    ?? (err as { status?: number; statusCode?: number }).statusCode
    ?? 500;
  res.status(status).json({ error: err.message ?? "Internal server error" });
});

export default app;
