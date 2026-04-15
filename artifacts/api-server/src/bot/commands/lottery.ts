import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";
import { ensureUser, updateUser } from "../db/queries.js";
import { getDb } from "../db/database.js";
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
    const invRow = db2.prepare(
      "SELECT quantity FROM inventory WHERE user_id = ? AND LOWER(item) = 'lottery ticket'"
    ).get(sender) as any;
    if (invRow?.quantity > 0) {
      db2.prepare(
        "UPDATE users SET lottery_tickets = COALESCE(lottery_tickets, 0) + ? WHERE id = ?"
      ).run(invRow.quantity, sender);
      db2.prepare(
        "DELETE FROM inventory WHERE user_id = ? AND LOWER(item) = 'lottery ticket'"
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
      const image = await buildLotteryImage(lottery.id);
      await ctx.sock.sendMessage(from, {
        image,
        caption: "🎲 *Lottery Pool Status — SHADOW GARDEN*",
      });
      return;
    }

    // Deduct 1 ticket and add entry
    db.prepare("UPDATE users SET lottery_tickets = lottery_tickets - 1 WHERE id = ?").run(sender);
    db.prepare("INSERT INTO lottery_entries (lottery_id, user_id, amount) VALUES (?, ?, 1)").run(lottery.id, sender, 1);

    const entryCount = (db.prepare("SELECT COUNT(*) as cnt FROM lottery_entries WHERE lottery_id = ?").get(lottery.id) as any)?.cnt || 0;

    await sendText(
      from,
      `🎉 *Lottery Entry Confirmed!*\n\nYou have successfully used a lottery ticket to participate in the Global Lottery!\n\n🎫 Your remaining tickets: ${tickets - 1}\n👥 Current participants: ${entryCount}/${MAX_PARTICIPANTS}\n\n_${MAX_PARTICIPANTS - entryCount} spots remaining until the draw!_`
    );

    // Send the visual status card
    const image = await buildLotteryImage(lottery.id);
    await ctx.sock.sendMessage(from, {
      image,
      caption: "🎲 *Lottery Pool Status — SHADOW GARDEN*",
    });

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

    const image = await buildLotteryImage(lottery.id);
    await ctx.sock.sendMessage(from, {
      image,
      caption: "🎲 *Lottery Pool Status — SHADOW GARDEN*",
    });
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

    const image = await buildLotteryImage(lottery.id);
    await ctx.sock.sendMessage(from, { image, caption: "🎲 Lottery Pool Status" });
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

async function performLotteryDraw(ctx: CommandContext, lotteryId: number, from: string): Promise<void> {
  const db = getDb();
  const entries = db.prepare("SELECT * FROM lottery_entries WHERE lottery_id = ?").all(lotteryId) as any[];
  if (entries.length === 0) return;

  // Pick up to 3 random unique winners
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, Math.min(AUTO_DRAW_WINNERS, entries.length));

  // Award each winner an equal split (prize pool is based on number of entries, symbolic)
  const prize = entries.length * 5000; // 5000 per entry
  const perWinner = Math.floor(prize / winners.length);

  const winnerMentions: string[] = [];
  const winnerNames: string[] = [];

  for (const winner of winners) {
    const winnerUser = db.prepare("SELECT * FROM users WHERE id = ?").get(winner.user_id) as any;
    if (winnerUser) {
      db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(perWinner, winner.user_id);
    }
    winnerMentions.push(winner.user_id);
    winnerNames.push(`@${winner.user_id.split("@")[0]}`);
  }

  // Close the lottery and record the first winner
  db.prepare("UPDATE lotteries SET active = 0, winner_id = ?, ended_at = unixepoch() WHERE id = ?").run(winners[0].user_id, lotteryId);

  const announcement =
    `🎰 *LOTTERY DRAW — SHADOW GARDEN* 🎰\n\n` +
    `The shadows have chosen!\n\n` +
    `🏆 *Winners:*\n` +
    winnerNames.map((n, i) => `${["🥇","🥈","🥉"][i] || "🏅"} ${n}`).join("\n") +
    `\n\n💰 *Prize:* ${perWinner.toLocaleString()} Gold each\n\n` +
    `_A new lottery pool will begin shortly. Buy tickets from the shop!_`;

  await ctx.sock.sendMessage(from, {
    text: announcement,
    mentions: winnerMentions,
  });
}

async function buildLotteryImage(lotteryId: number): Promise<Buffer> {
  const db = getDb();
  const entries = db.prepare("SELECT le.user_id, u.name FROM lottery_entries le LEFT JOIN users u ON u.id = le.user_id WHERE le.lottery_id = ? ORDER BY le.created_at ASC").all(lotteryId) as any[];
  const participantCount = entries.length;

  const W = 800;
  const H = 460;
  const required = MAX_PARTICIPANTS;
  const participantPct = Math.min(participantCount / required, 1);
  const requiredPct = 1; // always full bar for "Required"
  const barTrackW = 600;
  const reqBarW = Math.round(barTrackW * requiredPct);
  const partBarW = Math.max(8, Math.round(barTrackW * participantPct));

  // Build participant name list (up to 5 names)
  const nameList = entries.slice(0, 5).map((e: any, i: number) => e.name || `Shadow ${i + 1}`);
  const extraCount = participantCount > 5 ? participantCount - 5 : 0;

  const namesSvg = nameList.map((name: string, i: number) => {
    const y = 310 + i * 22;
    const safeName = name.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c] || c));
    return `<text x="100" y="${y}" fill="rgba(255,255,255,0.65)" font-size="14" font-family="Arial, sans-serif">• ${safeName}</text>`;
  }).join("");

  const extraText = extraCount > 0
    ? `<text x="100" y="${310 + nameList.length * 22}" fill="rgba(255,255,255,0.45)" font-size="13" font-family="Arial, sans-serif">...and ${extraCount} more</text>`
    : "";

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0a0a0f"/>
        <stop offset="100%" stop-color="#1a0a2e"/>
      </linearGradient>
      <linearGradient id="reqBar" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#7c3aed"/>
        <stop offset="100%" stop-color="#a855f7"/>
      </linearGradient>
      <linearGradient id="partBar" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#d97706"/>
        <stop offset="100%" stop-color="#f59e0b"/>
      </linearGradient>
    </defs>

    <!-- Background -->
    <rect width="${W}" height="${H}" fill="url(#bgGrad)" rx="16"/>

    <!-- Top purple accent strip -->
    <rect width="${W}" height="4" fill="#7c3aed" rx="2"/>

    <!-- Decorative glow circles -->
    <circle cx="720" cy="80" r="120" fill="rgba(168,85,247,0.06)"/>
    <circle cx="80" cy="380" r="80" fill="rgba(245,158,11,0.05)"/>

    <!-- Header -->
    <text x="50%" y="52" text-anchor="middle" fill="white" font-size="13" font-family="Arial, sans-serif" font-weight="bold" letter-spacing="4" fill-opacity="0.5">SHADOW GARDEN</text>
    <text x="50%" y="90" text-anchor="middle" fill="white" font-size="26" font-family="Georgia, serif" font-weight="bold" letter-spacing="2">Lottery Pools</text>

    <!-- Divider -->
    <line x1="50" y1="110" x2="${W - 50}" y2="110" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

    <!-- REQUIRED BAR -->
    <text x="100" y="150" fill="rgba(255,255,255,0.9)" font-size="15" font-family="Arial, sans-serif" font-weight="bold">Required</text>
    <text x="${W - 100}" y="150" text-anchor="end" fill="#a855f7" font-size="15" font-family="Arial, sans-serif" font-weight="bold">${required}</text>

    <!-- Bar track -->
    <rect x="100" y="158" width="${barTrackW}" height="30" rx="6" fill="rgba(255,255,255,0.06)"/>
    <!-- Bar fill -->
    <rect x="100" y="158" width="${reqBarW}" height="30" rx="6" fill="url(#reqBar)"/>
    <!-- Bar text -->
    <text x="${100 + reqBarW / 2}" y="178" text-anchor="middle" fill="white" font-size="13" font-family="Arial, sans-serif" font-weight="bold">${required} spots</text>

    <!-- PARTICIPANTS BAR -->
    <text x="100" y="225" fill="rgba(255,255,255,0.9)" font-size="15" font-family="Arial, sans-serif" font-weight="bold">Participants</text>
    <text x="${W - 100}" y="225" text-anchor="end" fill="#f59e0b" font-size="15" font-family="Arial, sans-serif" font-weight="bold">${participantCount}</text>

    <!-- Bar track -->
    <rect x="100" y="233" width="${barTrackW}" height="30" rx="6" fill="rgba(255,255,255,0.06)"/>
    <!-- Bar fill -->
    <rect x="100" y="233" width="${partBarW}" height="30" rx="6" fill="url(#partBar)"/>
    <!-- Bar text -->
    <text x="${100 + Math.max(partBarW / 2, 40)}" y="253" text-anchor="middle" fill="white" font-size="13" font-family="Arial, sans-serif" font-weight="bold">${participantCount}/${required}</text>

    <!-- Divider -->
    <line x1="50" y1="290" x2="${W - 50}" y2="290" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

    <!-- Participant names -->
    ${participantCount > 0
      ? `<text x="100" y="308" fill="rgba(255,255,255,0.4)" font-size="12" font-family="Arial, sans-serif" letter-spacing="2">ENTERED:</text>${namesSvg}${extraText}`
      : `<text x="50%" y="330" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="14" font-family="Arial, sans-serif">No participants yet. Type .lottery to enter!</text>`
    }

    <!-- Footer -->
    <rect x="0" y="${H - 44}" width="${W}" height="44" fill="rgba(0,0,0,0.3)" rx="16"/>
    <text x="50%" y="${H - 18}" text-anchor="middle" fill="rgba(255,255,255,0.35)" font-size="12" font-family="Arial, sans-serif">3 winners drawn automatically • .lottery to enter • .ll to check status</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
