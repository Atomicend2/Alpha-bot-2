import type { CommandContext } from "./index.js";
import { BOT_OWNER_LID, sendText } from "../connection.js";
import { addStaff, removeStaff, getStaffList, getStaff, ensureUser, getUser, updateUser, getCard, getAllCards, addBan, removeBan, getBanList, setBotSetting, deleteBotSetting, resetUserBalance, resetUserProfile, isBanned } from "../db/queries.js";
import { getTierEmoji, isValidTier, generateId } from "../utils.js";
import { getDb } from "../db/database.js";
import { spawnCard } from "../handlers/cardspawn.js";
import { addCard } from "../db/queries.js";
import axios from "axios";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { logger } from "../../lib/logger.js";

export async function handleStaff(ctx: CommandContext): Promise<void> {
  const { from, sender, args, command: cmd, msg, sock, isOwner } = ctx;
  const staffRecord = getStaff(sender);

  if (cmd === "setms" || cmd === "delms") {
    if (!canUsePrivilegedPersonalCommand(sender)) {
      await sendText(from, "❌ Only owner, mods, guardians, and premium members can use this command.");
      return;
    }
    if (cmd === "delms") {
      deleteBotSetting(`mention_sticker:${sender}`);
      await sendText(from, "✅ Your mention sticker was removed.");
      return;
    }
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted?.stickerMessage) {
      await sendText(from, "❌ Reply to a sticker with .setms to save it as your mention sticker.");
      return;
    }
    try {
      const context = msg.message?.extendedTextMessage?.contextInfo;
      const target = {
        key: {
          remoteJid: from,
          fromMe: false,
          id: context?.stanzaId || "",
          participant: context?.participant,
        },
        message: quoted,
      };
      const downloaded = await downloadMediaMessage(target as any, "buffer", {}, { reuploadRequest: (sock as any).updateMediaMessage });
      const stickerBuffer = Buffer.isBuffer(downloaded) ? downloaded : Buffer.from(downloaded as any);
      setBotSetting(`mention_sticker:${sender}`, stickerBuffer);
      await sendText(from, "✅ Your personal mention sticker is set.");
    } catch (err: any) {
      logger.error({ err }, "Failed to set personal mention sticker");
      await sendText(from, `❌ Failed to set mention sticker: ${err?.message || "could not download sticker"}`);
    }
    return;
  }

  if (cmd === "ac" || cmd === "rc") {
    if (!canUsePrivilegedPersonalCommand(sender)) {
      await sendText(from, "❌ Only owner, mods, guardians, and premium members can use this command.");
      return;
    }
    const amount = parseInt(args[0]);
    const targetId = getTargetFromMentionReplyOrText(ctx, args[1]);
    if (isNaN(amount) || amount <= 0 || !targetId) {
      await sendText(from, `❌ Usage: .${cmd} <amount> @user\nYou can also reply to a user's message.`);
      return;
    }
    const target = ensureUser(targetId);
    const current = Number(target.balance || 0);
    const nextBalance = cmd === "ac" ? current + amount : Math.max(0, current - amount);
    updateUser(targetId, { balance: nextBalance, bank: Math.max(0, Number(target.bank || 0)) });
    await sendText(
      from,
      `${cmd === "ac" ? "✅ Added" : "✅ Removed"} $${amount.toLocaleString()} ${cmd === "ac" ? "to" : "from"} @${targetId.split("@")[0]}.\nWallet: $${nextBalance.toLocaleString()}\nBank: $${Number(target.bank || 0).toLocaleString()}`,
      [targetId]
    );
    return;
  }

  if (cmd === "mods" || cmd === "modlist") {
    const staff = getStaffList();
    const mods = staff.filter((s) => s.role === "mod");
    const guardians = staff.filter((s) => s.role === "guardian");
    const mentions = [...mods, ...guardians].map((s) => s.user_id);
    const modLines = mods.length > 0 ? mods.map((s) => ` ╰┈➤ @${s.user_id.split("@")[0]}`).join("\n") : " ╰┈➤ None yet";
    const guardianLines = guardians.length > 0 ? guardians.map((s) => ` ╰┈➤ @${s.user_id.split("@")[0]}`).join("\n") : " ╰┈➤ None yet";
    const text =
      `🎀 𝐒𝐇𝚫𝐃𝐎𝐖 𝐆𝚫𝐑𝐃𝚵𝐍 🎀\n\n` +
      `━━━━━━━━━━━━\n` +
      `   👑 *Mods* 👑\n` +
      `━━━━━━━━━━━━\n` +
      `${modLines}\n\n` +
      `━━━━━━━━━━━━\n` +
      `🛡️ *Guardians* 🛡️\n` +
      `━━━━━━━━━━━━\n` +
      `${guardianLines}\n\n` +
      `━━━━━━━━━━━━\n` +
      `> *⚠️ Don't spam them to avoid being blocked!*\n\n` +
      `🆘 Need help? Type *.help* to see bot info`;
    await sock.sendMessage(from, { text, mentions });
    return;
  }

  if (!isOwner && !staffRecord) {
    await sendText(from, "❌ This command requires staff access.");
    return;
  }

  if (cmd === "ban" || cmd === "unban" || cmd === "banlist") {
    const role = staffRecord?.role;
    if (!isOwner && role !== "mod" && role !== "guardian") {
      await sendText(from, "❌ Only mods, guardians, and the owner can use ban commands.");
      return;
    }

    if (cmd === "banlist") {
      const bans = getBanList();
      if (bans.length === 0) {
        await sendText(from, "✅ No banned users or groups.");
        return;
      }
      const text = "╔═ ❰ 🚫 𝗕𝗔𝗡 𝗟𝗜𝗦𝗧 ❱ ═╗\n" +
        bans.map((ban) => `║ ➩ ${ban.type.toUpperCase()}: ${ban.display || ban.target}${ban.reason ? ` — ${ban.reason}` : ""}`).join("\n") +
        "\n╚══════════════════╝";
      await sendText(from, text.slice(0, 3900));
      return;
    }

    const rawTarget = args[0] || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || "";
    if (!rawTarget) {
      await sendText(from, `❌ Usage: .${cmd} <number> or .${cmd} <group link>`);
      return;
    }

    const groupCode = extractGroupInviteCode(rawTarget);
    const reason = args.slice(1).join(" ");

    if (groupCode) {
      const groupTarget = await resolveGroupTarget(sock, groupCode);
      if (cmd === "ban") {
        addBan("group", groupTarget.target, groupTarget.display, reason, sender);
        addBan("group", `invite:${groupCode}`, groupTarget.display, reason, sender);
        await sendText(from, `🚫 Banned group: ${groupTarget.display}`);
        if (from === groupTarget.target) {
          await sock.groupLeave(from).catch(() => {});
        }
      } else {
        removeBan("group", groupTarget.target);
        removeBan("group", `invite:${groupCode}`);
        await sendText(from, `✅ Unbanned group: ${groupTarget.display}`);
      }
      return;
    }

    const userTarget = normalizeUserTarget(rawTarget);
    if (!userTarget) {
      await sendText(from, `❌ Usage: .${cmd} <number> or .${cmd} <group link>`);
      return;
    }

    if (cmd === "ban") {
      addBan("user", userTarget, `@${userTarget.split("@")[0]}`, reason, sender);
      await sock.updateBlockStatus(userTarget, "block").catch(() => {});
      await sendText(from, `🚫 Banned @${userTarget.split("@")[0]}.`, [userTarget]);
    } else {
      removeBan("user", userTarget);
      await sock.updateBlockStatus(userTarget, "unblock").catch(() => {});
      await sendText(from, `✅ Unbanned @${userTarget.split("@")[0]}.`, [userTarget]);
    }
    return;
  }

  if (cmd === "addmod") {
    if (!isOwner) { await sendText(from, "❌ Only the bot owner can add mods."); return; }
    const target = resolveStaffTarget(args[0], msg);
    if (!target) { await sendText(from, "❌ Usage: .addmod <phone number> or .addmod @user"); return; }
    addStaff(target, "mod", sender);
    await sock.sendMessage(from, {
      text: `✅ @${target.split("@")[0]} added as mod.`,
      mentions: [target],
    });
    return;
  }

  if (cmd === "addguardian") {
    if (!isOwner) { await sendText(from, "❌ Only the bot owner can add guardians."); return; }
    const target = resolveStaffTarget(args[0], msg);
    if (!target) { await sendText(from, "❌ Usage: .addguardian <phone number> or .addguardian @user"); return; }
    addStaff(target, "guardian", sender);
    await sock.sendMessage(from, {
      text: `🛡️ @${target.split("@")[0]} added as guardian.`,
      mentions: [target],
    });
    return;
  }

  if (cmd === "removemod" || cmd === "removeguardian") {
    if (!isOwner) { await sendText(from, `❌ Only the bot owner can remove ${cmd === "removemod" ? "mods" : "guardians"}.`); return; }
    const target = resolveStaffTarget(args[0], msg);
    if (!target) { await sendText(from, `❌ Usage: .${cmd} <phone number> or .${cmd} @user`); return; }
    const role = cmd === "removemod" ? "mod" : "guardian";
    removeStaffAllVariants(target, role);
    await sock.sendMessage(from, {
      text: `✅ Removed @${target.split("@")[0]} from ${role}s.`,
      mentions: [target],
    });
    return;
  }

  if (cmd === "recruit") {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) { await sendText(from, "❌ Mention someone."); return; }
    addStaff(mentioned, "recruit", sender);
    await sock.sendMessage(from, {
      text: `👤 @${mentioned.split("@")[0]} recruited to staff.`,
      mentions: [mentioned],
    });
    return;
  }

  if (cmd === "addpremium") {
    if (!isOwner) { await sendText(from, "❌ Only the bot owner can grant premium."); return; }
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) { await sendText(from, "❌ Mention someone."); return; }
    ensureUser(mentioned);
    const days = parseInt(args[1]) || 30;
    const expiry = Math.floor(Date.now() / 1000) + days * 86400;
    updateUser(mentioned, { premium: 1, premium_expiry: expiry });
    await sock.sendMessage(from, {
      text: `⭐ @${mentioned.split("@")[0]} granted *Premium* for ${days} days!`,
      mentions: [mentioned],
    });
    return;
  }

  if (cmd === "removepremium") {
    if (!isOwner) { await sendText(from, "❌ Only the bot owner can remove premium."); return; }
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) { await sendText(from, "❌ Mention someone."); return; }
    updateUser(mentioned, { premium: 0, premium_expiry: 0 });
    await sock.sendMessage(from, {
      text: `❌ Premium removed from @${mentioned.split("@")[0]}.`,
      mentions: [mentioned],
    });
    return;
  }

  if (cmd === "cardmakers") {
    await sendText(from, "🃏 *Card Makers* — Use .upload T[tier] to upload a card (reply to image).");
    return;
  }

  if (cmd === "post") {
    const text = args.join(" ");
    if (!text) { await sendText(from, "❌ Usage: .post [message]"); return; }
    await sendText(from, `📢 *Announcement*\n\n${text}`);
    return;
  }

  if (cmd === "join") {
    const link = args[0];
    if (!link) { await sendText(from, "❌ Provide a group link."); return; }
    const code = normalizeGroupInviteCode(link);
    if (!code) {
      await sendText(from, "❌ Send a valid WhatsApp group invite link or invite code.");
      return;
    }
    try {
      const info = await sock.groupGetInviteInfo(code).catch(() => null);
      const targetId = info?.id ? (String(info.id).endsWith("@g.us") ? String(info.id) : `${info.id}@g.us`) : "";
      if (isBanned("group", `invite:${code}`) || (targetId && isBanned("group", targetId))) {
        await sendText(from, "❌ This group is banned, so the bot will not join it.");
        return;
      }
      await sock.groupAcceptInvite(code);
      await sendText(from, `✅ Joined group${info?.subject ? `: *${info.subject}*` : "!"}`);
    } catch (err: any) {
      logger.error({ err, code }, "Failed to join group from invite");
      const reason = String(err?.message || err?.output?.payload?.message || "").trim();
      await sendText(from, `❌ Failed to join group${reason ? `: ${reason}` : ". Make sure the invite link is active and the bot is allowed to join."}`);
    }
    return;
  }

  if (cmd === "resetbal") {
    if (!isOwner) { await sendText(from, "❌ Only the bot owner can reset balances."); return; }
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) { await sendText(from, "❌ Usage: .resetbal @user"); return; }
    resetUserBalance(mentioned);
    await sock.sendMessage(from, {
      text: `✅ Wallet and bank reset to $0 for @${mentioned.split("@")[0]}.`,
      mentions: [mentioned],
    });
    return;
  }

  if (cmd === "reset") {
    if (!isOwner) { await sendText(from, "❌ Only the bot owner can permanently reset profiles."); return; }
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) { await sendText(from, "❌ Usage: .reset @user"); return; }
    resetUserProfile(mentioned);
    await sock.sendMessage(from, {
      text: `✅ Profile permanently reset for @${mentioned.split("@")[0]}. All data wiped.`,
      mentions: [mentioned],
    });
    return;
  }

  if (cmd === "exit") {
    if (!from.endsWith("@g.us")) { await sendText(from, "❌ Must be in a group."); return; }
    await sendText(from, "👋 Leaving group...");
    await sock.groupLeave(from);
    return;
  }

  if (cmd === "show") {
    const tier = args[1]?.toUpperCase();
    if (!tier) { await sendText(from, "Usage: .show all T1/T2/T3/T4/T5/TS/TX"); return; }
    const cards = getAllCards(tier === "ALL" ? undefined : tier);
    if (cards.length === 0) { await sendText(from, `No cards found for tier ${tier}.`); return; }
    const text = `🃏 *Cards (${tier === "ALL" ? "All" : tier})*\n\n` +
      cards.map((c) => `${getTierEmoji(c.tier)} [${c.tier}] *${c.name}* (${c.series}) — ID: \`${c.id}\``).join("\n");
    await sendText(from, text.slice(0, 3900));
    return;
  }

  if (cmd === "spawncard") {
    if (!from.endsWith("@g.us")) { await sendText(from, "❌ Must be in a group."); return; }
    await spawnCard(sock as any, from);
    return;
  }

  if (cmd === "dc") {
    const quoted = msg.message?.extendedTextMessage?.contextInfo;
    const cardId = args[0];
    if (!cardId) { await sendText(from, "❌ Provide card ID to delete."); return; }
    const card = getCard(cardId);
    if (!card) { await sendText(from, "❌ Card not found."); return; }
    const { deleteCard } = await import("../db/queries.js");
    deleteCard(cardId);
    await sendText(from, `✅ Deleted card *${card.name}* (${cardId}).`);
    return;
  }

  if (cmd === "ac") {
    const amount = parseInt(args[0]);
    const phoneOrNum = args[1];
    if (isNaN(amount) || !phoneOrNum) { await sendText(from, "❌ Usage: .ac [amount] [phone/user_number]"); return; }
    const userId = phoneOrNum.includes("@") ? phoneOrNum : `${phoneOrNum}@s.whatsapp.net`;
    ensureUser(userId);
    const target = getUser(userId)!;
    updateUser(userId, { balance: (target.balance || 0) + amount });
    await sendText(from, `✅ Added $${amount} to @${userId.split("@")[0]}.`, [userId]);
    return;
  }

  if (cmd === "rc") {
    const amount = parseInt(args[0]);
    const phoneOrNum = args[1];
    if (isNaN(amount) || !phoneOrNum) { await sendText(from, "❌ Usage: .rc [amount] [phone/user_number]"); return; }
    const userId = phoneOrNum.includes("@") ? phoneOrNum : `${phoneOrNum}@s.whatsapp.net`;
    ensureUser(userId);
    const target = getUser(userId)!;
    updateUser(userId, { balance: Math.max(0, (target.balance || 0) - amount) });
    await sendText(from, `✅ Removed $${amount} from @${userId.split("@")[0]}.`, [userId]);
    return;
  }

  if (cmd === "upload") {
    if (!isOwner && !getStaff(sender)) {
      await sendText(from, "❌ Only staff can upload cards.");
      return;
    }
    const tier = args[0]?.toUpperCase();
    if (!tier || !isValidTier(tier)) {
      await sendText(from, "❌ Usage: .upload T<tier> <name>. <series>\nExample: .upload T4 Shadow Monarch. Solo Leveling\nReply to an image/sticker.");
      return;
    }
    const quoted = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = quoted?.quotedMessage;
    if (!quotedMsg) {
      await sendText(from, "❌ Reply to an image with .upload [tier]");
      return;
    }
    const imgMsg = quotedMsg.imageMessage || quotedMsg.stickerMessage;
    if (!imgMsg) {
      await sendText(from, "❌ Reply to an image (not a video or document).");
      return;
    }

    const parsed = parseUploadDetails(args.slice(1).join(" "));
    const cardName = parsed.name || `Card_${Date.now()}`;
    const cardSeries = parsed.series || "General";
    const cardDesc = parsed.description || "";

    const db = getDb();
    const existingIds = new Set(db.prepare("SELECT id FROM cards").all().map((r: any) => r.id));

    try {
      await sendText(from, "⏳ Downloading image and saving card...");
      const context = msg.message?.extendedTextMessage?.contextInfo;
      const quotedWebMessage = {
        key: {
          remoteJid: from,
          fromMe: false,
          id: context?.stanzaId || "",
          participant: context?.participant,
        },
        message: quotedMsg,
      };
      const downloaded = await downloadMediaMessage(
        quotedWebMessage as any,
        "buffer",
        {},
        { reuploadRequest: (sock as any).updateMediaMessage }
      );
      const imageBuffer = Buffer.isBuffer(downloaded) ? downloaded : Buffer.from(downloaded as any);

      const { generateUniqueCardId } = await import("../utils.js");
      const cardId = generateUniqueCardId(existingIds);

      addCard({
        id: cardId,
        name: cardName,
        tier,
        series: cardSeries,
        image_data: imageBuffer,
        description: cardDesc,
        uploaded_by: sender,
      });

      await sendText(from, `✅ Card uploaded!\n\n${getTierEmoji(tier)} *${cardName}*\n📦 Series: ${cardSeries}\n🎖️ Tier: ${tier}\n🆔 ID: \`${cardId}\`\n\nUse .spawncard to spawn it!`);
    } catch (err: any) {
      await sendText(from, `❌ Failed to upload card: ${err.message}`);
    }
    return;
  }
}

function resolveStaffTarget(rawArg: string | undefined, msg: any): string | null {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  if (mentioned) return mentioned;
  if (!rawArg) return null;
  const digits = rawArg.replace(/\D/g, "");
  if (digits.length >= 7) return `${digits}@s.whatsapp.net`;
  return null;
}

function removeStaffAllVariants(jid: string, role?: string): void {
  const variants = new Set<string>();
  variants.add(jid);
  const [rawUser] = jid.split("@");
  const user = rawUser.split(":")[0];
  if (user) {
    variants.add(`${user}@s.whatsapp.net`);
    variants.add(`${user}@lid`);
  }
  for (const v of variants) {
    removeStaff(v, role);
  }
}

function parseUploadDetails(input: string): { name: string; series: string; description: string } {
  const trimmed = input.trim();
  if (!trimmed) return { name: "", series: "General", description: "" };
  if (trimmed.includes("|")) {
    const [name, series, description] = trimmed.split("|").map((s) => s.trim());
    return { name: name || "", series: series || "General", description: description || "" };
  }
  const dotIndex = trimmed.indexOf(".");
  if (dotIndex >= 0) {
    const name = trimmed.slice(0, dotIndex).trim();
    const series = trimmed.slice(dotIndex + 1).trim();
    return { name, series: series || "General", description: "" };
  }
  return { name: trimmed, series: "General", description: "" };
}

function normalizeUserTarget(input: string): string | null {
  const jid = input.includes("@") ? input : "";
  if (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid")) return jid;
  const digits = input.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : null;
}

function extractGroupInviteCode(input: string): string | null {
  const match = input.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i);
  return match?.[1] || null;
}

function normalizeGroupInviteCode(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/(?:https?:\/\/)?(?:www\.)?chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i);
  const raw = match?.[1] || trimmed;
  const code = raw.split(/[?#/]/)[0]?.trim();
  return code && /^[A-Za-z0-9_-]{16,}$/.test(code) ? code : null;
}

function canUsePrivilegedPersonalCommand(jid: string): boolean {
  const phone = jid.split("@")[0];
  if (phone === BOT_OWNER_LID || jid === `${BOT_OWNER_LID}@s.whatsapp.net` || jid === `${BOT_OWNER_LID}@lid`) return true;
  const staff = getStaff(jid);
  if (staff?.role === "mod" || staff?.role === "guardian") return true;
  const user = ensureUser(jid);
  if (!user?.premium) return false;
  const expiry = Number(user.premium_expiry || 0);
  return expiry === 0 || expiry > Math.floor(Date.now() / 1000);
}

function getTargetFromMentionReplyOrText(ctx: CommandContext, raw?: string): string | null {
  const info = ctx.msg.message?.extendedTextMessage?.contextInfo;
  const mentioned = info?.mentionedJid?.[0];
  if (mentioned) return mentioned;
  if (info?.participant) return info.participant;
  if (!raw) return null;
  return normalizeUserTarget(raw);
}

async function resolveGroupTarget(sock: any, code: string): Promise<{ target: string; display: string }> {
  try {
    const info = await sock.groupGetInviteInfo(code);
    const id = String(info?.id || code);
    const target = id.endsWith("@g.us") ? id : `${id}@g.us`;
    const subject = info?.subject ? `${info.subject} (${code})` : code;
    return { target, display: subject };
  } catch {
    return { target: `invite:${code}`, display: code };
  }
}
