import express from "express";
import {
  connectToWhatsApp,
  getSocket,
  isSocketConnected,
  isSocketConnecting,
  getPairingCode,
  rememberPairingPhoneNumber,
  isCredsRegistered,
  clearAuth,
} from "../bot/connection.js";
import { getAllBots, addBot, removeBot, getAllFrames, getFrame, addFrame, removeFrame } from "../bot/db/queries.js";
import { getDb } from "../bot/db/database.js";
import { logger } from "../lib/logger.js";
import { randomUUID } from "crypto";

const router = express.Router();

const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] || "Admin";

function requireAdminPassword(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const password =
    (req.headers["x-admin-password"] as string) ||
    req.body?.adminPassword ||
    (req.query["adminPassword"] as string);
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ success: false, message: "Invalid admin password." });
    return;
  }
  next();
}

// GET /api/bot/status — returns current bot status
router.get("/status", (_req, res) => {
  const sock = getSocket();
  res.json({
    connected: isSocketConnected(),
    connecting: isSocketConnecting(),
    pairingCode: getPairingCode(),
    credsRegistered: isCredsRegistered(),
    botId: sock?.user?.id || null,
    botName: sock?.user?.name || null,
  });
});

// POST /api/bot/verify-password — verify admin password
router.post("/verify-password", (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ success: false, message: "Invalid password." });
    return;
  }
  res.json({ success: true, message: "Password accepted." });
});

// POST /api/bot/start — start the bot (requires admin password)
router.post("/start", requireAdminPassword, async (req, res) => {
  if (isSocketConnected() || isSocketConnecting()) {
    res.json({
      success: true,
      message: isSocketConnected() ? "Bot already connected" : "Bot already connecting",
    });
    return;
  }

  const { phone } = req.body as { phone?: string };
  const rememberedPhone = rememberPairingPhoneNumber(phone);

  try {
    connectToWhatsApp(rememberedPhone || undefined).catch((err) => {
      logger.error({ err }, "Bot connection error");
    });
    res.json({ success: true, message: "Bot starting...", phone: rememberedPhone || null });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/bot/pairing — request a pairing code (requires admin password)
router.post("/pairing", requireAdminPassword, async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone) {
    res.status(400).json({ success: false, message: "Phone number required" });
    return;
  }

  const sock = getSocket();
  if (!sock) {
    res.status(400).json({
      success: false,
      message: "Bot not started. Call /api/bot/start first.",
    });
    return;
  }

  try {
    const normalized = rememberPairingPhoneNumber(phone);
    if (!normalized) {
      res.status(400).json({ success: false, message: "Valid phone number required" });
      return;
    }
    const code = await sock.requestPairingCode(normalized);
    res.json({ success: true, code });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/bot/disconnect — logout and disconnect (requires admin password)
router.post("/disconnect", requireAdminPassword, async (_req, res) => {
  const sock = getSocket();
  if (sock) {
    try {
      await sock.logout();
    } catch { /* ignore */ }
  }
  res.json({ success: true, message: "Disconnected" });
});

// POST /api/bot/clear — wipe all auth data (requires admin password)
router.post("/clear", requireAdminPassword, (_req, res) => {
  clearAuth();
  res.json({ success: true, message: "Auth data cleared — ready for fresh pairing" });
});

// GET /api/bot/bots — list all registered bots (no auth required for read)
router.get("/bots", (_req, res) => {
  const bots = getAllBots();
  const sock = getSocket();
  const connectedPhone = sock?.user?.id?.split(":")[0]?.split("@")[0] || null;

  const list = bots.map((b: any) => ({
    id: b.id,
    name: b.name,
    phone: b.phone || "",
    status: (connectedPhone && b.phone && b.phone === connectedPhone) ? "online" : (b.status || "offline"),
    createdAt: b.created_at || 0,
  }));

  // Show currently connected bot at top (if any, even if not in list)
  const activeConnected = isSocketConnected();
  const botName = sock?.user?.name;
  const botPhone = connectedPhone;
  const alreadyInList = list.some((b: any) => b.phone === botPhone);

  if (activeConnected && botPhone && !alreadyInList) {
    list.unshift({
      id: "__active__",
      name: botName || "Active Bot",
      phone: botPhone,
      status: "online",
      createdAt: 0,
    });
  }

  res.json({ bots: list });
});

// POST /api/bot/bots — add a new bot profile (requires admin password)
// Accepts JSON: { adminPassword, name, phone, imageBase64? }
router.post("/bots", requireAdminPassword, (req, res) => {
  const { name, phone, imageBase64 } = req.body as {
    name?: string;
    phone?: string;
    imageBase64?: string;
  };

  if (!name || !name.trim()) {
    res.status(400).json({ success: false, message: "Bot name is required." });
    return;
  }

  const id = randomUUID();
  let imageData: Buffer | undefined;
  if (imageBase64) {
    try {
      imageData = Buffer.from(imageBase64, "base64");
    } catch {
      // ignore invalid base64
    }
  }

  try {
    addBot(id, name.trim(), (phone || "").replace(/\D/g, ""), imageData);
    res.json({ success: true, message: "Bot registered successfully.", id });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/bot/bots/:id/image — update a bot's image
router.patch("/bots/:id/image", requireAdminPassword, (req, res) => {
  const { id } = req.params;
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) {
    res.status(400).json({ success: false, message: "imageBase64 is required." });
    return;
  }
  let imageData: Buffer;
  try {
    imageData = Buffer.from(imageBase64, "base64");
  } catch {
    res.status(400).json({ success: false, message: "Invalid base64 image data." });
    return;
  }
  try {
    const db = getDb();
    const result = db.prepare("UPDATE bots SET image_data = ? WHERE id = ?").run(imageData, id);
    if (result.changes === 0) {
      res.status(404).json({ success: false, message: "Bot not found." });
      return;
    }
    res.json({ success: true, message: "Bot image updated." });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/bot/bots/:id — remove a bot (requires admin password via x-admin-password header)
router.delete("/bots/:id", requireAdminPassword, (req, res) => {
  const { id } = req.params;
  try {
    removeBot(id);
    res.json({ success: true, message: "Bot removed." });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bot/bots/:id/image — serve a bot's image
router.get("/bots/:id/image", (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const row = db.prepare("SELECT image_data FROM bots WHERE id = ?").get(id) as any;
    if (!row || !row.image_data) {
      res.status(404).json({ success: false, message: "No image." });
      return;
    }
    const buf = Buffer.isBuffer(row.image_data) ? row.image_data : Buffer.from(row.image_data);
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(buf);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── FRAME ROUTES ──────────────────────────────────────────────────────────────

// GET /api/bot/frames — list all profile frames
router.get("/frames", (_req, res) => {
  try {
    const frames = getAllFrames();
    res.json({ frames: frames.map((f: any) => ({ id: f.id, name: f.name, createdAt: f.created_at || 0 })) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bot/frames/:id/image — serve a frame image
router.get("/frames/:id/image", (req, res) => {
  const { id } = req.params;
  try {
    const frame = getFrame(id);
    if (!frame || !frame.image_data) {
      res.status(404).json({ success: false, message: "Frame not found." });
      return;
    }
    const buf = Buffer.isBuffer(frame.image_data) ? frame.image_data : Buffer.from(frame.image_data);
    const isSvg = buf.slice(0, 5).toString().trimStart().startsWith("<");
    res.set("Content-Type", isSvg ? "image/svg+xml" : "image/png");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(buf);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/bot/frames — add a new frame (admin only)
router.post("/frames", requireAdminPassword, (req, res) => {
  const { name, imageBase64 } = req.body as { name?: string; imageBase64?: string };
  if (!name?.trim()) {
    res.status(400).json({ success: false, message: "Frame name is required." });
    return;
  }
  if (!imageBase64) {
    res.status(400).json({ success: false, message: "Frame image (imageBase64) is required." });
    return;
  }
  let imageData: Buffer;
  try {
    imageData = Buffer.from(imageBase64, "base64");
  } catch {
    res.status(400).json({ success: false, message: "Invalid base64 image data." });
    return;
  }
  try {
    const id = randomUUID();
    addFrame(id, name.trim(), imageData);
    res.json({ success: true, message: "Frame added.", id });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/bot/frames/:id — remove a frame (admin only)
router.delete("/frames/:id", requireAdminPassword, (req, res) => {
  const { id } = req.params;
  try {
    removeFrame(id);
    res.json({ success: true, message: "Frame removed." });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export { router as botRouter };
