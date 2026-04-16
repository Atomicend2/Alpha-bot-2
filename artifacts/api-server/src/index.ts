import app from "./app.js";
import { logger } from "./lib/logger.js";
import { getDb } from "./bot/db/database.js";
import { SessionManager } from "./bot/session-manager.js";
import http from "http";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

getDb();
logger.info("Database initialized");

app.listen(port, async (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  const primary = SessionManager.getPrimary();
  if (primary.isCredsRegistered()) {
    logger.info("Existing primary bot credentials found — reconnecting...");
    primary.connect().catch(e => logger.error({ e }, "Primary bot auto-connect failed"));
  } else {
    logger.info("No primary bot credentials — use the admin page at /admin to connect");
  }

  const db = getDb();
  let bots: any[] = [];
  try {
    bots = db.prepare("SELECT id, phone FROM bots").all() as any[];
  } catch {}

  for (const bot of bots) {
    const session = SessionManager.addSession(bot.id);
    if (session.isCredsRegistered()) {
      logger.info({ id: bot.id }, "Auto-starting registered bot session");
      session.connect(bot.phone || undefined).catch(e => {
        logger.error({ e, id: bot.id }, "Bot session auto-start failed");
      });
    }
  }

  const PING_INTERVAL_MS = 4 * 60 * 1000;
  setInterval(() => {
    try {
      http.get(`http://localhost:${port}/api/healthz`, (res) => { res.resume(); })
        .on("error", () => {});
    } catch {}
  }, PING_INTERVAL_MS);
  logger.info({ intervalMs: PING_INTERVAL_MS }, "Keep-alive ping scheduled");
});
