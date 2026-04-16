import { Router } from "express";
import { randomBytes } from "crypto";
import { getDb } from "../../bot/db/database.js";
import { getSocket, isSocketConnected } from "../../bot/connection.js";
import { logger } from "../../lib/logger.js";

const router = Router();

const OTP_EXPIRY_SECONDS = 300;

function ensureWebTables() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS web_otps (
      phone TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS web_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS web_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      icon TEXT DEFAULT 'star',
      earned_at INTEGER DEFAULT (unixepoch())
    );
  `);
}

ensureWebTables();

function normalizePhone(raw: string): string | null {
  let cleaned = raw.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = "234" + cleaned.slice(1);
  if (cleaned.length < 7 || cleaned.length > 15) return null;
  return cleaned;
}

function getUserByPhone(phone: string) {
  const db = getDb();
  const jid = `${phone}@s.whatsapp.net`;
  const localAlt = phone.startsWith("234") ? "0" + phone.slice(3) : "";
  const row = db.prepare(
    "SELECT * FROM users WHERE id = ? OR id LIKE ? OR phone = ? OR phone = ? LIMIT 1"
  ).get(jid, `${phone}%`, phone, localAlt) as any;
  return row || null;
}

router.post("/otp/send", async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone) {
    res.status(400).json({ success: false, message: "Phone number is required" });
    return;
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    res.status(400).json({ success: false, message: "Invalid phone number format" });
    return;
  }

  const user = getUserByPhone(normalized);
  if (!user) {
    res.status(404).json({
      success: false,
      message: "This phone number is not registered with Shadow Garden. Join the WhatsApp group and use .register first.",
    });
    return;
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Math.floor(Date.now() / 1000) + OTP_EXPIRY_SECONDS;

  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO web_otps (phone, code, expires_at) VALUES (?, ?, ?)").run(normalized, code, expiresAt);

  const sock = getSocket();
  if (sock && isSocketConnected()) {
    try {
      const jid = `${normalized}@s.whatsapp.net`;
      await sock.sendMessage(jid, {
        text: `*Shadow Garden* — Your login code:\n\n*${code}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
      });
      logger.info({ phone: normalized }, "OTP sent via WhatsApp");
    } catch (err) {
      logger.error({ err }, "Failed to send OTP via WhatsApp");
      res.status(500).json({ success: false, message: "Failed to send OTP. Bot may be offline." });
      return;
    }
  } else {
    logger.warn("Bot not connected, cannot send OTP DM");
    res.status(500).json({ success: false, message: "Bot is currently offline. Please try again later." });
    return;
  }

  res.json({ success: true, message: "OTP sent to your WhatsApp" });
});

router.post("/otp/verify", (req, res) => {
  const { phone, code } = req.body as { phone?: string; code?: string };
  if (!phone || !code) {
    res.status(400).json({ success: false, message: "Phone and code are required" });
    return;
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    res.status(400).json({ success: false, message: "Invalid phone number" });
    return;
  }

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const otp = db.prepare("SELECT * FROM web_otps WHERE phone = ?").get(normalized) as any;

  if (!otp) {
    res.status(401).json({ success: false, message: "No OTP found. Please request a new code." });
    return;
  }

  if (otp.expires_at < now) {
    db.prepare("DELETE FROM web_otps WHERE phone = ?").run(normalized);
    res.status(401).json({ success: false, message: "OTP has expired. Please request a new code." });
    return;
  }

  if (otp.code !== code.trim()) {
    res.status(401).json({ success: false, message: "Incorrect code. Please try again." });
    return;
  }

  db.prepare("DELETE FROM web_otps WHERE phone = ?").run(normalized);

  const user = getUserByPhone(normalized);
  if (!user) {
    res.status(404).json({ success: false, message: "User not found." });
    return;
  }

  const token = randomBytes(32).toString("hex");
  const sessionExpiry = now + 30 * 24 * 3600;
  db.prepare("INSERT INTO web_sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, user.id, sessionExpiry);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name || "Shadow",
      phone: normalized,
      level: user.level || 1,
      xp: user.xp || 0,
      balance: user.balance || 0,
      bank: user.bank || 0,
      premium: user.premium || 0,
      bio: user.bio || "",
      registeredAt: user.created_at || 0,
    },
  });
});

export { router as authRouter };
