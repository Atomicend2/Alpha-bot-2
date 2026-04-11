import type { WASocket } from "@whiskeysockets/baileys";
import { ensureGroup, getGroup, updateGroup } from "../db/queries.js";
import { sendText } from "../connection.js";
import { logger } from "../../lib/logger.js";

export async function handleGroupUpdate(sock: WASocket, updates: any[]) {
  for (const update of updates) {
    if (!update.id) continue;
    const group = await sock.groupMetadata(update.id).catch(() => null);
    if (!group) continue;
    ensureGroup(update.id, group.subject);
  }
}

export async function handleGroupParticipantsUpdate(
  sock: WASocket,
  update: { id: string; participants: string[]; action: string }
) {
  const { id: groupId, participants, action } = update;
  const group = getGroup(groupId);
  if (!group) {
    ensureGroup(groupId);
    return;
  }

  for (const participant of participants) {
    if (action === "add") {
      if (group.welcome === "on") {
        const msg = group.welcome_msg || `Welcome to the group, @${participant.split("@")[0]}! 👋`;
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
