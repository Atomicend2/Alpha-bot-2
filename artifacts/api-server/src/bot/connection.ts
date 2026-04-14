import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
  type WASocket,
  type BaileysEventMap,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "url";
import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "../lib/logger.js";
import { handleMessage } from "./handlers/message.js";
import { handleGroupUpdate, handleGroupParticipantsUpdate } from "./handlers/group.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../..", "data");
const AUTH_DIR = path.join(DATA_DIR, "auth");
// Store pairing number outside AUTH_DIR so it survives a logout/wipe
const PAIRING_PHONE_PATH = path.join(DATA_DIR, "paired-phone.txt");

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Migrate paired-phone.txt from old location (inside auth/) to data/ if needed
const OLD_PAIRING_PHONE_PATH = path.join(AUTH_DIR, "paired-phone.txt");
if (!fs.existsSync(PAIRING_PHONE_PATH) && fs.existsSync(OLD_PAIRING_PHONE_PATH)) {
  try {
    fs.copyFileSync(OLD_PAIRING_PHONE_PATH, PAIRING_PHONE_PATH);
    fs.rmSync(OLD_PAIRING_PHONE_PATH, { force: true });
  } catch { /* ignore */ }
}

export const BOT_OWNER_LID = "236713549029502";
export const PREFIX = ".";

let sock: WASocket | null = null;
let isConnected = false;
let isConnecting = false;
let pairingCode: string | null = null;
let reconnectAttempts = 0;
let connectionGeneration = 0;
const MAX_RECONNECT_DELAY = 30000;
const STABLE_CONNECTION_MS = 30000;
const replyContext = new AsyncLocalStorage<any>();

type ConnectOptions = {
  promptForPhone?: boolean;
};

export function getSocket(): WASocket | null {
  return sock;
}

export function isSocketConnected(): boolean {
  return isConnected;
}

export function isSocketConnecting(): boolean {
  return isConnecting;
}

export function getPairingCode(): string | null {
  return pairingCode;
}

export async function runWithReplyContext<T>(msg: any, fn: () => Promise<T>): Promise<T> {
  return replyContext.run(msg, fn);
}

function withReplyOptions(options?: any) {
  const quoted = replyContext.getStore();
  if (!quoted) return options;
  return { quoted, ...(options || {}) };
}

function normalizePhoneNumber(phoneNumber?: string): string | undefined {
  const normalized = phoneNumber?.replace(/\D/g, "");
  return normalized || undefined;
}

export function rememberPairingPhoneNumber(phoneNumber?: string): string | undefined {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return undefined;
  fs.writeFileSync(PAIRING_PHONE_PATH, normalized, "utf8");
  return normalized;
}

function getRememberedPairingPhoneNumber(): string | undefined {
  try {
    return normalizePhoneNumber(fs.readFileSync(PAIRING_PHONE_PATH, "utf8"));
  } catch {
    return undefined;
  }
}

async function askForPairingPhoneNumber(): Promise<string | undefined> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question("Enter WhatsApp phone number to pair with country code, or press Enter to skip: ");
    return normalizePhoneNumber(answer);
  } finally {
    rl.close();
  }
}

export async function connectToWhatsApp(phoneNumber?: string, options: ConnectOptions = {}): Promise<WASocket> {
  if (sock && (isConnected || isConnecting)) {
    return sock;
  }
  isConnecting = true;
  const generation = ++connectionGeneration;
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  const browser = Browsers.ubuntu("Chrome");
  logger.info({ version, isLatest, browser }, "Using WhatsApp Web pairing identity");

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
    browser,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    retryRequestDelayMs: 1000,
    maxMsgRetryCount: 5,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
  });

  if (!state.creds.registered) {
    const normalizedPhoneNumber =
      rememberPairingPhoneNumber(phoneNumber) ||
      getRememberedPairingPhoneNumber() ||
      (options.promptForPhone === false ? undefined : await askForPairingPhoneNumber());

    if (!normalizedPhoneNumber) {
      logger.warn("No phone number provided; skipping pairing code request");
    } else {
      rememberPairingPhoneNumber(normalizedPhoneNumber);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const code = await sock.requestPairingCode(normalizedPhoneNumber);
        pairingCode = code;
        logger.info({ code }, "Pairing code generated");
        console.log(`WhatsApp pairing code: ${code}`);
      } catch (err) {
        logger.error({ err }, "Failed to request pairing code");
      }
    }
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      if (generation !== connectionGeneration) return;
      isConnected = false;
      isConnecting = false;
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const reason = (lastDisconnect?.error as any)?.message || (lastDisconnect?.error as Boom)?.output?.payload?.message || "unknown";
      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
        reconnectAttempts++;
        logger.warn({ delay, attempt: reconnectAttempts, statusCode, reason }, "WhatsApp connection closed; reconnecting");
        setTimeout(() => {
          if (generation === connectionGeneration && !isConnected && !isConnecting) {
            connectToWhatsApp(undefined, { promptForPhone: false });
          }
        }, delay);
      } else {
        logger.info("Logged out from WhatsApp — clearing auth and re-pairing");
        pairingCode = null;
        // Wipe only the auth credentials, preserve paired-phone.txt (it's outside AUTH_DIR now)
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        fs.mkdirSync(AUTH_DIR, { recursive: true });
        // Auto-reconnect: re-request pairing code using the saved phone number
        const savedPhone = getRememberedPairingPhoneNumber();
        if (savedPhone) {
          setTimeout(() => {
            if (generation === connectionGeneration) {
              logger.info({ savedPhone }, "Auto-reconnecting with saved phone number after logout");
              connectToWhatsApp(savedPhone, { promptForPhone: false });
            }
          }, 3000);
        }
      }
    } else if (connection === "open") {
      if (generation !== connectionGeneration) return;
      isConnected = true;
      isConnecting = false;
      pairingCode = null;
      logger.info("Connected to WhatsApp successfully");
      setTimeout(() => {
        if (generation === connectionGeneration && isConnected) {
          reconnectAttempts = 0;
        }
      }, STABLE_CONNECTION_MS);
    } else if (connection === "connecting") {
      if (generation !== connectionGeneration) return;
      isConnecting = true;
      logger.info("Connecting to WhatsApp...");
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    if (m.type !== "notify") return;
    for (const msg of m.messages) {
      if (!msg.message) continue;
      if (msg.key.fromMe) continue;
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

async function sendWithRetry(fn: () => Promise<any>, retries = 4): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRateLimit =
        err?.message?.includes("rate-overlimit") ||
        err?.output?.payload?.message?.includes("rate-overlimit") ||
        err?.data === 429;
      if (isRateLimit && attempt < retries) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
        logger.warn({ attempt, delay, jid: err?.jid }, "Rate-overlimit hit, retrying after delay");
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

export async function sendMessage(jid: string, content: any, options?: any) {
  if (!sock) throw new Error("Socket not initialized");
  const s = sock;
  return sendWithRetry(() => s.sendMessage(jid, content, withReplyOptions(options)));
}

export async function sendText(jid: string, text: string, mentions?: string[]) {
  if (!sock) throw new Error("Socket not initialized");
  const s = sock;
  return sendWithRetry(() => s.sendMessage(jid, { text, mentions: mentions || [] }, withReplyOptions()));
}

export async function sendImage(jid: string, imageBuffer: Buffer, caption?: string) {
  if (!sock) throw new Error("Socket not initialized");
  const s = sock;
  return sendWithRetry(() => s.sendMessage(jid, { image: imageBuffer, caption: caption || "" }, withReplyOptions()));
}

export async function sendReact(jid: string, msgKey: any, emoji: string) {
  if (!sock) throw new Error("Socket not initialized");
  return sock.sendMessage(jid, { react: { text: emoji, key: msgKey } });
}

function getMessageTimestampMs(msg: any): number {
  const raw = msg.messageTimestamp;
  const seconds =
    typeof raw === "number"
      ? raw
      : typeof raw === "bigint"
        ? Number(raw)
        : Number(raw?.low || raw || 0);
  return seconds > 0 ? seconds * 1000 : 0;
}
