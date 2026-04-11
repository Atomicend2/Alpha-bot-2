import type { WASocket } from "@whiskeysockets/baileys";
import type { CommandContext } from "./index.js";
import {
  ensureGroup, getGroup, updateGroup, getWarnings, addWarning, resetWarnings,
  getActiveMembers, getInactiveMembers, getMods, addMod, isMod,
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
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      || (args[0] ? `${args[0].replace(/\D/g, "")}@s.whatsapp.net` : null);
    if (!mentioned) {
      await sendText(from, "❌ Please mention someone to kick.");
      return;
    }
    await sock.groupParticipantsUpdate(from, [mentioned], "remove");
    await sendText(from, `✅ @${mentioned.split("@")[0]} has been removed.`, [mentioned]);
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
    updateGroup(from, { welcome_msg: msg_text });
    await sendText(from, `✅ Welcome message set!\n\nPreview:\n${msg_text}`);
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
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) {
      await sendText(from, "❌ Please mention someone.");
      return;
    }
    await sock.groupParticipantsUpdate(from, [mentioned], "promote");
    await sendText(from, `✅ @${mentioned.split("@")[0]} promoted to admin!`, [mentioned]);
    return;
  }

  if (cmd === "demote") {
    if (!canUse) return noPerms(from);
    if (!isBotAdmin) return botNoAdmin(from);
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) {
      await sendText(from, "❌ Please mention someone.");
      return;
    }
    await sock.groupParticipantsUpdate(from, [mentioned], "demote");
    await sendText(from, `✅ @${mentioned.split("@")[0]} demoted from admin.`, [mentioned]);
    return;
  }

  if (cmd === "mute") {
    if (!canUse) return noPerms(from);
    if (!isBotAdmin) return botNoAdmin(from);
    await sock.groupSettingUpdate(from, "announcement");
    updateGroup(from, { muted: 1 });
    await sendText(from, "🔇 Group muted. Only admins can send messages.");
    return;
  }

  if (cmd === "unmute") {
    if (!canUse) return noPerms(from);
    if (!isBotAdmin) return botNoAdmin(from);
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
    const mentions: string[] = [];
    let text = "📣 Tagging everyone:\n\n";
    for (const p of participants) {
      text += `@${p.id.split("@")[0]} `;
      mentions.push(p.id);
    }
    await sock.sendMessage(from, { text: text.trim(), mentions });
    return;
  }

  if (cmd === "activity" || cmd === "active" || cmd === "inactive") {
    if (!canUse) return noPerms(from);
    const active = getActiveMembers(from);
    const inactive = getInactiveMembers(from);

    let text = `╔═ ❰ 👥 𝗠𝗘𝗠𝗕𝗘𝗥 𝗦𝗧𝗔𝗧𝗦 ❱ ═╗\n`;
    text += `║ 🟢 Active Members: ${active.length}\n`;
    text += `║ 🔴 Inactive Members (≤ 5 msgs in 7d): ${inactive.length}\n║\n`;

    if (cmd !== "inactive") {
      text += `╠═ 🟢 𝗔𝗖𝗧𝗜𝗩𝗘\n`;
      const activeSlice = active.slice(0, 20);
      for (const m of activeSlice) {
        text += `║ ○ @${m.user_id.split("@")[0]}\n`;
      }
      if (active.length > 20) text += `║ ...and ${active.length - 20} more\n`;
      text += "║\n";
    }

    if (cmd !== "active") {
      text += `╠═ 🔴 𝗜𝗡𝗔𝗖𝗧𝗜𝗩𝗘\n`;
      const inactiveSlice = inactive.slice(0, 20);
      for (const m of inactiveSlice) {
        text += `║ ○ @${m.user_id.split("@")[0]}\n`;
      }
      if (inactive.length > 20) text += `║ ...and ${inactive.length - 20} more\n`;
    }

    text += "╚══════════════════╝";

    const all = [...active, ...inactive].map((m) => m.user_id);
    await sock.sendMessage(from, { text, mentions: all });
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

  if (cmd === "groupinfo" || cmd === "gi") {
    const g = getGroup(from);
    const meta = groupMeta;
    const admins = meta?.participants?.filter((p: any) => p.admin)?.length || 0;
    let bl: string[] = [];
    try { bl = JSON.parse(g?.blacklist || "[]"); } catch {}

    const text = `╔═ ❰ 📊 𝗚𝗥𝗢𝗨𝗣 𝗦𝗧𝗔𝗧𝗦 📊 ❱ ═╗\n` +
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
