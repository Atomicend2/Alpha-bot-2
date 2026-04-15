import { Router } from "express";
import { requireAuth, optionalAuth, type AuthRequest } from "./middleware.js";
import { getDb } from "../../bot/db/database.js";
import { getSocket, isSocketConnected } from "../../bot/connection.js";
import { logger } from "../../lib/logger.js";

const router = Router();

function getCardCopyCount(db: any, cardId: string): number {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM user_cards WHERE card_id = ?").get(cardId) as any;
  return row?.cnt || 0;
}

function getCardOwner(db: any, cardId: string): { name: string; id: string } | null {
  const row = db.prepare(`
    SELECT u.id, u.name FROM user_cards uc
    JOIN users u ON u.id = uc.user_id
    WHERE uc.card_id = ?
    ORDER BY uc.obtained_at ASC LIMIT 1
  `).get(cardId) as any;
  return row ? { id: row.id, name: row.name || "Unknown" } : null;
}

router.get("/", optionalAuth, (req, res) => {
  const db = getDb();
  const { tier, series } = req.query as { tier?: string; series?: string };

  let query = "SELECT * FROM cards";
  const params: any[] = [];
  const conditions: string[] = [];

  if (tier) {
    conditions.push("tier = ?");
    params.push(tier);
  }
  if (series) {
    conditions.push("LOWER(series) LIKE LOWER(?)");
    params.push(`%${series}%`);
  }
  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY tier, name";

  const cards = db.prepare(query).all(...params) as any[];

  const result = cards.map((card: any) => {
    const owner = getCardOwner(db, card.id);
    const totalCopies = getCardCopyCount(db, card.id);
    return {
      id: card.id,
      name: card.name,
      tier: card.tier,
      series: card.series || "General",
      description: card.description || "",
      attack: card.attack || 50,
      defense: card.defense || 50,
      speed: card.speed || 50,
      totalCopies,
      ownerName: owner?.name || "Unclaimed",
      ownerId: owner?.id || null,
    };
  });

  res.json({ cards: result, total: result.length });
});

router.get("/my", requireAuth, (req: AuthRequest, res) => {
  const db = getDb();
  const userCards = db.prepare(`
    SELECT uc.id as user_card_id, uc.obtained_at, c.*
    FROM user_cards uc
    JOIN cards c ON c.id = uc.card_id
    WHERE uc.user_id = ?
    ORDER BY uc.obtained_at DESC
  `).all(req.userId!) as any[];

  const result = userCards.map((uc: any) => {
    const totalCopies = getCardCopyCount(db, uc.id);
    return {
      userCardId: uc.user_card_id,
      card: {
        id: uc.id,
        name: uc.name,
        tier: uc.tier,
        series: uc.series || "General",
        description: uc.description || "",
        attack: uc.attack || 50,
        defense: uc.defense || 50,
        speed: uc.speed || 50,
        totalCopies,
        ownerName: req.user?.name || "You",
        ownerId: req.userId,
      },
      obtainedAt: uc.obtained_at || 0,
    };
  });

  res.json({ cards: result, total: result.length });
});

router.post("/wishlist", requireAuth, async (req: AuthRequest, res) => {
  const { cardId } = req.body as { cardId?: string };
  if (!cardId) {
    res.status(400).json({ success: false, message: "cardId is required" });
    return;
  }

  const db = getDb();
  const card = db.prepare("SELECT * FROM cards WHERE id = ?").get(cardId) as any;
  if (!card) {
    res.status(404).json({ success: false, message: "Card not found" });
    return;
  }

  const owner = getCardOwner(db, cardId);
  if (!owner) {
    res.json({ success: true, message: "Card is unclaimed — no owner to notify" });
    return;
  }

  const sock = getSocket();
  if (sock && isSocketConnected() && owner.id !== req.userId) {
    try {
      const requesterName = req.user?.name || "Someone";
      await sock.sendMessage(owner.id, {
        text: `*Shadow Garden Trade Alert*\n\n${requesterName} wants to trade for your *${card.name}* (${card.tier} - ${card.series || "General"}).\n\nReply with .trade to negotiate.`,
      });
    } catch (err) {
      logger.error({ err }, "Failed to send wishlist notification");
    }
  }

  res.json({ success: true, message: "Trade notification sent to card owner" });
});

export { router as cardsRouter };
