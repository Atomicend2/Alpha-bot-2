import { Router } from "express";
import { requireAuth, type AuthRequest } from "./middleware.js";
import { getDb } from "../../bot/db/database.js";

const router = Router();

const MAX_ENTRIES = 15;

router.get("/", (_req, res) => {
  const db = getDb();

  const activeLottery = db.prepare(`
    SELECT * FROM lotteries WHERE active = 1 ORDER BY created_at DESC LIMIT 1
  `).get() as any;

  let entries: any[] = [];
  let entryCount = 0;
  let pool = 0;

  if (activeLottery) {
    pool = activeLottery.pool || 0;
    const rawEntries = db.prepare(`
      SELECT le.user_id, le.amount, le.created_at, u.name
      FROM lottery_entries le
      LEFT JOIN users u ON u.id = le.user_id
      WHERE le.lottery_id = ?
      ORDER BY le.created_at ASC
    `).all(activeLottery.id) as any[];
    entryCount = rawEntries.length;
    entries = rawEntries.map((e: any) => ({
      userId: e.user_id,
      name: e.name || "Shadow",
      enteredAt: e.created_at || 0,
    }));
  }

  const recentWinners = db.prepare(`
    SELECT l.winner_id, l.pool, l.ended_at, u.name
    FROM lotteries l
    LEFT JOIN users u ON u.id = l.winner_id
    WHERE l.active = 0 AND l.winner_id IS NOT NULL
    ORDER BY l.ended_at DESC
    LIMIT 10
  `).all() as any[];

  res.json({
    active: !!activeLottery,
    pool,
    entryCount,
    maxEntries: MAX_ENTRIES,
    entries,
    recentWinners: recentWinners.map((w: any) => ({
      userId: w.winner_id,
      name: w.name || "Shadow",
      prize: w.pool || 0,
      wonAt: w.ended_at || 0,
    })),
  });
});

router.post("/join", requireAuth, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.userId!;

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
  if (!user) {
    res.status(404).json({ success: false, message: "User not found." });
    return;
  }

  // Migrate inventory-based tickets first
  const invRows = db.prepare(
    "SELECT item, quantity FROM inventory WHERE user_id = ? AND LOWER(item) IN ('lottery ticket', 'golden ticket')"
  ).all(userId) as any[];
  const migratedTickets = invRows.reduce((total: number, row: any) => {
    const quantity = Number(row.quantity || 0);
    return total + (String(row.item).toLowerCase() === "golden ticket" ? quantity * 3 : quantity);
  }, 0);
  if (migratedTickets > 0) {
    db.prepare(
      "UPDATE users SET lottery_tickets = COALESCE(lottery_tickets, 0) + ? WHERE id = ?"
    ).run(migratedTickets, userId);
    db.prepare(
      "DELETE FROM inventory WHERE user_id = ? AND LOWER(item) IN ('lottery ticket', 'golden ticket')"
    ).run(userId);
  }

  const freshUser = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
  const tickets = Number(freshUser?.lottery_tickets || 0);

  if (tickets <= 0) {
    res.status(400).json({
      success: false,
      message: "You have no lottery tickets. Buy a Lottery Ticket from the shop first.",
    });
    return;
  }

  // Get or create active lottery
  let lottery = db.prepare("SELECT * FROM lotteries WHERE active = 1 ORDER BY created_at DESC LIMIT 1").get() as any;
  if (!lottery) {
    const result = db.prepare("INSERT INTO lotteries (group_id, pool) VALUES (?, 0)").run("global");
    lottery = db.prepare("SELECT * FROM lotteries WHERE id = ?").get(result.lastInsertRowid) as any;
  }

  // Check if already entered
  const existing = db.prepare(
    "SELECT * FROM lottery_entries WHERE lottery_id = ? AND user_id = ?"
  ).get(lottery.id, userId) as any;

  if (existing) {
    res.status(400).json({ success: false, message: "You are already in this lottery drawing." });
    return;
  }

  // Deduct ticket and add entry
  db.prepare("UPDATE users SET lottery_tickets = lottery_tickets - 1 WHERE id = ?").run(userId);
  db.prepare("INSERT INTO lottery_entries (lottery_id, user_id, amount) VALUES (?, ?, ?)").run(lottery.id, userId, 1);

  const entryCount = (db.prepare("SELECT COUNT(*) as cnt FROM lottery_entries WHERE lottery_id = ?").get(lottery.id) as any)?.cnt || 0;

  res.json({
    success: true,
    message: `You have entered the lottery! ${MAX_ENTRIES - entryCount} spots remaining.`,
    ticketsLeft: tickets - 1,
    entryCount,
    maxEntries: MAX_ENTRIES,
  });
});

export { router as lotteryRouter };
