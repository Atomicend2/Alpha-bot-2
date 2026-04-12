import type { WASocket, proto } from "@whiskeysockets/baileys";
import { BOT_OWNER_LID, PREFIX, sendText, runWithReplyContext } from "../connection.js";
import { ensureUser, ensureGroup, incrementMessageCount, getStaff, isBanned, getBotSetting, getUser, addUserXp } from "../db/queries.js";
import { checkAntilink, checkAntispam, checkBlacklist } from "./antispam.js";
import { checkAutoSpawn, handleGetCard } from "./cardspawn.js";
import { checkAfkMention, handleAfk } from "../commands/afk.js";
import { handleAdmin } from "../commands/admin.js";
import { handleEconomy } from "../commands/economy.js";
import { handleGambling } from "../commands/gambling.js";
import { handleCards } from "../commands/cards.js";
import { handleGames, handleGameInput } from "../commands/games.js";
import { handleFun } from "../commands/fun.js";
import { handleInteraction } from "../commands/interactions.js";
import { handleRpg } from "../commands/rpg.js";
import { handleGuilds } from "../commands/guilds.js";
import { handleStaff } from "../commands/staff.js";
import { handleAI } from "../commands/ai.js";
import { handleMenu, handleInfo } from "../commands/menu.js";
import { handleSummer } from "../commands/summer.js";
import { handleLottery } from "../commands/lottery.js";
import { handleConverter } from "../commands/converter.js";
import { logger } from "../../lib/logger.js";
import type { CommandContext } from "../commands/index.js";

export async function handleMessage(
  sock: WASocket,
  msg: proto.IWebMessageInfo
): Promise<void> {
  if (!msg.message) return;
  if (msg.key.fromMe) return;

  const from = msg.key.remoteJid!;
  const isGroup = from.endsWith("@g.us");

  const senderRaw = isGroup
    ? (msg.key.participant || "")
    : (msg.key.remoteJid || "");
  const sender = senderRaw;

  if (!sender) return;

  if (isBanned("user", sender)) return;
  if (isGroup && isBanned("group", from)) {
    await sock.groupLeave(from).catch(() => {});
    return;
  }

  const msgType = Object.keys(msg.message)[0];
  const body =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    "";

  const mentionedJids: string[] =
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

  ensureUser(sender, msg.pushName || undefined);
  addUserXp(sender, 5);

  if (isGroup) {
    incrementMessageCount(sender, from);
  }

  let groupMeta: any = null;
  let isAdmin = false;
  let isBotAdmin = false;
  let isGroupAdmin = false;

  if (isGroup) {
    try {
      ensureGroup(from);
      groupMeta = await sock.groupMetadata(from);
      const botId = sock.user?.id || "";
      const botNumericId = botId.split(":")[0] + "@s.whatsapp.net";
      const botLid = sock.user?.lid || "";

      const senderParticipant = groupMeta.participants.find(
        (p: any) => p.id === sender || p.id.split(":")[0] + "@s.whatsapp.net" === sender
      );
      isGroupAdmin = senderParticipant?.admin === "admin" || senderParticipant?.admin === "superadmin";
      isAdmin = isGroupAdmin;

      const botParticipant = groupMeta.participants.find(
        (p: any) =>
          p.id === botNumericId ||
          p.id === botId ||
          (botLid && p.id === botLid)
      );
      isBotAdmin = botParticipant?.admin === "admin" || botParticipant?.admin === "superadmin";

      if (isBotAdmin) {
        isAdmin = true;
      }
    } catch (err) {
      logger.debug({ err }, "Could not get group metadata");
    }
  }

  const senderLid = (msg as any).participant_lid || (msg as any).key?.participantLid || "";
  const senderPhone = sender.split("@")[0];
  const isOwner =
    senderLid === BOT_OWNER_LID ||
    senderPhone === BOT_OWNER_LID ||
    sender === `${BOT_OWNER_LID}@s.whatsapp.net` ||
    sender === `${BOT_OWNER_LID}@lid` ||
    !!getStaff(sender)?.role === true;

  if (mentionedJids.length > 0) {
    await checkAfkMention(from, sender, mentionedJids, sock).catch(() => {});
    await sendMentionStickerIfNeeded(sock, from, mentionedJids).catch((err) => {
      logger.warn({ err }, "Failed to send mention sticker");
    });
  }

  if (isGroup && body) {
    const antiSpam = await checkAntispam(sock, from, sender, isAdmin).catch(() => false);
    if (antiSpam) return;

    const antiLink = await checkAntilink(sock, from, sender, body, msg.key, isAdmin).catch(() => false);
    if (antiLink) return;

    const bl = await checkBlacklist(sock, from, sender, body, msg.key, isAdmin).catch(() => false);
    if (bl) return;

    await checkAutoSpawn(sock, from).catch(() => {});
  }

  if (!body.startsWith(PREFIX)) {
    const plainGet = body.trim().match(/^get\s+(\S+)/i);
    if (plainGet && isGroup) {
      return handleGetCard(sock, from, sender, plainGet[1]);
    }
    if (isGroup) {
      const handled = await handleGameInput(
        {
          sock, msg, from, sender, command: "", args: [], isAdmin, isBotAdmin,
          isOwner, isGroupAdmin, groupMeta, prefix: PREFIX, body,
        },
        body
      ).catch(() => false);
      if (handled) return;
    }
    return;
  }

  const [rawCmd, ...args] = body.slice(PREFIX.length).trim().split(/\s+/);
  const command = rawCmd.toLowerCase();
  const replySock = createReplySocket(sock, msg);

  const ctx: CommandContext = {
    sock: replySock, msg, from, sender, command, args, isAdmin, isBotAdmin,
    isOwner, isGroupAdmin, groupMeta, prefix: PREFIX, body,
  };

  try {
    await runWithReplyContext(msg, () => dispatch(ctx));
  } catch (err) {
    logger.error({ err, command }, "Error dispatching command");
    await sendText(from, `❌ An error occurred. Please try again.`).catch(() => {});
  }
}

async function sendMentionStickerIfNeeded(sock: WASocket, from: string, mentionedJids: string[]): Promise<void> {
  for (const jid of mentionedJids) {
    if (!canUseMentionSticker(jid)) continue;
    const sticker = getBotSetting(`mention_sticker:${jid}`);
    if (!sticker) continue;
    await sock.sendMessage(from, { sticker });
  }
}

function canUseMentionSticker(jid: string): boolean {
  const phone = jid.split("@")[0];
  if (phone === BOT_OWNER_LID || jid === `${BOT_OWNER_LID}@s.whatsapp.net` || jid === `${BOT_OWNER_LID}@lid`) return true;
  const staff = getStaff(jid);
  if (staff?.role === "mod" || staff?.role === "guardian") return true;
  const user = getUser(jid);
  if (!user?.premium) return false;
  const expiry = Number(user.premium_expiry || 0);
  return expiry === 0 || expiry > Math.floor(Date.now() / 1000);
}

async function dispatch(ctx: CommandContext): Promise<void> {
  const { command, from, sender, msg } = ctx;

  switch (command) {
    case "menu":
      return handleMenu(ctx);

    case "ping":
      await sendText(from, `Alpha's here!\n> ${getPingMs(msg)}ms`);
      return;

    case "uptime": {
      const u = process.uptime();
      const h = Math.floor(u / 3600), m = Math.floor((u % 3600) / 60), s = Math.floor(u % 60);
      await sendText(from, `⏱️ Uptime: ${h}h ${m}m ${s}s`);
      return;
    }

    case "info":
    case "help":
      return handleInfo(ctx);

    case "website":
      await sendText(from, "🌐 Website: Coming soon!");
      return;

    case "community":
      await sendText(from, "👥 Community: Join Shadow Garden!");
      return;

    case "afk":
      return handleAfk(ctx);

    case "get":
      if (ctx.args[0]) {
        return handleGetCard(ctx.sock, from, sender, ctx.args[0]);
      }
      return;

    case "spawncard":
      if (ctx.isOwner || !!getStaff(sender)) {
        const { spawnCard } = await import("./cardspawn.js");
        return spawnCard(ctx.sock as any, from);
      }
      return;

    case "kick":
    case "delete":
    case "del":
    case "warn":
    case "resetwarn":
    case "antilink":
    case "antism":
    case "welcome":
    case "setwelcome":
    case "leave":
    case "setleave":
    case "promote":
    case "demote":
    case "mute":
    case "unmute":
    case "open":
    case "close":
    case "hidetag":
    case "tagall":
    case "activity":
    case "active":
    case "inactive":
    case "purge":
    case "blacklist":
    case "groupinfo":
    case "gi":
    case "groupstats":
    case "gs":
      return handleAdmin(ctx);

    case "balance":
    case "bal":
    case "gems":
    case "premiumbal":
    case "pbal":
    case "premium":
    case "prem":
    case "membership":
    case "memb":
    case "daily":
    case "withdraw":
    case "wid":
    case "deposit":
    case "dep":
    case "donate":
    case "richlist":
    case "richlistglobal":
    case "richlg":
    case "register":
    case "reg":
    case "setname":
    case "profile":
    case "p":
    case "bio":
    case "setage":
    case "inventory":
    case "inv":
    case "shop":
    case "buy":
    case "sell":
    case "use":
    case "leaderboard":
    case "lb":
    case "work":
    case "dig":
    case "fish":
    case "beg":
    case "roast":
    case "stats":
      return handleEconomy(ctx);

    case "bc":
      if (ctx.args.length === 0) return handleEconomy(ctx);
      return;

    case "lc":
      if (!ctx.args[0]?.startsWith("@") && ctx.args.length < 2) {
        return handleEconomy(ctx);
      }
      return handleCards(ctx);

    case "lottery":
    case "lp":
    case "drawlottery":
      return handleLottery(ctx);

    case "slots":
    case "dice":
    case "casino":
    case "coinflip":
    case "cf":
    case "doublebet":
    case "db":
    case "doublepayout":
    case "dp":
    case "roulette":
    case "horse":
    case "spin":
      return handleGambling(ctx);

    case "collection":
    case "coll":
    case "deck":
    case "sdi":
    case "card":
    case "cardinfo":
    case "ci":
    case "mycollectionseries":
    case "mycolls":
    case "cardleaderboard":
    case "cardlb":
    case "cardshop":
    case "stardust":
    case "vs":
    case "auction":
    case "myauc":
    case "listauc":
    case "cg":
    case "ctd":
    case "lcd":
    case "retrieve":
    case "sellc":
    case "tc":
    case "accept":
    case "decline":
      return handleCards(ctx);

    case "tictactoe":
    case "ttt":
    case "connectfour":
    case "c4":
    case "wordchain":
    case "wcg":
    case "joinwcg":
    case "startbattle":
    case "truthordare":
    case "td":
    case "truth":
    case "dare":
    case "stopgame":
    case "uno":
    case "startuno":
    case "unoplay":
    case "unodraw":
    case "unohand":
      return handleGames(ctx);

    case "gay":
    case "lesbian":
    case "simp":
    case "match":
    case "ship":
    case "character":
    case "psize":
    case "pp":
    case "skill":
    case "duality":
    case "gen":
    case "pov":
    case "social":
    case "relation":
    case "wouldyourather":
    case "wyr":
    case "joke":
      return handleFun(ctx);

    case "hug":
    case "kiss":
    case "slap":
    case "wave":
    case "pat":
    case "dance":
    case "sad":
    case "smile":
    case "laugh":
    case "punch":
    case "kill":
    case "hit":
    case "kidnap":
    case "lick":
    case "bonk":
    case "tickle":
    case "shrug":
      return handleInteraction(ctx);

    case "adventure":
    case "rpg":
    case "dungeon":
    case "heal":
    case "quest":
    case "raid":
    case "class":
      return handleRpg(ctx);

    case "ai":
    case "gpt":
    case "translate":
    case "tt":
    case "chat":
      return handleAI(ctx);

    case "sticker":
    case "s":
    case "take":
    case "toimg":
    case "turnimg":
    case "play":
    case "speech":
    case "mood":
    case "pintimg":
      return handleConverter(ctx);

    case "summer":
    case "token":
      return handleSummer(ctx);

    case "guild":
      return handleGuilds(ctx);

    case "addguardian":
    case "addmod":
    case "recruit":
    case "addpremium":
    case "removepremium":
    case "modlist":
    case "cardmakers":
    case "post":
    case "join":
    case "setms":
    case "delms":
    case "exit":
    case "show":
    case "dc":
    case "ac":
    case "rc":
    case "upload":
    case "ban":
    case "unban":
    case "banlist":
      return handleStaff(ctx);

    case "cds":
      return handleEconomy(ctx);
      return;

    default:
      break;
  }
}

function createReplySocket(sock: WASocket, msg: proto.IWebMessageInfo): WASocket {
  return new Proxy(sock as any, {
    get(target, prop) {
      if (prop !== "sendMessage") {
        const value = target[prop];
        return typeof value === "function" ? value.bind(target) : value;
      }
      return (jid: string, content: any, options?: any) => {
        if (content?.delete || content?.react) {
          return target.sendMessage(jid, content, options);
        }
        return target.sendMessage(jid, content, { quoted: msg, ...(options || {}) });
      };
    },
  }) as WASocket;
}

function getPingMs(msg: proto.IWebMessageInfo): number {
  const raw = msg.messageTimestamp as any;
  const seconds = typeof raw === "number" ? raw : Number(raw?.low || raw || 0);
  const sent = seconds > 0 ? seconds * 1000 : Date.now();
  return Math.max(1, Date.now() - sent);
}
