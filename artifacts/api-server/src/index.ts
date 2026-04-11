import app from "./app.js";
import { logger } from "./lib/logger.js";
import { connectToWhatsApp } from "./bot/connection.js";
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

  const phone = process.env["BOT_PHONE_NUMBER"];
  try {
    logger.info("Starting WhatsApp bot...");
    await connectToWhatsApp(phone || undefined);
  } catch (botErr) {
    logger.error({ botErr }, "Failed to start bot (will retry automatically)");
  }
});
