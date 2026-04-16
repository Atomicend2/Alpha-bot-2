import type { CommandContext } from "./index.js";
import { BOT_OWNER_LID, sendText } from "../connection.js";
import { addStaff, removeStaff, getStaffList, getStaff, ensureUser, getUser, updateUser, getCard, getAllCards, addBan, removeBan, getBanList, setBotSetting, deleteBotSetting, resetUserBalance, resetUserProfile, isBanned, addFrame, getAllFrames } from "../db/queries.js";
import { getTierEmoji, isValidTier, generateId, IMAGE_TIERS, VIDEO_TIERS } from "../utils.js";
import { INTERACTION_NAMES, uploadInteractionGif } from "./interactions.js";
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
      const downloaded = await downloadMediaMessage(target as any, "buffer", {}, { reuploadRequest: (sock as any).updateMediaMessage, logger: logger as any });
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
    const canManageCash = isOwner || staffRecord?.role === "mod" || staffRecord?.role === "guardian";
    if (!canManageCash) {
      await sendText(from, "❌ Only the owner, mods, and guardians can use this command.");
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
    const cardId = args[0];
    if (!cardId) { await sendText(from, "❌ Provide card ID to delete."); return; }
    const card = getCard(cardId);
    if (!card) { await sendText(from, "❌ Card not found."); return; }
    const { deleteCard } = await import("../db/queries.js");
    deleteCard(cardId);
    await sendText(from, `✅ Deleted card *${card.name}* (${cardId}).`);
    return;
  }

  if (cmd === "dci") {
    // Delete a specific user card by its issue ID (user_card_id)
    const issueId = args[0];
    if (!issueId) { await sendText(from, "❌ Usage: .dci <issue_id>\nThe issue ID appears in .collection output."); return; }
    const db = (await import("../db/database.js")).getDb();
    const issue = db.prepare("SELECT uc.*, c.name FROM user_cards uc JOIN cards c ON uc.id = c.id WHERE uc.user_card_id = ?").get(issueId) as any;
    if (!issue) { await sendText(from, `❌ No card issue found with ID: \`${issueId}\``); return; }
    db.prepare("DELETE FROM user_cards WHERE user_card_id = ?").run(issueId);
    // Also remove from any decks
    try { db.prepare("UPDATE decks SET card1=NULL WHERE card1=?").run(issueId); } catch {}
    try { db.prepare("UPDATE decks SET card2=NULL WHERE card2=?").run(issueId); } catch {}
    try { db.prepare("UPDATE decks SET card3=NULL WHERE card3=?").run(issueId); } catch {}
    await sendText(from, `🗑️ Deleted issue \`${issueId}\` — *${issue.name}* from @${issue.user_id?.split("@")[0]}'s collection.`, [issue.user_id]);
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

  if (cmd === "frame") {
    const canManageFrames = isOwner || staffRecord?.role === "mod" || staffRecord?.role === "guardian";
    if (!canManageFrames) {
      await sendText(from, "❌ Only owner, mods, and guardians can manage frames.");
      return;
    }
    const subCmd = args[0]?.toLowerCase();

    if (subCmd === "list") {
      const frames = getAllFrames();
      if (frames.length === 0) {
        await sendText(from, "🖼️ No profile frames uploaded yet.");
        return;
      }
      const list = frames.map((f: any, i: number) => `${i + 1}. *${f.name}* — ID: \`${f.id}\``).join("\n");
      await sendText(from, `🖼️ *Profile Frames* (${frames.length})\n\n${list}`);
      return;
    }

    if (subCmd === "upload") {
      const frameName = args.slice(1).join(" ").trim();
      if (!frameName) {
        await sendText(from, "❌ Usage: .frame upload <name>\nReply to an image with this command to upload a profile frame.");
        return;
      }
      const quoted = msg.message?.extendedTextMessage?.contextInfo;
      const quotedMsg = quoted?.quotedMessage;
      const hasImage = !!(quotedMsg?.imageMessage || msg.message?.imageMessage);
      if (!hasImage) {
        await sendText(from, "❌ Reply to an image to upload it as a profile frame.");
        return;
      }
      try {
        await sendText(from, "⏳ Processing frame...");
        const context = msg.message?.extendedTextMessage?.contextInfo;
        let mediaMsg: any;
        if (quotedMsg?.imageMessage) {
          mediaMsg = { key: { remoteJid: from, fromMe: false, id: context?.stanzaId || "", participant: context?.participant }, message: quotedMsg };
        } else {
          mediaMsg = msg;
        }
        const downloaded = await downloadMediaMessage(
          mediaMsg as any,
          "buffer",
          {},
          { reuploadRequest: (sock as any).updateMediaMessage, logger: logger as any }
        );
        let imgBuf = Buffer.isBuffer(downloaded) ? downloaded : Buffer.from(downloaded as any);
        const sharp = (await import("sharp")).default;
        imgBuf = await sharp(imgBuf).resize(256, 256, { fit: "cover" }).png().toBuffer();
        const { randomUUID } = await import("crypto");
        const frameId = randomUUID();
        addFrame(frameId, frameName, imgBuf);
        await sendText(from, `✅ Frame *${frameName}* uploaded!\n🆔 ID: \`${frameId}\`\n\nUsers can set it with .setframe ${frameId}`);
      } catch (err: any) {
        await sendText(from, `❌ Failed to upload frame: ${err?.message || "unknown error"}`);
      }
      return;
    }

    await sendText(from, "❌ Usage:\n.frame list — list all frames\n.frame upload <name> — reply to image to upload a frame");
    return;
  }

  if (cmd === "upload") {
    if (!isOwner && !getStaff(sender)) {
      await sendText(from, "❌ Only staff can upload cards.");
      return;
    }
    const firstArg = args[0]?.toLowerCase();
    if (firstArg && INTERACTION_NAMES.has(firstArg)) {
      return uploadInteractionGif(ctx, firstArg);
    }
    const tier = args[0]?.toUpperCase();
    if (!tier || !isValidTier(tier)) {
      await sendText(from, "❌ Usage: .upload <tier> <name>|<series>\nImage tiers (photo only): T1 T2 T3 T4 T5\nAnimated tiers (gif/video): T6 TS TX TZ\nExample: .upload T4 Shadow Monarch|Solo Leveling");
      return;
    }

    const isImageTier = IMAGE_TIERS.has(tier);
    const isVideoTier = VIDEO_TIERS.has(tier);

    const quoted = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = quoted?.quotedMessage;

    const hasImage = !!(quotedMsg?.imageMessage || quotedMsg?.stickerMessage || msg.message?.imageMessage);
    const hasVideo = !!(quotedMsg?.videoMessage || msg.message?.videoMessage);
    const hasGif = !!(quotedMsg?.videoMessage?.gifPlayback || msg.message?.videoMessage?.gifPlayback);

    if (!hasImage && !hasVideo) {
      await sendText(from, "❌ Reply with the correct media to upload a card.\nImage tiers (T1–T5): reply to a photo.\nAnimated tiers (T6/TS/TX/TZ): reply to a GIF or short video.");
      return;
    }

    if (isImageTier && (hasVideo || hasGif) && !hasImage) {
      await sendText(from, "❌ This tier requires an image.");
      return;
    }
    if (isVideoTier && hasImage && !hasVideo) {
      await sendText(from, "❌ This tier requires a GIF or short video.");
      return;
    }

    const parsed = parseUploadDetails(args.slice(1).join(" "));
    const cardName = parsed.name || `Card_${Date.now()}`;
    const cardSeries = parsed.series || "General";
    const cardDesc = parsed.description || "";

    const db = getDb();
    const existingIds = new Set(db.prepare("SELECT id FROM cards").all().map((r: any) => r.id));

    try {
      await sendText(from, "⏳ Processing and saving card...");
      const context = msg.message?.extendedTextMessage?.contextInfo;

      let mediaMsg: any;
      if (hasVideo && quotedMsg?.videoMessage) {
        mediaMsg = { key: { remoteJid: from, fromMe: false, id: context?.stanzaId || "", participant: context?.participant }, message: quotedMsg };
      } else if (hasVideo && msg.message?.videoMessage) {
        mediaMsg = msg;
      } else if (hasImage && msg.message?.imageMessage) {
        mediaMsg = msg;
      } else {
        mediaMsg = { key: { remoteJid: from, fromMe: false, id: context?.stanzaId || "", participant: context?.participant }, message: quotedMsg };
      }

      const downloaded = await downloadMediaMessage(
        mediaMsg as any,
        "buffer",
        {},
        { reuploadRequest: (sock as any).updateMediaMessage, logger: logger as any }
      );
      let mediaBuffer = Buffer.isBuffer(downloaded) ? downloaded : Buffer.from(downloaded as any);

      const MAX_SIZE = 10 * 1024 * 1024;
      if (mediaBuffer.length > MAX_SIZE) {
        await sendText(from, `❌ File too large (${(mediaBuffer.length / 1024 / 1024).toFixed(1)}MB). Max 10MB.`);
        return;
      }

      if (isImageTier) {
        const sharp = (await import("sharp")).default;
        mediaBuffer = await sharp(mediaBuffer).resize(700, 900, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
      }

      const { generateUniqueCardId } = await import("../utils.js");
      const cardId = generateUniqueCardId(existingIds);
      const isAnimated = isVideoTier ? 1 : 0;

      addCard({
        id: cardId,
        name: cardName,
        tier,
        series: cardSeries,
        image_data: mediaBuffer,
        description: cardDesc,
        uploaded_by: sender,
      });
      db.prepare("UPDATE cards SET is_animated = ? WHERE id = ?").run(isAnimated, cardId);

      await sendText(from, `✅ Card uploaded!\n\n${getTierEmoji(tier)} *${cardName}*\n📦 Series: ${cardSeries}\n🎖️ Tier: ${tier}\n${isAnimated ? "🎬 Type: Animated\n" : ""}🆔 ID: \`${cardId}\`\n\nUse .spawncard to spawn it!`);
    } catch (err: any) {
      await sendText(from, `❌ Failed to upload card: ${err.message}`);
    }
    return;
  }

  if (cmd === "addrole") {
    if (!isOwner && staffRecord?.role !== "mod" && staffRecord?.role !== "guardian") {
      await sendText(from, "❌ Only mods, guardians, and the owner can use this command.");
      return;
    }
    const role = args[0]?.toLowerCase();
    const info = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const targetId = info?.mentionedJid?.[0] || info?.participant;
    if (!targetId || !role) {
      await sendText(from, "❌ Usage: .addrole <role> @user\nRoles: bot | cardmaker | otp");
      return;
    }
    if (role === "bot") {
      ensureUser(targetId);
      updateUser(targetId, { is_bot: 1 });
      await sendText(from, `✅ @${targetId.split("@")[0]} has been flagged as a bot and excluded from the economy system.`, [targetId]);
    } else if (role === "cardmaker") {
      // Only guardians and owner can assign cardmaker
      if (!isOwner && staffRecord?.role !== "guardian") {
        await sendText(from, "❌ Only guardians and the owner can assign the cardmaker role.");
        return;
      }
      addStaff(targetId, "cardmaker" as any, sender);
      await sendText(from, `🃏 @${targetId.split("@")[0]} has been given the *Card Maker* role and can now upload cards.`, [targetId]);
    } else if (role === "otp") {
      // Only guardians and owner can designate OTP bot
      if (!isOwner && staffRecord?.role !== "guardian") {
        await sendText(from, "❌ Only guardians and the owner can assign the OTP sender role.");
        return;
      }
      ensureUser(targetId);
      setBotSetting("otp_bot_jid", targetId);
      await sendText(from, `🔐 @${targetId.split("@")[0]} bot has been set as the *OTP Sender*. It will deliver login codes to users.`, [targetId]);
    } else {
      await sendText(from, `❌ Unknown role: *${role}*\nAvailable roles: bot | cardmaker | otp`);
    }
    return;
  }

  if (cmd === "addinv") {
    const isStaff = isOwner || staffRecord?.role === "mod" || staffRecord?.role === "guardian";
    if (!isStaff) {
      await sendText(from, "❌ Only mods, guardians, and the owner can use this command.");
      return;
    }
    const info = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const targetId = info?.mentionedJid?.[0] || info?.participant;
    if (!targetId) {
      await sendText(from, "❌ Usage: .addinv @user <item name>\nTag the player and provide the item name.");
      return;
    }
    const itemName = args.filter((a) => !a.startsWith("@")).join(" ").trim();
    if (!itemName) {
      await sendText(from, "❌ Please specify an item name. Usage: .addinv @user <item name>");
      return;
    }
    ensureUser(targetId);
    const { addToInventory } = await import("../db/queries.js");
    addToInventory(targetId, itemName);
    await sendText(
      from,
      `✅ Added *${itemName}* to @${targetId.split("@")[0]}'s inventory.`,
      [targetId]
    );
    return;
  }

  if (cmd === "rules" || cmd === "modslist") {
    if (cmd === "modslist") {
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
      await ctx.sock.sendMessage(from, { text, mentions });
      return;
    }

    const rulesText =
      `*📜SHADOW GARDEN LAWS AND REGULATIONS 📜*\n\n` +
      `*BASIC RULES*\n\n` +
      `1. Respect all Moderators and Guardians\n\n` +
      `2. Please Have a Decent Behavior and don't go around being annoying or doing something that will make you get banned\n\n` +
      `3. Do not Impersonate Staff members\n\n\n` +
      `*ECONOMY,CARDS AND PLAY*\n\n` +
      `1. Multiple Accounts are not allowed. If you are caught playing with more than one account you will be banned\n\n` +
      `2. Using Scripts or bot-assist to auto play for you is completely banned and will not be tolerated if caught\n\n` +
      `3. Don't do Fake card spawns in groups. If you are caught sending any fake card spawns wether in community groups or groups outside the community you will be punished\n\n\n` +
      `*BOT RULES AND CONDUCT*\n\n` +
      `1. If the bot goes off for any reason do not start spamming commands continusly and if you are caught doing such you will be punished\n\n` +
      `2. Spamming the bot while it's on or attempting to crash the bot by spamming is banned\n\n` +
      `3. If the bot is down don't DM staff members asking about why the bot isn't working\n\n` +
      `4. Don't go DM mods asking for bot replacements in your group. If a bot number is banned then wait for it to be unbanned and if number is changed it will be announced\n\n\n` +
      `*REQUIREMENTS FOR BOT ACCESS IN YOUR GROUP*\n\n` +
      `1. The group must have at least up to 80 active members\n\n` +
      `2. A mod/guardian will be there to watch over activity\n\n` +
      `4. Bot and Staff must be granted Admin\n\n` +
      `3. Trying to remove staff from the GC may resort to the bot being removed\n\n` +
      `4. If the group ends up dying or being inactive the bot will be removed\n\n\n` +
      `*STAFF CONTACT*\n\n` +
      `1. To acquire the attention of mods use the command \`.modslist\` to have the list of staff members\n\n` +
      `2. If there is any need to DM a staff don't go there just saying "Hey" or "wsp" State the issue, Problem or what you request\n\n` +
      `3. Do not spam whenever you DM a staff, You may end up being blocked\n\n` +
      `4. Do not contact multiple staff members about the same request or issues\n\n` +
      `5. Do not dm staff asking for an unban when you've committed an offense. If your decided to be unbanned you will be but don't disturb staff members to unban you\n\n\n` +
      `*No one is exempted from these rules* and Everyone should Follow and obey these rules. And if you are caught breaking any of these rules you will be banned immediately\n\n` +
      `*Rules may be changed at anytime* and be announced so stay updated`;
    await sendText(from, rulesText);
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
