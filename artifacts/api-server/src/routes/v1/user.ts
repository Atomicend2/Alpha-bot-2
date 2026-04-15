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
        skillPoints: rpgRow.skill_points || 0,
        strSkill: rpgRow.str_skill || 0,
        agiSkill: rpgRow.agi_skill || 0,
        intSkill: rpgRow.int_skill || 0,
        vitSkill: rpgRow.vit_skill || 0,
        lukSkill: rpgRow.luk_skill || 0,
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

const VALID_SKILLS = ["str", "agi", "int", "vit", "luk"] as const;
type SkillKey = typeof VALID_SKILLS[number];
const SKILL_MAX = 20;

router.post("/skills/assign", requireAuth, (req: AuthRequest, res) => {
  const { stat, points } = req.body as { stat: string; points: number };
  if (!VALID_SKILLS.includes(stat as SkillKey)) {
    res.status(400).json({ success: false, message: "Invalid skill. Choose: str, agi, int, vit, luk" });
    return;
  }
  const spend = Math.max(1, Math.floor(Number(points) || 1));
  const db = getDb();
  const rpgRow = db.prepare("SELECT * FROM rpg_characters WHERE user_id = ?").get(req.user.id) as any;
  if (!rpgRow) {
    res.status(400).json({ success: false, message: "No RPG character found. Use .dungeon on WhatsApp first." });
    return;
  }
  const available = rpgRow.skill_points || 0;
  if (available < spend) {
    res.status(400).json({ success: false, message: `Not enough skill points. You have ${available}.` });
    return;
  }
  const currentVal = rpgRow[`${stat}_skill`] || 0;
  if (currentVal + spend > SKILL_MAX) {
    res.status(400).json({ success: false, message: `${stat.toUpperCase()} is already at or near the max (${SKILL_MAX}).` });
    return;
  }
  db.prepare(`UPDATE rpg_characters SET ${stat}_skill = ${stat}_skill + ?, skill_points = skill_points - ? WHERE user_id = ?`)
    .run(spend, spend, req.user.id);

  const statLabels: Record<SkillKey, string> = {
    str: "Strength → +Attack",
    agi: "Agility → +Speed",
    int: "Intellect → +XP Gain",
    vit: "Vitality → +Max HP",
    luk: "Luck → +Gold Drops",
  };
  res.json({
    success: true,
    message: `Assigned ${spend} point${spend !== 1 ? "s" : ""} to ${statLabels[stat as SkillKey]}. ${available - spend} points remaining.`,
    remaining: available - spend,
    newValue: currentVal + spend,
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

router.get("/avatar", requireAuth, (req: AuthRequest, res) => {
  const db = getDb();
  const row = db.prepare("SELECT avatar_data FROM users WHERE id = ?").get(req.userId!) as any;
  if (!row?.avatar_data) {
    res.status(404).json({ success: false, message: "No avatar" });
    return;
  }
  const buf = Buffer.isBuffer(row.avatar_data) ? row.avatar_data : Buffer.from(row.avatar_data);
  res.set("Content-Type", "image/jpeg");
  res.set("Cache-Control", "no-store");
  res.send(buf);
});

router.post("/avatar", requireAuth, (req: AuthRequest, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) {
    res.status(400).json({ success: false, message: "imageBase64 is required" });
    return;
  }
  let buf: Buffer;
  try { buf = Buffer.from(imageBase64, "base64"); } catch {
    res.status(400).json({ success: false, message: "Invalid base64" });
    return;
  }
  try {
    const db = getDb();
    db.exec("ALTER TABLE users ADD COLUMN avatar_data BLOB").toString();
  } catch { /* column already exists */ }
  const db = getDb();
  db.prepare("UPDATE users SET avatar_data = ?, updated_at = unixepoch() WHERE id = ?").run(buf, req.userId!);
  res.json({ success: true, message: "Avatar updated" });
});

router.post("/background", requireAuth, (req: AuthRequest, res) => {
  const { imageBase64, bgType } = req.body as { imageBase64?: string; bgType?: string };
  const db = getDb();
  try { db.exec("ALTER TABLE users ADD COLUMN bg_data BLOB"); } catch { /* exists */ }
  if (imageBase64) {
    let buf: Buffer;
    try { buf = Buffer.from(imageBase64, "base64"); } catch {
      res.status(400).json({ success: false, message: "Invalid base64" });
      return;
    }
    db.prepare("UPDATE users SET bg_data = ?, bg_type = ?, updated_at = unixepoch() WHERE id = ?").run(buf, bgType || "static", req.userId!);
  } else if (bgType) {
    db.prepare("UPDATE users SET bg_type = ?, updated_at = unixepoch() WHERE id = ?").run(bgType, req.userId!);
  }
  res.json({ success: true, message: "Background updated" });
});

router.get("/background", requireAuth, (req: AuthRequest, res) => {
  const db = getDb();
  let row: any;
  try { row = db.prepare("SELECT bg_data FROM users WHERE id = ?").get(req.userId!); } catch { row = null; }
  if (!row?.bg_data) {
    res.status(404).json({ success: false, message: "No background" });
    return;
  }
  const buf = Buffer.isBuffer(row.bg_data) ? row.bg_data : Buffer.from(row.bg_data);
  res.set("Content-Type", "image/jpeg");
  res.set("Cache-Control", "no-store");
  res.send(buf);
});

router.post("/frame", requireAuth, (req: AuthRequest, res) => {
  const { frameId } = req.body as { frameId?: string };
  const db = getDb();
  db.prepare("UPDATE users SET profile_frame = ?, updated_at = unixepoch() WHERE id = ?").run(frameId || "", req.userId!);
  res.json({ success: true, message: "Frame updated" });
});

router.post("/bio", requireAuth, (req: AuthRequest, res) => {
  const { bio } = req.body as { bio?: string };
  if (typeof bio !== "string") {
    res.status(400).json({ success: false, message: "bio is required" });
    return;
  }
  const db = getDb();
  db.prepare("UPDATE users SET bio = ?, updated_at = unixepoch() WHERE id = ?").run(bio.slice(0, 200), req.userId!);
  res.json({ success: true, message: "Bio updated" });
});

export { router as userRouter };
