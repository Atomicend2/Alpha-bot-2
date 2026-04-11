import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";
import { addStaff, getStaffList, getStaff, ensureUser, getUser, updateUser, getCard, getAllCards } from "../db/queries.js";
import { getTierEmoji, isValidTier, generateId } from "../utils.js";
import { getDb } from "../db/database.js";
import { spawnCard } from "../handlers/cardspawn.js";
import { addCard } from "../db/queries.js";
import axios from "axios";

export async function handleStaff(ctx: CommandContext): Promise<void> {
  const { from, sender, args, command: cmd, msg, sock, isOwner } = ctx;

  if (!isOwner && !getStaff(sender)) {
    await sendText(from, "❌ This command requires staff access.");
    return;
  }

  if (cmd === "addmod") {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) { await sendText(from, "❌ Mention someone."); return; }
    addStaff(mentioned, "mod", sender);
    await sock.sendMessage(from, {
      text: `✅ @${mentioned.split("@")[0]} added as mod.`,
      mentions: [mentioned],
    });
    return;
  }

  if (cmd === "addguardian") {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) { await sendText(from, "❌ Mention someone."); return; }
    addStaff(mentioned, "guardian", sender);
    await sock.sendMessage(from, {
      text: `🛡️ @${mentioned.split("@")[0]} added as guardian.`,
      mentions: [mentioned],
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

  if (cmd === "modlist") {
    const staff = getStaffList();
    if (staff.length === 0) { await sendText(from, "No staff members."); return; }
    const text = "👑 *Staff List*\n\n" +
      staff.map((s) => `• @${s.user_id.split("@")[0]} (${s.role})`).join("\n");
    await sock.sendMessage(from, { text, mentions: staff.map((s) => s.user_id) });
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
    try {
      const code = link.split("chat.whatsapp.com/").pop() || link;
      await sock.groupAcceptInvite(code);
      await sendText(from, "✅ Joined group!");
    } catch {
      await sendText(from, "❌ Failed to join group.");
    }
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
      await sendText(from, "❌ Usage: .upload [T1/T2/T3/T4/T5/TS/TX] (reply to image)\nOptionally: .upload T4 CardName | Series | description");
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

    const extraArgs = args.slice(1).join(" ").split("|").map((s) => s.trim());
    const cardName = extraArgs[0] || `Card_${Date.now()}`;
    const cardSeries = extraArgs[1] || "General";
    const cardDesc = extraArgs[2] || "";

    const db = getDb();
    const existingIds = new Set(db.prepare("SELECT id FROM cards").all().map((r: any) => r.id));

    try {
      await sendText(from, "⏳ Downloading image and saving card...");
      const stream = await sock.downloadMediaMessage({ message: quotedMsg, key: { id: "", remoteJid: from, fromMe: false } } as any);
      const chunks: Buffer[] = [];
      for await (const chunk of stream as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const imageBuffer = Buffer.concat(chunks);

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
