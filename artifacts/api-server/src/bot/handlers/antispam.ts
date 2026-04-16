import type { WASocket } from "@whiskeysockets/baileys";
import { getGroup } from "../db/queries.js";
import { addWarning } from "../db/queries.js";
import { sendText } from "../connection.js";
import { logger } from "../../lib/logger.js";

const messageCache: Map<string, { count: number; lastTime: number }> = new Map();
const SPAM_LIMIT = 5;
const SPAM_WINDOW = 5000;

export async function checkAntispam(
  sock: WASocket,
  groupId: string,
  senderId: string,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) return false;
  const group = getGroup(groupId);
  if (!group || group.antispam !== "on") return false;

  const key = `${groupId}:${senderId}`;
  const now = Date.now();
  const entry = messageCache.get(key) || { count: 0, lastTime: now };

  if (now - entry.lastTime > SPAM_WINDOW) {
    entry.count = 1;
    entry.lastTime = now;
  } else {
    entry.count++;
  }

  messageCache.set(key, entry);

  if (entry.count >= SPAM_LIMIT) {
    messageCache.delete(key);
    const action = group.antispam_action || "kick";
    try {
      if (action === "warn") {
        const warns = addWarning(senderId, groupId, "Spamming messages", "Anti-Spam System");
        const count = warns.length;
        await sendText(
          groupId,
          `┌─❖\n│「 ⚠️ 𝗔𝗡𝗧𝗜-𝗦𝗣𝗔𝗠 𝗪𝗔𝗥𝗡𝗜𝗡𝗚 」\n└┬❖ 「 @${senderId.split("@")[0]} 」\n│✑ 𝗥𝗘𝗔𝗦𝗢𝗡: Spamming messages\n│✑ 𝗟𝗜𝗠𝗜𝗧: ${count} / 5\n└────────────┈ ⳹`,
          [senderId]
        );
        if (count >= 5) {
          await sock.groupParticipantsUpdate(groupId, [senderId], "remove");
        }
      } else if (action === "delete") {
        await sendText(groupId, `🚫 @${senderId.split("@")[0]}, please stop spamming!`, [senderId]);
      } else {
        await sock.groupParticipantsUpdate(groupId, [senderId], "remove");
        await sendText(groupId, `⚡ @${senderId.split("@")[0]} was removed for spamming.`, [senderId]);
      }
    } catch (err) {
      logger.error({ err }, "Failed to handle spammer");
    }
    return true;
  }

  return false;
}

const LINK_PATTERNS = [
  /https?:\/\//i,
  /www\.\w+\.\w+/i,
  /wa\.me\//i,
  /chat\.whatsapp\.com\//i,
  /t\.me\//i,
  /discord\.gg\//i,
  /bit\.ly\//i,
  /tinyurl\.com\//i,
  /youtu\.be\//i,
  /youtube\.com\/(watch|shorts)/i,
  /instagram\.com\//i,
  /fb\.com\//i,
  /facebook\.com\//i,
  /twitter\.com\//i,
  /x\.com\//i,
  /tiktok\.com\//i,
  /linktr\.ee\//i,
  /rb\.gy\//i,
  /ow\.ly\//i,
  /is\.gd\//i,
  /cutt\.ly\//i,
  /shorturl\.at\//i,
  /\w{2,}\.\w{2,}\/\w+/i,
];

export async function checkAntilink(
  sock: WASocket,
  groupId: string,
  senderId: string,
  text: string,
  msgKey: any,
  isAdmin: boolean
): Promise<boolean> {
  const group = getGroup(groupId);
  if (!group || group.antilink === "off") return false;
  if (isAdmin) return false;

  const hasLink = LINK_PATTERNS.some((p) => p.test(text));
  if (!hasLink) return false;

  const action = group.antilink_action || "delete";

  try {
    await sock.sendMessage(groupId, { delete: msgKey });
  } catch {}

  if (action === "warn") {
    const warns = addWarning(senderId, groupId, "Sent a link", "Anti-Link System");
    const count = warns.length;
    await sendText(
      groupId,
      `┌─❖\n│「 ⚠️ 𝗪𝗔𝗥𝗡𝗜𝗡𝗚 」\n└┬❖ 「 @${senderId.split("@")[0]} 」\n│✑ 𝗥𝗘𝗔𝗦𝗢𝗡: Sent a link\n│✑ 𝗟𝗜𝗠𝗜𝗧: ${count} / 5\n└────────────┈ ⳹`,
      [senderId]
    );
    if (count >= 5) {
      await sock.groupParticipantsUpdate(groupId, [senderId], "remove");
    }
  } else if (action === "kick") {
    await sock.groupParticipantsUpdate(groupId, [senderId], "remove");
    await sendText(groupId, `🔗 @${senderId.split("@")[0]} was removed for sending a link.`, [senderId]);
  }

  return true;
}

export async function checkBlacklist(
  sock: WASocket,
  groupId: string,
  senderId: string,
  text: string,
  msgKey: any,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) return false;
  const group = getGroup(groupId);
  if (!group) return false;

  let blacklist: string[] = [];
  try {
    blacklist = JSON.parse(group.blacklist || "[]");
  } catch {
    blacklist = [];
  }

  if (blacklist.length === 0) return false;

  const lower = text.toLowerCase();
  const found = blacklist.find((w: string) => lower.includes(w.toLowerCase()));
  if (!found) return false;

  const action = group.blacklist_action || "delete";

  try {
    await sock.sendMessage(groupId, { delete: msgKey });
  } catch {}

  if (action === "warn") {
    const warns = addWarning(senderId, groupId, `Used blacklisted word: "${found}"`, "Blacklist System");
    const count = warns.length;
    await sendText(
      groupId,
      `┌─❖\n│「 ⚠️ 𝗪𝗔𝗥𝗡𝗜𝗡𝗚 」\n└┬❖ 「 @${senderId.split("@")[0]} 」\n│✑ 𝗥𝗘𝗔𝗦𝗢𝗡: Used blacklisted word: "${found}"\n│✑ 𝗟𝗜𝗠𝗜𝗧: ${count} / 5\n└────────────┈ ⳹`,
      [senderId]
    );
    if (count >= 5) {
      await sock.groupParticipantsUpdate(groupId, [senderId], "remove");
    }
  } else if (action === "kick") {
    await sock.groupParticipantsUpdate(groupId, [senderId], "remove");
    await sendText(groupId, `🚫 @${senderId.split("@")[0]} was removed — used blacklisted word: "${found}"`, [senderId]);
  } else {
    await sendText(
      groupId,
      `🚫 Message from @${senderId.split("@")[0]} deleted — contains blacklisted word: "${found}"`,
      [senderId]
    );
  }

  return true;
}
