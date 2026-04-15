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
import { logger } from "../lib/logger.js";

const router = express.Router();

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

// POST /api/bot/start — start the bot (optionally provide phone number for pairing)
router.post("/start", async (req, res) => {
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

// POST /api/bot/pairing — request a pairing code for the given phone number
router.post("/pairing", async (req, res) => {
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

// POST /api/bot/disconnect — logout and disconnect
router.post("/disconnect", async (_req, res) => {
  const sock = getSocket();
  if (sock) {
    try {
      await sock.logout();
    } catch { /* ignore */ }
  }
  res.json({ success: true, message: "Disconnected" });
});

// POST /api/bot/clear — wipe all auth data (force re-pair next time)
router.post("/clear", (_req, res) => {
  clearAuth();
  res.json({ success: true, message: "Auth data cleared — ready for fresh pairing" });
});

export { router as botRouter };
