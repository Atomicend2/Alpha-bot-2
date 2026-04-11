import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";
import { setAfk, removeAfk, getAfk } from "../db/queries.js";
import { timeAgo } from "../utils.js";

export async function handleAfk(ctx: CommandContext): Promise<void> {
  const { from, sender, args } = ctx;
  const reason = args.join(" ") || "AFK";
  setAfk(sender, reason);
  await sendText(from, `💤 @${sender.split("@")[0]} is now AFK: ${reason}`, [sender]);
}

export async function checkAfkMention(
  from: string,
  sender: string,
  mentioned: string[],
  sock: any
): Promise<void> {
  const senderAfk = getAfk(sender);
  if (senderAfk) {
    removeAfk(sender);
    await sock.sendMessage(from, {
      text: `👋 Welcome back @${sender.split("@")[0]}! You were AFK: "${senderAfk.reason}" (${timeAgo(senderAfk.started_at)})`,
      mentions: [sender],
    });
  }

  for (const m of mentioned) {
    const afk = getAfk(m);
    if (afk) {
      await sock.sendMessage(from, {
        text: `💤 @${m.split("@")[0]} is AFK: "${afk.reason}" (since ${timeAgo(afk.started_at)})`,
        mentions: [m],
      });
    }
  }
}
