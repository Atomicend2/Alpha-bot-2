import { Router } from "express";
import { requireAuth, type AuthRequest } from "./middleware.js";
import { getDb } from "../../bot/db/database.js";
import { getUserRank, getUserGuild, getInventory } from "../../bot/db/queries.js";

const router = Router();

router.get("/stats", requireAuth, (req: AuthRequest, res) => {
  const user = req.user;
  const db = getDb();

  const rank = getUserRank(user.id);
  const totalUsers = (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE COALESCE(is_bot, 0) = 0").get() as any)?.cnt || 0;
  const xpNeeded = (user.level || 1) * 100;

  const rpgRow = db.prepare("SELECT * FROM rpg_characters WHERE user_id = ?").get(user.id) as any;
  const rpg = rpgRow
    ? {
        class: rpgRow.class || "Warrior",
        hp: rpgRow.hp || 100,
        maxHp: rpgRow.max_hp || 100,
        attack: rpgRow.attack || 20,
        defense: rpgRow.defense || 10,
        speed: rpgRow.speed || 15,
        dungeonFloor: rpgRow.dungeon_floor || 1,
      }
    : null;

  const guildRow = getUserGuild(user.id);
  const guild = guildRow
    ? { id: guildRow.id, name: guildRow.name, level: guildRow.level || 1 }
    : null;

  res.json({
    profile: {
      id: user.id,
      name: user.name || "Shadow",
      phone: user.phone || "",
      level: user.level || 1,
      xp: user.xp || 0,
      balance: user.balance || 0,
      bank: user.bank || 0,
      premium: user.premium || 0,
      bio: user.bio || "",
      registeredAt: user.created_at || 0,
    },
    rpg,
    guild,
    rank,
    totalUsers: Number(totalUsers),
    xpNeeded,
  });
});

router.get("/inventory", requireAuth, (req: AuthRequest, res) => {
  const items = getInventory(req.userId!);

  const categorized = items.map((item: any) => {
    const name = (item.item || "").toLowerCase();
    let category = "general";
    if (name.includes("shovel") || name.includes("fishing") || name.includes("rod") || name.includes("pickaxe")) {
      category = "tools";
    } else if (name.includes("potion") || name.includes("elixir") || name.includes("heal")) {
      category = "potions";
    } else if (name.includes("pistol") || name.includes("sword") || name.includes("gun") || name.includes("weapon") || name.includes("blade")) {
      category = "weapons";
    } else if (name.includes("note") || name.includes("bank")) {
      category = "passive";
    } else if (name.includes("ticket") || name.includes("lottery")) {
      category = "lottery";
    }
    return {
      item: item.item,
      quantity: item.quantity || 1,
      category,
    };
  });

  res.json({ items: categorized });
});

router.get("/achievements", requireAuth, (req: AuthRequest, res) => {
  const db = getDb();
  const achievements = db.prepare(
    "SELECT * FROM web_achievements WHERE user_id = ? ORDER BY earned_at DESC"
  ).all(req.userId!) as any[];

  res.json({
    achievements: achievements.map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description || "",
      icon: a.icon || "star",
      earnedAt: a.earned_at || 0,
    })),
  });
});

export { router as userRouter };
