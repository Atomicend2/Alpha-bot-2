import type { WASocket } from "@whiskeysockets/baileys";
import { ensureGroup, getGroup, isBanned, updateGroup, getStaff } from "../db/queries.js";
import { sendText } from "../connection.js";
import { mentionTag } from "../utils.js";
import { logger } from "../../lib/logger.js";

export async function handleGroupUpdate(sock: WASocket, updates: any[]) {
  for (const update of updates) {
    if (!update.id) continue;
    const group = await sock.groupMetadata(update.id).catch(() => null);
    if (!group) continue;
    ensureGroup(update.id, group.subject);
    if (isBanned("group", update.id)) {
      await sock.groupLeave(update.id).catch(() => {});
    }
  }
}

export async function handleGroupParticipantsUpdate(
  sock: WASocket,
  update: { id: string; participants: string[]; action: string }
) {
  const { id: groupId, participants, action } = update;
  const group = getGroup(groupId) || ensureGroup(groupId);
  if (isBanned("group", groupId)) {
    await sock.groupLeave(groupId).catch(() => {});
    return;
  }

  const botJid = (sock as any).user?.id || "";
  const botPhone = botJid.split(":")[0].split("@")[0];

  for (const participant of participants) {
    const participantPhone = participant.split(":")[0].split("@")[0];
    const isSelf = participantPhone && botPhone && participantPhone === botPhone;

    if (action === "add" && isSelf) {
      let meta: any = null;
      try { meta = await sock.groupMetadata(groupId).catch(() => null); } catch {}
      const groupName = meta?.subject || "this group";
      const memberCount = meta?.participants?.length || "?";
      const botName = (sock as any).user?.name || "Shadow";
      await sendText(groupId,
        `👋 Hey everyone! I'm *${botName}*, your group assistant.\n\n` +
        `📝 I'm here to help manage *${groupName}* (${memberCount} members).\n\n` +
        `> Type *.menu* to see my full command list\n` +
        `> Type *.info* for bot information\n\n` +
        `_Let's get this party started! 🎉_`
      ).catch(() => {});
      continue;
    }

    if (action === "add") {
      const isLikelyBot = participant.endsWith("@lid") || participant.includes(".bot@");
      if (isLikelyBot && (group.anti_bot || "off") === "on") {
        try {
          await sock.groupParticipantsUpdate(groupId, [participant], "remove");
          await sendText(groupId, `🤖 Suspected bot account was automatically removed.`);
        } catch {}
        updateGroup(groupId, { cards_enabled: "off", spawn_enabled: "off" });
        continue;
      }
      if (group.welcome === "on") {
        const template = group.welcome_msg || "Welcome to the group, @mention! 👋";
        const msg = replaceWelcomeMention(template, participant);
        await sendText(groupId, msg, [participant]).catch(() => {});
      }
    } else if (action === "remove" || action === "leave") {
      if (group.leave === "on") {
        const msg = group.leave_msg || `Goodbye @${participant.split("@")[0]}! 👋`;
        await sendText(groupId, msg, [participant]).catch(() => {});
      }
    } else if (action === "pending_approval" || action === "request_to_join") {
      const staff = getStaff(participant);
      if (staff?.role === "mod" || staff?.role === "guardian" || staff?.role === "otp") {
        try {
          await (sock as any).groupParticipantsUpdate(groupId, [participant], "approve");
          logger.info({ participant, groupId, role: staff.role }, "Auto-approved staff join request");
        } catch (err) {
          logger.error({ err, participant, groupId }, "Failed to auto-approve staff join request");
        }
      }
    }
  }
}

function replaceWelcomeMention(template: string, participant: string): string {
  return template.replace(/@mention/gi, mentionTag(participant));
}
