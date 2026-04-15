import app from "./app.js";
import { logger } from "./lib/logger.js";
import { connectToWhatsApp, isCredsRegistered } from "./bot/connection.js";
import { getDb } from "./bot/db/database.js";

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

  if (isCredsRegistered()) {
    // Credentials exist from a previous session — auto-reconnect
    logger.info("Existing WhatsApp credentials found — reconnecting...");
    try {
      await connectToWhatsApp(undefined);
    } catch (botErr) {
      logger.error({ botErr }, "Failed to auto-reconnect bot (use the admin page to reconnect)");
    }
  } else {
    logger.info("No WhatsApp credentials found — use the admin page at /admin to connect the bot");
  }
});
