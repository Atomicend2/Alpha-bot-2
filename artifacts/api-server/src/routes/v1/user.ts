import { Router } from "express";
import { requireAuth, type AuthRequest } from "./middleware.js";
import { getDb } from "../../bot/db/database.js";
import { getUserRank, getUserGuild, getInventory, getStaff } from "../../bot/db/queries.js";
import { BOT_OWNER_LID } from "../../bot/connection.js";

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

  // Calculate bank max from passive bank_cap inventory items
  const bankCapItems = db.prepare(`
    SELECT si.effect FROM inventory i
    JOIN shop_items si ON LOWER(si.name) = LOWER(i.item)
    WHERE i.user_id = ? AND si.category = 'passive' AND si.effect LIKE 'bank_cap:%'
  `).all(user.id) as any[];
  const extraBankCap = bankCapItems.reduce((acc: number, row: any) => {
    const val = parseInt((row.effect || "").replace("bank_cap:", ""), 10) || 0;
    return acc + val;
  }, 0);
  const baseBankMax = 50000;
  const bankMax = baseBankMax + extraBankCap;

  // Determine role
  const phone = user.id.split("@")[0];
  let role = "normal";
  if (phone === BOT_OWNER_LID || user.id === `${BOT_OWNER_LID}@s.whatsapp.net` || user.id === `${BOT_OWNER_LID}@lid`) {
    role = "owner";
  } else {
    const staff = getStaff(user.id);
    if (staff?.role === "guardian") role = "guardian";
    else if (staff?.role === "mod") role = "mod";
    else if (staff?.role === "recruit") role = "recruit";
    else if (user.premium) {
      const expiry = Number(user.premium_expiry || 0);
      if (expiry === 0 || expiry > Math.floor(Date.now() / 1000)) role = "premium";
    }
  }
  const canUseAnimatedBg = ["owner", "guardian", "mod", "premium"].includes(role);

  res.json({
    profile: {
      id: user.id,
      name: user.name || "Shadow",
      phone: user.phone || "",
      level: user.level || 1,
      xp: user.xp || 0,
      balance: user.balance || 0,
      bank: user.bank || 0,
      bankMax,
      lotteryTickets: user.lottery_tickets || 0,
      premium: user.premium || 0,
      bio: user.bio || "",
      registeredAt: user.created_at || 0,
      profileFrame: user.profile_frame || "",
      bgType: user.bg_type || "static",
      role,
      canUseAnimatedBg,
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
