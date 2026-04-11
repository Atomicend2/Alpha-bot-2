import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  type WASocket,
  type BaileysEventMap,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { logger } from "../lib/logger.js";
import { handleMessage } from "./handlers/message.js";
import { handleGroupUpdate, handleGroupParticipantsUpdate } from "./handlers/group.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, "../../..", "data", "auth");

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

export const BOT_OWNER_LID = "236713549029502";
export const PREFIX = ".";

let sock: WASocket | null = null;
let isConnected = false;
let pairingCode: string | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

export function getSocket(): WASocket | null {
  return sock;
}

export function isSocketConnected(): boolean {
  return isConnected;
}

export function getPairingCode(): string | null {
  return pairingCode;
}

export async function connectToWhatsApp(phoneNumber?: string): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const silentLogger = {
    level: "silent" as const,
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
    child: () => silentLogger,
  };

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
    },
    printQRInTerminal: false,
    logger: silentLogger,
    browser: ["Shadow Garden Bot", "Chrome", "1.0.0"],
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    retryRequestDelayMs: 1000,
    maxMsgRetryCount: 5,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
  });

  if (!state.creds.registered && phoneNumber) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    try {
      const code = await sock.requestPairingCode(phoneNumber.replace(/\D/g, ""));
      pairingCode = code;
      logger.info({ code }, "Pairing code generated");
    } catch (err) {
      logger.error({ err }, "Failed to request pairing code");
    }
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      isConnected = false;
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
        reconnectAttempts++;
        logger.info({ delay, attempt: reconnectAttempts }, "Reconnecting to WhatsApp...");
        setTimeout(() => {
          connectToWhatsApp();
        }, delay);
      } else {
        logger.info("Logged out from WhatsApp");
        pairingCode = null;
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }
    } else if (connection === "open") {
      isConnected = true;
      reconnectAttempts = 0;
      pairingCode = null;
      logger.info("Connected to WhatsApp successfully");
    } else if (connection === "connecting") {
      logger.info("Connecting to WhatsApp...");
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    if (m.type !== "notify") return;
    for (const msg of m.messages) {
      if (!msg.message) continue;
      try {
        await handleMessage(sock!, msg);
      } catch (err) {
        logger.error({ err }, "Error handling message");
      }
    }
  });

  sock.ev.on("group-participants.update", async (update) => {
    try {
      await handleGroupParticipantsUpdate(sock!, update);
    } catch (err) {
      logger.error({ err }, "Error handling group participants update");
    }
  });

  sock.ev.on("groups.update", async (updates) => {
    try {
      await handleGroupUpdate(sock!, updates);
    } catch (err) {
      logger.error({ err }, "Error handling groups update");
    }
  });

  return sock;
}

export async function sendMessage(jid: string, content: any, options?: any) {
  if (!sock) throw new Error("Socket not initialized");
  return sock.sendMessage(jid, content, options);
}

export async function sendText(jid: string, text: string, mentions?: string[]) {
  if (!sock) throw new Error("Socket not initialized");
  return sock.sendMessage(jid, { text, mentions: mentions || [] });
}

export async function sendImage(jid: string, imageBuffer: Buffer, caption?: string) {
  if (!sock) throw new Error("Socket not initialized");
  return sock.sendMessage(jid, { image: imageBuffer, caption: caption || "" });
}

export async function sendReact(jid: string, msgKey: any, emoji: string) {
  if (!sock) throw new Error("Socket not initialized");
  return sock.sendMessage(jid, { react: { text: emoji, key: msgKey } });
}
