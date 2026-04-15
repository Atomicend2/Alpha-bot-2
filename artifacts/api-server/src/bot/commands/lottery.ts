import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";
import { ensureUser, updateUser } from "../db/queries.js";
import { getDb } from "../db/database.js";
import { logger } from "../../lib/logger.js";
import sharp from "sharp";

const MAX_PARTICIPANTS = 15;
const AUTO_DRAW_WINNERS = 3;

export async function handleLottery(ctx: CommandContext): Promise<void> {
  const { from, sender, command: cmd } = ctx;
  const db = getDb();

  if (cmd === "lottery") {
    const user = ensureUser(sender);
    const db2 = getDb();

    // Migrate any inventory-based tickets into the column (web purchases land in inventory)
    const invRows = db2.prepare(
      "SELECT item, quantity FROM inventory WHERE user_id = ? AND LOWER(item) IN ('lottery ticket', 'golden ticket')"
    ).all(sender) as any[];
    const migratedTickets = invRows.reduce((total, row) => {
      const quantity = Number(row.quantity || 0);
      return total + (String(row.item).toLowerCase() === "golden ticket" ? quantity * 3 : quantity);
    }, 0);
    if (migratedTickets > 0) {
      db2.prepare(
        "UPDATE users SET lottery_tickets = COALESCE(lottery_tickets, 0) + ? WHERE id = ?"
      ).run(migratedTickets, sender);
      db2.prepare(
        "DELETE FROM inventory WHERE user_id = ? AND LOWER(item) IN ('lottery ticket', 'golden ticket')"
      ).run(sender);
    }

    // Re-fetch with migrated count
    const freshUser = db2.prepare("SELECT * FROM users WHERE id = ?").get(sender) as any;
    const tickets = freshUser?.lottery_tickets || 0;
    if (tickets <= 0) {
      await sendText(
        from,
        "🎫 *No Lottery Tickets!*\n\nYou don't have any lottery tickets to use.\n\nVisit the shop and buy a *Lottery Ticket* for 5,000 Gold, then type *.lottery* to enter!\n\n> Type *.shop* to see the shop."
      );
      return;
    }

    // Get or create the global active lottery
    let lottery = db.prepare("SELECT * FROM lotteries WHERE active = 1 ORDER BY created_at DESC LIMIT 1").get() as any;
    if (!lottery) {
      const result = db.prepare("INSERT INTO lotteries (group_id, pool) VALUES (?, 0)").run("global");
      lottery = db.prepare("SELECT * FROM lotteries WHERE id = ?").get(result.lastInsertRowid) as any;
    }

    // Check if user is already participating
    const existing = db.prepare(
      "SELECT * FROM lottery_entries WHERE lottery_id = ? AND user_id = ?"
    ).get(lottery.id, sender) as any;

    if (existing) {
      await sendText(from, "🎰 *Already Entered!*\n\nYou are already in this drawing. Wait for the results!");
      // Still send the status card
      await sendLotteryImage(ctx, from, lottery.id, "🎲 *Lottery Pool Status — SHADOW GARDEN*");
      return;
    }

    // Deduct 1 ticket and add entry
    db.prepare("UPDATE users SET lottery_tickets = lottery_tickets - 1 WHERE id = ?").run(sender);
    db.prepare("INSERT INTO lottery_entries (lottery_id, user_id, amount) VALUES (?, ?, ?)").run(lottery.id, sender, 1);

    const entryCount = (db.prepare("SELECT COUNT(*) as cnt FROM lottery_entries WHERE lottery_id = ?").get(lottery.id) as any)?.cnt || 0;

    await sendText(
      from,
      `🎉 *Lottery Entry Confirmed!*\n\nYou have successfully used a lottery ticket to participate in the Global Lottery!\n\n🎫 Your remaining tickets: ${tickets - 1}\n👥 Current participants: ${entryCount}/${MAX_PARTICIPANTS}\n\n_${MAX_PARTICIPANTS - entryCount} spots remaining until the draw!_`
    );

    // Send the visual status card
    await sendLotteryImage(ctx, from, lottery.id, "🎲 *Lottery Pool Status — SHADOW GARDEN*");

    // Auto-draw when 15 people have entered
    if (entryCount >= MAX_PARTICIPANTS) {
      await performLotteryDraw(ctx, lottery.id, from);
    }
    return;
  }

  // .ll command — just show the status card
  if (cmd === "ll") {
    const user = ensureUser(sender);
    const lottery = db.prepare("SELECT * FROM lotteries WHERE active = 1 ORDER BY created_at DESC LIMIT 1").get() as any;
    const entryCount = lottery
      ? ((db.prepare("SELECT COUNT(*) as cnt FROM lottery_entries WHERE lottery_id = ?").get(lottery.id) as any)?.cnt || 0)
      : 0;

    const isInLottery = lottery
      ? !!(db.prepare("SELECT * FROM lottery_entries WHERE lottery_id = ? AND user_id = ?").get(lottery.id, sender))
      : false;

    const tickets = user.lottery_tickets || 0;
    let statusLine = `🎫 Your tickets: *${tickets}*`;
    if (isInLottery) statusLine += "\n✅ You are *already in* this drawing";

    await sendText(from, `🎰 *Lottery Status — Shadow Garden*\n\n${statusLine}\n👥 Participants: *${entryCount}/${MAX_PARTICIPANTS}*`);

    if (!lottery || entryCount === 0) {
      await sendText(from, "No active lottery pool yet. Type *.lottery* to enter when you have a ticket!");
      return;
    }

    await sendLotteryImage(ctx, from, lottery.id, "🎲 *Lottery Pool Status — SHADOW GARDEN*");
    return;
  }

  // Legacy .lp command
  if (cmd === "lp") {
    const lottery = db.prepare("SELECT * FROM lotteries WHERE active = 1 ORDER BY created_at DESC LIMIT 1").get() as any;
    if (!lottery) {
      await sendText(from, "🎰 No active lottery. Buy a ticket from the shop and type *.lottery* to enter!");
      return;
    }
    const entries = (db.prepare("SELECT COUNT(*) as count FROM lottery_entries WHERE lottery_id = ?").get(lottery.id) as any)?.count || 0;
    await sendText(from, `🎰 *Shadow Garden Lottery*\n\n👥 Participants: ${entries}/${MAX_PARTICIPANTS}\n🏆 Winners drawn automatically when ${MAX_PARTICIPANTS} enter`);

    await sendLotteryImage(ctx, from, lottery.id, "🎲 Lottery Pool Status");
    return;
  }

  // .drawlottery — admin manual draw
  if (cmd === "drawlottery") {
    if (!ctx.isAdmin && !ctx.isOwner) {
      await sendText(from, "❌ Only admins can manually draw the lottery.");
      return;
    }
    const lottery = db.prepare("SELECT * FROM lotteries WHERE active = 1 ORDER BY created_at DESC LIMIT 1").get() as any;
    if (!lottery) { await sendText(from, "❌ No active lottery."); return; }

    const entries = db.prepare("SELECT * FROM lottery_entries WHERE lottery_id = ?").all(lottery.id) as any[];
    if (entries.length === 0) { await sendText(from, "❌ No entries yet!"); return; }

    await performLotteryDraw(ctx, lottery.id, from);
    return;
  }
}

async function sendLotteryImage(ctx: CommandContext, from: string, lotteryId: number, caption: string): Promise<void> {
  try {
    const image = await buildLotteryImage(lotteryId);
    await ctx.sock.sendMessage(from, { image, caption });
  } catch (err) {
    logger.error({ err, lotteryId }, "Failed to send lottery status image");
    await sendText(from, "🎲 Lottery entry/status saved, but the status image could not be generated.");
  }
}

async function performLotteryDraw(ctx: CommandContext, lotteryId: number, from: string): Promise<void> {
  const db = getDb();
  const entries = db.prepare("SELECT * FROM lottery_entries WHERE lottery_id = ?").all(lotteryId) as any[];
  if (entries.length === 0) return;

  // Pick up to 3 random unique winners
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, Math.min(AUTO_DRAW_WINNERS, entries.length));

  // Fixed prize tiers: 1st = 300,000 | 2nd = 200,000 | 3rd = 100,000
  const PRIZE_TIERS = [300000, 200000, 100000];

  const winnerMentions: string[] = [];
  const winnerNames: string[] = [];

  for (let i = 0; i < winners.length; i++) {
    const winner = winners[i];
    const prize = PRIZE_TIERS[i] ?? 100000;
    const winnerUser = db.prepare("SELECT * FROM users WHERE id = ?").get(winner.user_id) as any;
    if (winnerUser) {
      db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(prize, winner.user_id);
    }
    winnerMentions.push(winner.user_id);
    winnerNames.push(`@${winner.user_id.split("@")[0]}`);
  }

  // Close the lottery and record the first winner
  db.prepare("UPDATE lotteries SET active = 0, winner_id = ?, ended_at = unixepoch() WHERE id = ?").run(winners[0].user_id, lotteryId);

  const prizeLines = winners.map((_, i) => {
    const prize = PRIZE_TIERS[i] ?? 100000;
    return `${["🥇","🥈","🥉"][i] || "🏅"} ${winnerNames[i]} — *${prize.toLocaleString()} Gold*`;
  }).join("\n");

  const announcement =
    `🎰 *LOTTERY DRAW — SHADOW GARDEN* 🎰\n\n` +
    `The shadows have chosen!\n\n` +
    `🏆 *Winners:*\n` +
    prizeLines +
    `\n\n_A new lottery pool will begin shortly. Buy tickets from the shop!_`;

  await ctx.sock.sendMessage(from, {
    text: announcement,
    mentions: winnerMentions,
  });
}

async function buildLotteryImage(lotteryId: number): Promise<Buffer> {
  const db = getDb();
  const entries = db.prepare("SELECT le.user_id, u.name FROM lottery_entries le LEFT JOIN users u ON u.id = le.user_id WHERE le.lottery_id = ? ORDER BY le.created_at ASC").all(lotteryId) as any[];
  const participantCount = entries.length;

  const W = 600;
  const H = 280;
  const required = MAX_PARTICIPANTS;
  const participantPct = Math.min(participantCount / required, 1);
  const BAR_X = 30;
  const BAR_W = W - 60;
  const reqBarW = BAR_W; // always full
  const partBarW = Math.max(12, Math.round(BAR_W * participantPct));

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="card">
        <rect width="${W}" height="${H}" rx="18"/>
      </clipPath>
    </defs>

    <!-- Card background -->
    <rect width="${W}" height="${H}" fill="#1e1e24" rx="18"/>

    <!-- Content area clipped -->
    <g clip-path="url(#card)">

      <!-- Title -->
      <text x="${BAR_X}" y="44" fill="white" font-size="20" font-family="Arial, sans-serif" font-weight="bold">Lottery Pools in <tspan font-style="italic">SHADOW GARDEN</tspan></text>

      <!-- Divider -->
      <line x1="${BAR_X}" y1="58" x2="${W - BAR_X}" y2="58" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

      <!-- REQUIRED label + number -->
      <text x="${BAR_X}" y="90" fill="white" font-size="17" font-family="Arial, sans-serif" font-weight="bold">Required</text>
      <text x="${W - BAR_X}" y="90" text-anchor="end" fill="white" font-size="17" font-family="Arial, sans-serif" font-weight="bold">${required}</text>

      <!-- Required bar track -->
      <rect x="${BAR_X}" y="100" width="${BAR_W}" height="20" rx="10" fill="rgba(255,255,255,0.12)"/>
      <!-- Required bar fill (full, blue) -->
      <rect x="${BAR_X}" y="100" width="${reqBarW}" height="20" rx="10" fill="#1d8cf8"/>

      <!-- PARTICIPANTS label + number -->
      <text x="${BAR_X}" y="150" fill="white" font-size="17" font-family="Arial, sans-serif" font-weight="bold">Participants</text>
      <text x="${W - BAR_X}" y="150" text-anchor="end" fill="white" font-size="17" font-family="Arial, sans-serif" font-weight="bold">${participantCount}</text>

      <!-- Participants bar track -->
      <rect x="${BAR_X}" y="160" width="${BAR_W}" height="20" rx="10" fill="rgba(255,255,255,0.12)"/>
      <!-- Participants bar fill (dynamic, blue) -->
      <rect x="${BAR_X}" y="160" width="${partBarW}" height="20" rx="10" fill="#1d8cf8"/>

      <!-- Footer: time + hint -->
      <text x="${W - BAR_X}" y="${H - 16}" text-anchor="end" fill="rgba(255,255,255,0.35)" font-size="12" font-family="Arial, sans-serif">${timeStr}</text>
      <text x="${BAR_X}" y="${H - 16}" fill="rgba(255,255,255,0.35)" font-size="12" font-family="Arial, sans-serif">.lottery to enter  •  ${participantCount}/${required} spots filled</text>

    </g>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
