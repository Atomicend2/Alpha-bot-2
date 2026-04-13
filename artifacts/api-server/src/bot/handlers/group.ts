import type { WASocket } from "@whiskeysockets/baileys";
import { ensureGroup, getGroup, isBanned, updateGroup } from "../db/queries.js";
import { sendText } from "../connection.js";
import { mentionTag } from "../utils.js";

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

  for (const participant of participants) {
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
    }
  }
}

function replaceWelcomeMention(template: string, participant: string): string {
  return template.replace(/@mention/gi, mentionTag(participant));
}
