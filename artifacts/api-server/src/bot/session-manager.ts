import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { logger } from "../lib/logger.js";
import { handleMessage } from "./handlers/message.js";
import { handleGroupUpdate, handleGroupParticipantsUpdate } from "./handlers/group.js";
import { ensureUser, updateUser } from "./db/queries.js";
import { getDb } from "./db/database.js";
import { activeSocketStorage } from "./socket-context.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../..", "data");

const STABLE_CONNECTION_MS = 30_000;
const MAX_RECONNECT_DELAY = 30_000;

export type SessionStatus = "disconnected" | "connecting" | "connected" | "pairing";

export interface SessionInfo {
  id: string;
  name: string;
  phone: string | null;
  status: SessionStatus;
  pairingCode: string | null;
  botJid: string | null;
  botName: string | null;
  isPrimary: boolean;
}

function makeSilentLogger() {
  const s: any = { level: "silent" as const };
  ["trace","debug","info","warn","error","fatal"].forEach(m => { s[m] = () => {}; });
  s.child = () => makeSilentLogger();
  return s;
}

export class BotSession {
  id: string;
  isPrimary: boolean;
  authDir: string;
  sock: WASocket | null = null;
  status: SessionStatus = "disconnected";
  pairingCode: string | null = null;
  phone: string | null = null;
  private reconnectAttempts = 0;
  private generation = 0;
  private phoneFilePath: string;

  constructor(id: string, isPrimary = false) {
    this.id = id;
    this.isPrimary = isPrimary;
    this.authDir = isPrimary
      ? path.join(DATA_DIR, "auth")
      : path.join(DATA_DIR, "auth", `bot-${id}`);
    this.phoneFilePath = isPrimary
      ? path.join(DATA_DIR, "paired-phone.txt")
      : path.join(DATA_DIR, `paired-phone-${id}.txt`);
    fs.mkdirSync(this.authDir, { recursive: true });
    this.phone = this.readPhone();
  }

  private readPhone(): string | null {
    try { return fs.readFileSync(this.phoneFilePath, "utf8").replace(/\D/g, "") || null; } catch { return null; }
  }

  savePhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, "");
    if (!digits) return null;
    fs.writeFileSync(this.phoneFilePath, digits, "utf8");
    this.phone = digits;
    return digits;
  }

  isCredsRegistered(): boolean {
    try {
      const creds = JSON.parse(fs.readFileSync(path.join(this.authDir, "creds.json"), "utf8"));
      return creds?.registered === true;
    } catch { return false; }
  }

  clearAuth(): void {
    try {
      fs.rmSync(this.authDir, { recursive: true, force: true });
      fs.mkdirSync(this.authDir, { recursive: true });
    } catch {}
    this.sock = null;
    this.status = "disconnected";
    this.pairingCode = null;
    logger.info({ id: this.id }, "Bot session auth cleared");
  }

  async disconnect(): Promise<void> {
    const s = this.sock;
    this.generation++;
    this.sock = null;
    this.status = "disconnected";
    this.pairingCode = null;
    if (s) {
      try { await s.logout(); } catch {}
      try { s.end(undefined as any); } catch {}
      try { (s as any).ws?.close?.(); } catch {}
    }
  }

  async connect(phone?: string): Promise<void> {
    if (this.status === "connected" || this.status === "connecting") return;
    if (phone) this.savePhone(phone);
    this.status = "connecting";
    this.pairingCode = null;
    const generation = ++this.generation;

    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();
    const silentLogger = makeSilentLogger();

    const sock = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, silentLogger) },
      printQRInTerminal: false,
      logger: silentLogger,
      browser: Browsers.ubuntu("Chrome"),
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      retryRequestDelayMs: 1000,
      maxMsgRetryCount: 5,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
    });
    this.sock = sock;

    if (!state.creds.registered && this.phone) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const code = await sock.requestPairingCode(this.phone);
        this.pairingCode = code;
        this.status = "pairing";
        logger.info({ id: this.id, code }, "Pairing code generated");
      } catch (err) {
        logger.error({ err, id: this.id }, "Failed to request pairing code");
      }
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async update => {
      if (generation !== this.generation) return;
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        this.status = "disconnected";
        this.sock = null;
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        if (code === DisconnectReason.loggedOut || code === 440) {
          logger.warn({ id: this.id, code }, "Bot logged out or conflict — clearing auth");
          this.clearAuth();
          this.updateDbStatus("offline");
          return;
        }
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), MAX_RECONNECT_DELAY);
        this.reconnectAttempts++;
        logger.warn({ id: this.id, delay, attempt: this.reconnectAttempts }, "Reconnecting...");
        setTimeout(() => {
          if (generation === this.generation && this.status === "disconnected") {
            this.connect().catch(() => {});
          }
        }, delay);
      } else if (connection === "open") {
        this.status = "connected";
        this.pairingCode = null;
        logger.info({ id: this.id, jid: sock.user?.id }, "Bot session connected");
        this.updateDbStatus("online");
        try {
          const jid = sock.user?.id;
          const lid = sock.user?.lid;
          if (jid) { ensureUser(jid, "Bot"); updateUser(jid, { is_bot: 1 }); }
          if (lid) { ensureUser(lid, "Bot"); updateUser(lid, { is_bot: 1 }); }
        } catch {}
        setTimeout(() => {
          if (generation === this.generation && this.status === "connected") {
            this.reconnectAttempts = 0;
          }
        }, STABLE_CONNECTION_MS);
      } else if (connection === "connecting") {
        this.status = "connecting";
      }
    });

    sock.ev.on("messages.upsert", async m => {
      if (m.type !== "notify") return;
      for (const msg of m.messages) {
        if (!msg.message || msg.key.fromMe) continue;
        try {
          await activeSocketStorage.run(sock, () => handleMessage(sock, msg));
        } catch (err) {
          logger.error({ err, id: this.id }, "Error handling message");
        }
      }
    });

    sock.ev.on("group-participants.update", async update => {
      try {
        await activeSocketStorage.run(sock, () =>
          handleGroupParticipantsUpdate(sock, {
            id: update.id,
            action: update.action as string,
            participants: update.participants.map((p: any) => typeof p === "string" ? p : p.id || p),
          })
        );
      } catch (err) { logger.error({ err, id: this.id }, "Error handling group participants update"); }
    });

    sock.ev.on("groups.update", async updates => {
      try {
        await activeSocketStorage.run(sock, () => handleGroupUpdate(sock, updates));
      } catch (err) { logger.error({ err, id: this.id }, "Error handling groups update"); }
    });
  }

  private updateDbStatus(status: "online" | "offline"): void {
    try {
      const db = getDb();
      db.prepare("UPDATE bots SET status = ?, updated_at = unixepoch() WHERE id = ?").run(status, this.id);
    } catch {}
  }

  getInfo(): SessionInfo {
    return {
      id: this.id,
      name: this.sock?.user?.name || null,
      phone: this.phone,
      status: this.status,
      pairingCode: this.pairingCode,
      botJid: this.sock?.user?.id || null,
      botName: this.sock?.user?.name || null,
      isPrimary: this.isPrimary,
    };
  }
}

class SessionManagerClass {
  private sessions = new Map<string, BotSession>();
  private primarySession: BotSession;

  constructor() {
    this.primarySession = new BotSession("primary", true);
    this.sessions.set("primary", this.primarySession);
  }

  getPrimary(): BotSession {
    return this.primarySession;
  }

  get(id: string): BotSession | undefined {
    return this.sessions.get(id);
  }

  getAll(): BotSession[] {
    return Array.from(this.sessions.values());
  }

  addSession(id: string): BotSession {
    if (this.sessions.has(id)) return this.sessions.get(id)!;
    const session = new BotSession(id);
    this.sessions.set(id, session);
    return session;
  }

  removeSession(id: string): void {
    if (id === "primary") return;
    const s = this.sessions.get(id);
    if (s) s.disconnect().catch(() => {});
    this.sessions.delete(id);
  }

  async startAll(): Promise<void> {
    await this.primarySession.connect().catch(err => {
      logger.error({ err }, "Primary bot auto-connect failed");
    });

    const db = getDb();
    const bots = db.prepare("SELECT id, phone FROM bots").all() as any[];
    for (const bot of bots) {
      const session = this.addSession(bot.id);
      session.connect(bot.phone || undefined).catch(err => {
        logger.error({ err, id: bot.id }, "Bot auto-start failed");
      });
    }
  }

  getAnyConnectedSocket(): WASocket | null {
    for (const s of this.sessions.values()) {
      if (s.status === "connected" && s.sock) return s.sock;
    }
    return null;
  }
}

export const SessionManager = new SessionManagerClass();
