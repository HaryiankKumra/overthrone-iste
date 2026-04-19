import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { logger } from "./logger.js";

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function initWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);
    logger.info({ clientCount: clients.size }, "WebSocket client connected");

    ws.on("close", () => {
      clients.delete(ws);
      logger.info({ clientCount: clients.size }, "WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
      clients.delete(ws);
    });
  });

  logger.info("WebSocket server initialized on /ws");
}

export function broadcast(type: string, data: unknown) {
  if (!wss) return;
  const message = JSON.stringify({ type, data });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}
