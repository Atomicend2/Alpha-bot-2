import type { WASocket } from "@whiskeysockets/baileys";
import type { CommandContext } from "./index.js";
import {
  ensureGroup, getGroup, updateGroup, getWarnings, addWarning, resetWarnings,
  getActiveMembers, getInactiveMembers, getMods, addMod, isMod, getGroupActivity,
  muteUser, unmuteUser, getCardStats,
} from "../db/queries.js";
import { sendText } from "../connection.js";
import { formatNumber, mentionTag } from "../utils.js";

export async function handleAdmin(ctx: CommandContext): Promise<void> {
  const { sock, msg, from, sender, args, isAdmin, isBotAdmin, isOwner, isGroupAdmin, groupMeta, prefix } = ctx;
  const cmd = ctx.command;

  if (!from.endsWith("@g.us")) {
    await sendText(from, "❌ This command can only be used in groups.");
    return;
  }

  const group = getGroup(from) || {};
  const canUse = isAdmin || isMod(sender, from) || isOwner;

  if (cmd === "kick") {
    if (!canUse) return noPerms(from);
    if (!isBotAdmin) return botNoAdmin(from);
    const info = msg.message?.extendedTextMessage?.contextInfo;
    const mentioned = info?.mentionedJid?.[0]
      || info?.participant
      || (args[0] ? `${args[0].replace(/\D/g, "")}@s.whatsapp.net` : null);
    if (!mentioned) {
      await sendText(from, "❌ Please mention someone to kick or reply to their message with .kick.");
      return;
    }
    await sock.groupParticipantsUpdate(from, [mentioned], "remove");
    await sock.sendMessage(from, {
      text: `🚫 @${mentioned.split("@")[0]} has been kicked successfully.`,
      mentions: [mentioned],
    });
    return;
  }

  if (cmd === "delete" || cmd === "del") {
    if (!canUse) return noPerms(from);
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (!quoted) {
      await sendText(from, "❌ Reply to a message to delete it.");
      return;
    }
    const key = {
      remoteJid: from,
      fromMe: false,
      id: quoted,
      participant: msg.message?.extendedTextMessage?.contextInfo?.participant,
    };
    await sock.sendMessage(from, { delete: key });
    return;
  }

  if (cmd === "warn") {
    if (!canUse) return noPerms(from);
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) {
      await sendText(from, "❌ Please mention someone to warn.");
      return;
    }
    const reason = args.slice(1).join(" ") || "No reason provided";
    const warns = addWarning(mentioned, from, reason, sender);
    const count = warns.length;
    await sendText(
      from,
      `┌─❖\n│「 ⚠️ 𝗪𝗔𝗥𝗡𝗜𝗡𝗚 」\n└┬❖ 「 @${mentioned.split("@")[0]} 」\n│✑ 𝗥𝗘𝗔𝗦𝗢𝗡: ${reason}\n│✑ 𝗗𝗲𝘃𝗶𝗰𝗲: WhatsApp\n│✑ 𝗟𝗜𝗠𝗜𝗧: ${count} / 5\n└────────────┈ ⳹`,
      [mentioned]
    );
    if (count >= 5) {
      if (isBotAdmin) {
        await sock.groupParticipantsUpdate(from, [mentioned], "remove");
        await sendText(from, `🚫 @${mentioned.split("@")[0]} reached 5 warnings and was removed.`, [mentioned]);
      }
    }
    return;
  }

  if (cmd === "resetwarn") {
    if (!canUse) return noPerms(from);
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) {
      await sendText(from, "❌ Please mention someone.");
      return;
    }
    resetWarnings(mentioned, from);
    await sendText(from, `✅ Warnings reset for @${mentioned.split("@")[0]}.`, [mentioned]);
    return;
  }

  if (cmd === "antilink") {
    if (!canUse) return noPerms(from);
    const action = args[0]?.toLowerCase();
    if (!action || action === "on") {
      updateGroup(from, { antilink: "on", antilink_action: args[1] || "delete" });
      await sendText(from, `🔗 Anti-Link enabled (action: ${args[1] || "delete"})`);
    } else if (action === "off") {
      updateGroup(from, { antilink: "off" });
      await sendText(from, "🔗 Anti-Link disabled.");
    } else if (action === "set") {
      const a = args[1]?.toLowerCase();
      if (!["delete","warn","kick"].includes(a)) {
        await sendText(from, "Valid actions: delete, warn, kick");
        return;
      }
      updateGroup(from, { antilink: "on", antilink_action: a });
      await sendText(from, `🔗 Anti-Link action set to: ${a}`);
    }
    return;
  }

  if (cmd === "antism") {
    if (!canUse) return noPerms(from);
    const val = args[0]?.toLowerCase();
    if (val === "on") {
      updateGroup(from, { antispam: "on" });
      await sendText(from, "🚫 Anti-Spam enabled.");
    } else {
      updateGroup(from, { antispam: "off" });
      await sendText(from, "🚫 Anti-Spam disabled.");
    }
    return;
  }

  if (cmd === "welcome") {
    if (!canUse) return noPerms(from);
    const val = args[0]?.toLowerCase();
    updateGroup(from, { welcome: val === "on" ? "on" : "off" });
    await sendText(from, `✉️ Welcome messages ${val === "on" ? "enabled" : "disabled"}.`);
    return;
  }

  if (cmd === "setwelcome") {
    if (!canUse) return noPerms(from);
    const msg_text = args.join(" ");
    if (!msg_text) {
      await sendText(from, "❌ Usage: .setwelcome <message>\nUse @mention where the new member should be tagged.");
      return;
    }
    updateGroup(from, { welcome_msg: msg_text });
    const preview = msg_text.replace(/@mention/gi, mentionTag(sender));
    await sendText(
      from,
      `✅ Welcome message set!\n\nPreview:\n${preview}\n\nWhen someone joins, @mention will tag that person.`,
      /@mention/i.test(msg_text) ? [sender] : []
    );
    return;
  }

  if (cmd === "leave") {
    if (!canUse) return noPerms(from);
    const val = args[0]?.toLowerCase();
    updateGroup(from, { leave: val === "on" ? "on" : "off" });
    await sendText(from, `🚪 Leave messages ${val === "on" ? "enabled" : "disabled"}.`);
    return;
  }

  if (cmd === "setleave") {
    if (!canUse) return noPerms(from);
    const msg_text = args.join(" ");
    updateGroup(from, { leave_msg: msg_text });
    await sendText(from, `✅ Leave message set!\n\nPreview:\n${msg_text}`);
    return;
  }

  if (cmd === "promote") {
    if (!canUse) return noPerms(from);
    if (!isBotAdmin) return botNoAdmin(from);
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      || msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (!mentioned) {
      await sendText(from, "❌ Please mention someone.");
      return;
    }
    await sock.groupParticipantsUpdate(from, [mentioned], "promote");
    await sock.sendMessage(from, {
      text: `@${mentioned.split("@")[0]} is now an admin`,
      mentions: [mentioned],
    });
    return;
  }

  if (cmd === "demote") {
    if (!canUse) return noPerms(from);
    if (!isBotAdmin) return botNoAdmin(from);
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      || msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (!mentioned) {
      await sendText(from, "❌ Please mention someone.");
      return;
    }
    await sock.groupParticipantsUpdate(from, [mentioned], "demote");
    await sock.sendMessage(from, {
      text: `@${mentioned.split("@")[0]} is no longer an admin`,
      mentions: [mentioned],
    });
    return;
  }

  if (cmd === "pm") {
    if (!isBotAdmin) return botNoAdmin(from);
    const info = msg.message?.extendedTextMessage?.contextInfo;
    const mentioned = info?.mentionedJid?.[0] || info?.participant;
    if (!mentioned) {
      await sendText(from, "❌ Please mention someone or reply to their message with .pm");
      return;
    }
    await sock.groupParticipantsUpdate(from, [mentioned], "promote");
    await sendText(from, "Done.");
    return;
  }

  if (cmd === "dm") {
    if (!isBotAdmin) return botNoAdmin(from);
    const info = msg.message?.extendedTextMessage?.contextInfo;
    const mentioned = info?.mentionedJid?.[0] || info?.participant;
    if (!mentioned) {
      await sendText(from, "❌ Please mention someone or reply to their message with .dm");
      return;
    }
    await sock.groupParticipantsUpdate(from, [mentioned], "demote");
    await sendText(from, "Done.");
    return;
  }

  if (cmd === "mute") {
    if (!canUse) return noPerms(from);
    if (!isBotAdmin) return botNoAdmin(from);
    const info = msg.message?.extendedTextMessage?.contextInfo;
    const target = info?.mentionedJid?.[0] || info?.participant || null;
    if (target) {
      const durationText = info?.mentionedJid?.[0] ? args[1] : args[0];
      const durationSeconds = parseDuration(durationText || "1h");
      if (!durationSeconds) {
        await sendText(from, "❌ Usage: .mute @user <time>\nExamples: .mute @user 1m, or reply with .mute 1h");
        return;
      }
      const expiresAt = Math.floor(Date.now() / 1000) + durationSeconds;
      muteUser(target, from, sender, expiresAt);
      await sendText(from, `🔇 @${target.split("@")[0]} muted for ${formatDuration(durationSeconds)}.`, [target]);
      return;
    }
    await sock.groupSettingUpdate(from, "announcement");
    updateGroup(from, { muted: 1 });
    await sendText(from, "🔇 Group muted. Only admins can send messages.");
    return;
  }

  if (cmd === "unmute") {
    if (!canUse) return noPerms(from);
    if (!isBotAdmin) return botNoAdmin(from);
    const info = msg.message?.extendedTextMessage?.contextInfo;
    const target = info?.mentionedJid?.[0] || info?.participant || null;
    if (target) {
      unmuteUser(target, from);
      await sendText(from, `🔊 @${target.split("@")[0]} unmuted.`, [target]);
      return;
    }
    await sock.groupSettingUpdate(from, "not_announcement");
    updateGroup(from, { muted: 0 });
    await sendText(from, "🔊 Group unmuted.");
    return;
  }

  if (cmd === "open") {
    if (!canUse) return noPerms(from);
    if (!isBotAdmin) return botNoAdmin(from);
    await sock.groupSettingUpdate(from, "not_announcement");
    await sendText(from, "🔓 Group opened.");
    return;
  }

  if (cmd === "close") {
    if (!canUse) return noPerms(from);
    if (!isBotAdmin) return botNoAdmin(from);
    await sock.groupSettingUpdate(from, "announcement");
    await sendText(from, "🔒 Group closed. Only admins can send messages.");
    return;
  }

  if (cmd === "hidetag") {
    if (!canUse) return noPerms(from);
    const participants = groupMeta?.participants || [];
    const all = participants.map((p: any) => p.id);
    const text = args.join(" ") || "📢 Announcement";
    await sock.sendMessage(from, { text, mentions: all });
    return;
  }

  if (cmd === "tagall") {
    if (!canUse) return noPerms(from);
    const participants = groupMeta?.participants || [];
    const mentions: string[] = participants.map((p: any) => p.id);
    const announcement = args.join(" ") || "📢 Attention everyone!";
    const senderName = sender.split("@")[0];
    let memberLines = "";
    for (const p of participants) {
      memberLines += `│  ➤ @${p.id.split("@")[0]}\n`;
    }
    const text =
      `╭─❰ 👥 ᴛᴀɢ ᴀʟʟ ɴᴏᴛɪɢʏ ❱─╮\n` +
      `│ 📢 Message: ${announcement}\n` +
      `│ 👤 From: @${senderName}\n` +
      `│\n` +
      `├─ 📌 ᴛᴀɢ ʟɪsᴛ\n` +
      `${memberLines}` +
      `╰────────────── ───╯`;
    await sock.sendMessage(from, { text, mentions: [...mentions, sender] });
    return;
  }

  if (cmd === "activity") {
    const activity = getGroupActivity(from);
    const isActive = activity.percentage >= 30;
    const statusLine = isActive
      ? `📌 𝗦𝘁𝗮𝘁𝘂𝘀: ✅ 𝗔𝗰𝘁𝗶𝘃𝗲`
      : `📌 𝗦𝘁𝗮𝘁𝘂𝘀: ❌ 𝗜𝗻𝗮𝗰𝘁𝗶𝘃𝗲`;
    const footer = isActive
      ? `> *✅ This group has enough activity for cards to be enabled 🎴*`
      : `> *⚠️ This group needs to reach 30% in order for a mod/guardian to enable cards 🎴*`;
    const text =
      `📊 𝗚𝗥𝗢𝗨𝗣 𝗔𝗖𝗧𝗜𝗩𝗜𝗧𝗬 𝗥𝗘𝗣𝗢𝗥𝗧\n\n` +
      `💬 𝗠𝗲𝘀𝘀𝗮𝗴𝗲𝘀 (20𝗺): ${activity.count}\n` +
      `📈 𝗣𝗲𝗿𝗰𝗲𝗻𝘁𝗮𝗴𝗲: ${activity.percentage}%\n` +
      `${statusLine}\n\n` +
      `${footer}`;
    await sendText(from, text);
    return;
  }

  if (cmd === "active" || cmd === "inactive") {
    if (!canUse) return noPerms(from);
    const active = getActiveMembers(from);
    const counted = new Set(active.map((m) => m.user_id));
    const inactiveFromCounts = getInactiveMembers(from);
    const inactiveMap = new Map<string, any>();
    for (const member of inactiveFromCounts) inactiveMap.set(member.user_id, member);
    for (const participant of groupMeta?.participants || []) {
      if (!counted.has(participant.id) && !inactiveMap.has(participant.id)) {
        inactiveMap.set(participant.id, { user_id: participant.id, count: 0 });
      }
    }
    const inactive = [...inactiveMap.values()];

    let text = `╔═ ❰ 👥 𝗠𝗘𝗠𝗕𝗘𝗥 𝗦𝗧𝗔𝗧𝗦 ❱ ═╗\n`;
    text += `║ 🟢 Active Members: ${active.length}\n`;
    text += `║ 🔴 Inactive Members (≤ 5 msgs in 7d): ${inactive.length}\n║\n`;

    if (cmd !== "inactive") {
      text += `╠═ 🟢 𝗔𝗖𝗧𝗜𝗩𝗘\n`;
      for (const m of active) {
        text += `║ ○ @${m.user_id.split("@")[0]}\n`;
      }
      text += "║\n";
    }

    if (cmd !== "active") {
      text += `╠═ 🔴 𝗜𝗡𝗔𝗖𝗧𝗜𝗩𝗘\n`;
      for (const m of inactive) {
        text += `║ ○ @${m.user_id.split("@")[0]}\n`;
      }
    }

    text += "╚══════════════════╝";

    const all = [...active, ...inactive].map((m) => m.user_id);
    await sock.sendMessage(from, { text, mentions: all });
    return;
  }

  if (cmd === "gamble") {
    if (!canUse) return noPerms(from);
    const val = args[0]?.toLowerCase();
    if (val === "on") {
      updateGroup(from, { gambling_enabled: "on" });
      await sendText(from, "🎰 Gambling commands are now *enabled*.");
    } else if (val === "off") {
      updateGroup(from, { gambling_enabled: "off" });
      await sendText(from, "🎰 Gambling commands are now *disabled*.");
    } else {
      const g = getGroup(from);
      await sendText(from, `🎰 Gambling is currently: *${g?.gambling_enabled || "on"}*\nUsage: .gamble on/off`);
    }
    return;
  }

  if (cmd === "cards") {
    if (args[0]?.toLowerCase() === "available") {
      const stats = getCardStats();
      const tierLines = stats.byTier.length > 0
        ? stats.byTier.map((row: any) => `• ${row.tier}: ${row.count}`).join("\n")
        : "• None";
      const seriesLines = stats.bySeries.length > 0
        ? stats.bySeries.map((row: any) => `• ${row.series || "General"}: ${row.count}`).join("\n")
        : "• None";
      await sendText(
        from,
        `🎴 *Cards Available*\n\n` +
        `Total cards in database: *${stats.total}*\n\n` +
        `*By Tier:*\n${tierLines}\n\n` +
        `*Top Series:*\n${seriesLines}`
      );
      return;
    }
    if (!canUse) return noPerms(from);
    const val = args[0]?.toLowerCase();
    if (val === "on") {
      const activity = getGroupActivity(from);
      if (activity.percentage < 30) {
        await sendText(from,
          `❌ Cannot enable cards yet!\n\n` +
          `📈 Current activity: *${activity.percentage}%* (need 30%)\n` +
          `💬 Messages in 20min: ${activity.count}/600\n\n` +
          `> Use *.activity* to check group activity status.`
        );
        return;
      }
      updateGroup(from, { cards_enabled: "on", spawn_enabled: "on" });
      await sendText(from, "🎴 Card spawning is now *enabled*!");
    } else if (val === "off") {
      updateGroup(from, { cards_enabled: "off", spawn_enabled: "off" });
      await sendText(from, "🎴 Card spawning is now *disabled*.");
    } else {
      const g = getGroup(from);
      await sendText(from, `🎴 Cards are currently: *${g?.cards_enabled || "on"}*\nUsage: .cards on/off`);
    }
    return;
  }

  if (cmd === "antibot") {
    if (!canUse) return noPerms(from);
    const val = args[0]?.toLowerCase();
    if (val === "on") {
      updateGroup(from, { anti_bot: "on" });
      await sendText(from, "🤖 Anti-Bot enabled. Bot accounts joining will be automatically kicked.");
    } else if (val === "off") {
      updateGroup(from, { anti_bot: "off" });
      await sendText(from, "🤖 Anti-Bot disabled.");
    } else {
      const g = getGroup(from);
      await sendText(from, `🤖 Anti-Bot is currently: *${g?.anti_bot || "off"}*\nUsage: .antibot on/off`);
    }
    return;
  }

  if (cmd === "purge") {
    if (!canUse) return noPerms(from);
    await sendText(from, "⚠️ Purge command is not available via WhatsApp API.");
    return;
  }

  if (cmd === "blacklist") {
    if (!canUse) return noPerms(from);
    const sub = args[0]?.toLowerCase();
    const g = getGroup(from);
    let bl: string[] = [];
    try { bl = JSON.parse(g?.blacklist || "[]"); } catch { bl = []; }

    if (sub === "add") {
      const word = args.slice(1).join(" ");
      if (!word) { await sendText(from, "❌ Provide a word to blacklist."); return; }
      if (!bl.includes(word)) bl.push(word);
      updateGroup(from, { blacklist: JSON.stringify(bl) });
      await sendText(from, `✅ Added "${word}" to blacklist.`);
    } else if (sub === "remove") {
      const word = args.slice(1).join(" ");
      bl = bl.filter((w) => w !== word);
      updateGroup(from, { blacklist: JSON.stringify(bl) });
      await sendText(from, `✅ Removed "${word}" from blacklist.`);
    } else if (sub === "list") {
      if (bl.length === 0) {
        await sendText(from, "🔒 No blacklisted words.");
      } else {
        await sendText(from, `🔒 *Blacklisted Words:*\n${bl.map((w) => `• ${w}`).join("\n")}`);
      }
    } else {
      await sendText(from, "Usage: .blacklist add [word] | .blacklist remove [word] | .blacklist list");
    }
    return;
  }

  if (cmd === "gi") {
    const meta = groupMeta;
    const admins = meta?.participants?.filter((p: any) => p.admin) || [];
    const adminCount = admins.length;
    const memberCount = meta?.participants?.length || 0;
    const groupName = meta?.subject || "Unknown";
    const groupDesc = meta?.desc || meta?.description || "No description";
    const creation = meta?.creation
      ? new Date(Number(meta.creation) * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      : "Unknown";
    let adminLines = admins.slice(0, 5).map((p: any) => `║   • @${p.id.split("@")[0]}`).join("\n");
    if (admins.length > 5) adminLines += `\n║   ...and ${admins.length - 5} more`;
    const text =
      `╔═ ❰ ℹ️ 𝗚𝗥𝗢𝗨𝗣 𝗜𝗡𝗙𝗢 ❱ ═╗\n` +
      `║ 📛 𝗡𝗮𝗺𝗲: ${groupName}\n` +
      `║ 👥 𝗠𝗲𝗺𝗯𝗲𝗿𝘀: ${memberCount}\n` +
      `║ 🛡️ 𝗔𝗱𝗺𝗶𝗻𝘀: ${adminCount}\n` +
      `║ 📅 𝗖𝗿𝗲𝗮𝘁𝗲𝗱: ${creation}\n║\n` +
      `║ 📝 𝗗𝗲𝘀𝗰𝗿𝗶𝗽𝘁𝗶𝗼𝗻:\n║   ${groupDesc.slice(0, 200)}\n║\n` +
      `║ 🛡️ 𝗔𝗱𝗺𝗶𝗻𝘀:\n${adminLines || "║   None"}\n` +
      `╚══════════════════╝`;
    await sock.sendMessage(from, { text, mentions: admins.slice(0, 5).map((p: any) => p.id) });
    return;
  }

  if (cmd === "groupinfo") {
    const g = getGroup(from);
    const meta = groupMeta;
    const admins = meta?.participants?.filter((p: any) => p.admin)?.length || 0;
    let bl: string[] = [];
    try { bl = JSON.parse(g?.blacklist || "[]"); } catch {}

    const text = `╔═ ❰ 📊 𝗚𝗥𝗢𝗨𝗣 𝗖𝗢𝗡𝗙𝗜𝗚 ❱ ═╗\n` +
      `║ 👥 𝗣𝗮𝗿𝘁𝗶𝗰𝗶𝗽𝗮𝗻𝘁𝘀: ${meta?.participants?.length || "?"}\n` +
      `║ 🛡️ 𝗔𝗱𝗺𝗶𝗻𝘀: ${admins}\n║\n` +
      `║ 🔗 𝗔𝗻𝘁𝗶-𝗟𝗶𝗻𝗸: ${g?.antilink || "off"} (${g?.antilink_action || "delete"})\n` +
      `║ 🚫 𝗔𝗻𝘁𝗶-𝗦𝗽𝗮𝗺: ${g?.antispam || "off"}\n` +
      `║ 🤖 𝗔𝗻𝘁𝗶-𝗕𝗼𝘁: ${g?.anti_bot || "off"}\n║\n` +
      `║ ✉️ 𝗪𝗲𝗹𝗰𝗼𝗺𝗲: ${g?.welcome || "off"}\n` +
      `║ 📨 𝗠𝘀𝗴: ${g?.welcome_msg || "(default)"}\n║\n` +
      `║ 🚪 𝗟𝗲𝗮𝘃𝗲: ${g?.leave || "off"}\n` +
      `║ 📨 𝗠𝘀𝗴: ${g?.leave_msg || "(default)"}\n║\n` +
      `║ 🎴 𝗖𝗮𝗿𝗱𝘀: ${g?.cards_enabled || "on"}\n` +
      `║ 🎮 𝗚𝗮𝗺𝗲𝘀: ${g?.games_enabled || "on"}\n` +
      `║ 🎰 𝗚𝗮𝗺𝗯𝗹𝗶𝗻𝗴: ${g?.gambling_enabled || "on"}\n║\n` +
      `║ 🔒 𝗕𝗹𝗮𝗰𝗸𝗹𝗶𝘀𝘁: ${bl.length} words\n` +
      `╚══════════════════╝`;

    await sendText(from, text);
    return;
  }

  if (cmd === "gcl" || cmd === "gclink") {
    if (!canUse) return noPerms(from);
    if (!isBotAdmin) return botNoAdmin(from);
    const now = Math.floor(Date.now() / 1000);
    const gclCooldown = 30;
    const lastGcl = Number(group?.last_gcl || 0);
    const gclDiff = now - lastGcl;
    if (gclDiff < gclCooldown) {
      await sendText(from, `⏳ Please wait ${gclCooldown - gclDiff}s before getting the link again.`);
      return;
    }
    try {
      const inviteCode = await sock.groupInviteCode(from);
      const link = `https://chat.whatsapp.com/${inviteCode}`;
      const { updateGroup } = await import("../db/queries.js");
      updateGroup(from, { last_gcl: now });
      await sock.sendMessage(from, { text: link });
    } catch {
      await sendText(from, "❌ Failed to get group invite link. Make sure the bot is an admin.");
    }
    return;
  }

  if (cmd === "groupstats" || cmd === "gs") {
    const active = getActiveMembers(from);
    const inactive = getInactiveMembers(from);
    const meta = groupMeta;
    const g = getGroup(from);
    let bl: string[] = [];
    try { bl = JSON.parse(g?.blacklist || "[]"); } catch {}
    const admins = meta?.participants?.filter((p: any) => p.admin)?.length || 0;

    const text = `╔═ ❰ 📊 𝗚𝗥𝗢𝗨𝗣 𝗦𝗧𝗔𝗧𝗦 📊 ❱ ═╗\n` +
      `║ 👥 𝗣𝗮𝗿𝘁𝗶𝗰𝗶𝗽𝗮𝗻𝘁𝘀: ${meta?.participants?.length || "?"}\n` +
      `║ 🛡️ 𝗔𝗱𝗺𝗶𝗻𝘀: ${admins}\n║\n` +
      `║ 🔗 𝗔𝗻𝘁𝗶-𝗟𝗶𝗻𝗸: ${g?.antilink || "off"} (${g?.antilink_action || "delete"})\n` +
      `║ 🚫 𝗔𝗻𝘁𝗶-𝗦𝗽𝗮𝗺: ${g?.antispam || "off"}\n` +
      `║ 👑 𝗔𝗻𝘁𝗶-𝗔𝗱𝗺𝗶𝗻: ${g?.anti_admin || "off"}\n` +
      `║ 🤖 𝗔𝗻𝘁𝗶-𝗕𝗼𝘁: ${g?.anti_bot || "off"}\n` +
      `║ 🏕️ 𝗔𝗻𝘁𝗶-𝗖𝗮𝗺𝗽𝗶𝗻𝗴: ${g?.anti_camping || "off"}\n║\n` +
      `║ ✉️ 𝗪𝗲𝗹𝗰𝗼𝗺𝗲: ${g?.welcome || "off"}\n` +
      `║ 📨 𝗠𝘀𝗴: ${g?.welcome_msg || "(default)"}\n║\n` +
      `║ 🚪 𝗟𝗲𝗮𝘃𝗲: ${g?.leave || "off"}\n` +
      `║ 📨 𝗠𝘀𝗴: ${g?.leave_msg || "(default)"}\n║\n` +
      `║ 🎴 𝗖𝗮𝗿𝗱𝘀: ${g?.cards_enabled || "on"}\n` +
      `║ 🎴 𝗦𝗽𝗮𝘄𝗻: ${g?.spawn_enabled || "on"}\n` +
      `║ 🎮 𝗚𝗮𝗺𝗲𝘀: ${g?.games_enabled || "on"}\n` +
      `║ 🎰 𝗚𝗮𝗺𝗯𝗹𝗶𝗻𝗴: ${g?.gambling_enabled || "on"}\n║\n` +
      `║ 🔒 𝗕𝗹𝗮𝗰𝗸𝗹𝗶𝘀𝘁: ${bl.length} words\n` +
      `╚══════════════════╝`;

    await sendText(from, text);
    return;
  }

  if (cmd === "addmod") {
    if (!isAdmin && !isOwner) return noPerms(from);
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) { await sendText(from, "❌ Mention someone."); return; }
    addMod(mentioned, from, sender);
    await sendText(from, `✅ @${mentioned.split("@")[0]} is now a mod in this group.`, [mentioned]);
    return;
  }
}

async function noPerms(jid: string) {
  await sendText(jid, "❌ You don't have permission to use this command.");
}

async function botNoAdmin(jid: string) {
  await sendText(jid, "❌ Bot needs admin privileges to perform this action.");
}

function parseDuration(input?: string): number | null {
  if (!input) return null;
  const match = input.trim().match(/^(\d+)(s|m|h|d|y)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, y: 31536000 };
  return value > 0 ? value * multipliers[unit] : null;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 31536000) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 31536000)}y`;
}
