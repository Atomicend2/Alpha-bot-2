import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";
import { ensureUser, getUser, updateUser } from "../db/queries.js";
import { getDb } from "../db/database.js";
import { formatNumber } from "../utils.js";

export async function handleLottery(ctx: CommandContext): Promise<void> {
  const { from, sender, args, command: cmd } = ctx;
  const db = getDb();
  const user = ensureUser(sender);

  if (cmd === "lottery") {
    const amount = parseInt(args[0]) || 100;
    if (amount <= 0) { await sendText(from, "❌ Enter a valid amount."); return; }
    if ((user.balance || 0) < amount) {
      await sendText(from, `❌ Not enough money. You have $${formatNumber(user.balance || 0)}.`);
      return;
    }

    let lottery = db.prepare("SELECT * FROM lotteries WHERE group_id = ? AND active = 1").get(from) as any;
    if (!lottery) {
      const result = db.prepare("INSERT INTO lotteries (group_id, pool) VALUES (?, 0)").run(from);
      lottery = db.prepare("SELECT * FROM lotteries WHERE id = ?").get(result.lastInsertRowid) as any;
    }

    const existing = db.prepare("SELECT * FROM lottery_entries WHERE lottery_id = ? AND user_id = ?").get(lottery.id, sender);
    if (existing) {
      await sendText(from, "❌ You already entered the lottery!");
      return;
    }

    updateUser(sender, { balance: (user.balance || 0) - amount });
    db.prepare("INSERT INTO lottery_entries (lottery_id, user_id, amount) VALUES (?, ?, ?)").run(lottery.id, sender, amount);
    db.prepare("UPDATE lotteries SET pool = pool + ? WHERE id = ?").run(amount, lottery.id);

    const updatedLottery = db.prepare("SELECT * FROM lotteries WHERE id = ?").get(lottery.id) as any;
    const entries = db.prepare("SELECT COUNT(*) as count FROM lottery_entries WHERE lottery_id = ?").get(lottery.id) as any;

    await sendText(from, `🎰 You entered the lottery with $${formatNumber(amount)}!\nPool: $${formatNumber(updatedLottery.pool)} | Entries: ${entries.count}\n\nA random winner will be drawn when an admin runs the lottery.`);
    return;
  }

  if (cmd === "lp") {
    const lottery = db.prepare("SELECT * FROM lotteries WHERE group_id = ? AND active = 1").get(from) as any;
    if (!lottery) {
      await sendText(from, "🎰 No active lottery. Pool: $0");
      return;
    }
    const entries = db.prepare("SELECT COUNT(*) as count FROM lottery_entries WHERE lottery_id = ?").get(lottery.id) as any;
    await sendText(from, `🎰 *Lottery Pool*\n\n💰 Pool: $${formatNumber(lottery.pool)}\n🎫 Entries: ${entries.count}`);
    return;
  }

  if (cmd === "drawlottery") {
    if (!ctx.isAdmin && !ctx.isOwner) {
      await sendText(from, "❌ Only admins can draw the lottery.");
      return;
    }
    const lottery = db.prepare("SELECT * FROM lotteries WHERE group_id = ? AND active = 1").get(from) as any;
    if (!lottery) { await sendText(from, "❌ No active lottery."); return; }

    const entries = db.prepare("SELECT * FROM lottery_entries WHERE lottery_id = ?").all(lottery.id) as any[];
    if (entries.length === 0) { await sendText(from, "❌ No entries yet!"); return; }

    const winner = entries[Math.floor(Math.random() * entries.length)];
    const winnerUser = ensureUser(winner.user_id);
    updateUser(winner.user_id, { balance: (winnerUser.balance || 0) + lottery.pool });
    db.prepare("UPDATE lotteries SET active = 0, winner_id = ?, ended_at = unixepoch() WHERE id = ?").run(winner.user_id, lottery.id);

    await ctx.sock.sendMessage(from, {
      text: `🎰 *Lottery Draw!*\n\n🏆 Winner: @${winner.user_id.split("@")[0]}\n💰 Prize: $${formatNumber(lottery.pool)}!\n\nCongratulations! 🎉`,
      mentions: [winner.user_id],
    });
    return;
  }
}
