import { Router } from "express";
import { requireAuth, optionalAuth, type AuthRequest } from "./middleware.js";
import { getShop, addToInventory } from "../../bot/db/queries.js";
import { getDb } from "../../bot/db/database.js";

const router = Router();

router.get("/", optionalAuth, (_req, res) => {
  const items = getShop();

  const categoryMap: Record<string, any[]> = {};
  for (const item of items) {
    const cat = item.category || "general";
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: item.price,
      effect: item.effect || "",
      category: cat,
    });
  }

  const categories = Object.entries(categoryMap).map(([name, shopItems]) => ({
    name,
    items: shopItems,
  }));

  res.json({ categories });
});

router.post("/buy", requireAuth, (req: AuthRequest, res) => {
  const { itemId, quantity = 1 } = req.body as { itemId?: number; quantity?: number };
  if (!itemId) {
    res.status(400).json({ success: false, message: "itemId is required", newBalance: 0 });
    return;
  }

  const db = getDb();
  const item = db.prepare(`
    SELECT * FROM shop_items
    WHERE id = ?
      AND LOWER(name) NOT IN ('card pack', 'premium card pack', 'vip pass', 'vip access')
  `).get(itemId) as any;

  if (!item) {
    res.status(400).json({ success: false, message: "Item not found in shop", newBalance: req.user.balance || 0 });
    return;
  }

  const user = req.user;
  const qty = Math.max(1, Number(quantity));
  const totalCost = item.price * qty;

  if ((user.balance || 0) < totalCost) {
    res.status(400).json({
      success: false,
      message: `Insufficient funds. You need $${totalCost.toLocaleString()} but have $${(user.balance || 0).toLocaleString()}.`,
      newBalance: user.balance || 0,
    });
    return;
  }

  const newBalance = (user.balance || 0) - totalCost;
  db.prepare("UPDATE users SET balance = ?, updated_at = unixepoch() WHERE id = ?").run(newBalance, user.id);
  addToInventory(user.id, item.name, qty);

  res.json({
    success: true,
    message: `Purchased ${qty}x ${item.name} for $${totalCost.toLocaleString()}`,
    newBalance,
  });
});

export { router as shopRouter };
