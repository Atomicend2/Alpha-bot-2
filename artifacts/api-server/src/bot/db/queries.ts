import { getDb } from "./database.js";

export function getUser(userId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
}

export function ensureUser(userId: string, name?: string) {
  const db = getDb();
  const existing = getUser(userId);
  if (!existing) {
    db.prepare(
      "INSERT OR IGNORE INTO users (id, name, balance) VALUES (?, ?, 500)"
    ).run(userId, name || userId);
  } else if (name && existing.name !== name) {
    db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, userId);
  }
  return getUser(userId);
}

export function updateUser(userId: string, data: Record<string, any>) {
  const db = getDb();
  const keys = Object.keys(data);
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE users SET ${set}, updated_at = unixepoch() WHERE id = ?`).run(
    ...keys.map((k) => data[k]),
    userId
  );
}

export function getGroup(groupId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId) as any;
}

export function ensureGroup(groupId: string, name?: string) {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO groups (id, name) VALUES (?, ?)"
  ).run(groupId, name || groupId);
  if (name) {
    db.prepare("UPDATE groups SET name = ? WHERE id = ?").run(name, groupId);
  }
  return getGroup(groupId);
}

export function updateGroup(groupId: string, data: Record<string, any>) {
  const db = getDb();
  const keys = Object.keys(data);
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE groups SET ${set}, updated_at = unixepoch() WHERE id = ?`).run(
    ...keys.map((k) => data[k]),
    groupId
  );
}

export function getWarnings(userId: string, groupId: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM warnings WHERE user_id = ? AND group_id = ?")
    .all(userId, groupId) as any[];
}

export function addWarning(userId: string, groupId: string, reason: string, warnedBy: string) {
  const db = getDb();
  db.prepare(
    "INSERT INTO warnings (user_id, group_id, reason, warned_by) VALUES (?, ?, ?, ?)"
  ).run(userId, groupId, reason, warnedBy);
  return getWarnings(userId, groupId);
}

export function resetWarnings(userId: string, groupId: string) {
  const db = getDb();
  db.prepare("DELETE FROM warnings WHERE user_id = ? AND group_id = ?").run(userId, groupId);
}

export function incrementMessageCount(userId: string, groupId: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO message_counts (user_id, group_id, count, last_message)
    VALUES (?, ?, 1, unixepoch())
    ON CONFLICT(user_id, group_id) DO UPDATE SET count = count + 1, last_message = unixepoch()
  `).run(userId, groupId);
}

export function getActiveMembers(groupId: string, days = 7, minMsgs = 5) {
  const db = getDb();
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  return db
    .prepare(
      "SELECT user_id, count FROM message_counts WHERE group_id = ? AND last_message > ? AND count >= ? ORDER BY count DESC"
    )
    .all(groupId, since, minMsgs) as any[];
}

export function getInactiveMembers(groupId: string, days = 7, minMsgs = 5) {
  const db = getDb();
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  return db
    .prepare(
      "SELECT user_id, count FROM message_counts WHERE group_id = ? AND (last_message <= ? OR count < ?) ORDER BY count ASC"
    )
    .all(groupId, since, minMsgs) as any[];
}

export function getCard(cardId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM cards WHERE id = ?").get(cardId) as any;
}

export function getAllCards(tier?: string) {
  const db = getDb();
  if (tier) {
    return db.prepare("SELECT * FROM cards WHERE tier = ?").all(tier) as any[];
  }
  return db.prepare("SELECT * FROM cards").all() as any[];
}

export function addCard(card: {
  id: string;
  name: string;
  tier: string;
  series?: string;
  image_data?: Buffer;
  description?: string;
  attack?: number;
  defense?: number;
  speed?: number;
  uploaded_by?: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO cards (id, name, tier, series, image_data, description, attack, defense, speed, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    card.id,
    card.name,
    card.tier,
    card.series || "General",
    card.image_data || null,
    card.description || "",
    card.attack || 50,
    card.defense || 50,
    card.speed || 50,
    card.uploaded_by || null
  );
}

export function getUserCards(userId: string) {
  const db = getDb();
  return db.prepare(`
    SELECT uc.id as user_card_id, uc.obtained_at, uc.lent_to, c.*
    FROM user_cards uc
    JOIN cards c ON c.id = uc.card_id
    WHERE uc.user_id = ?
    ORDER BY uc.obtained_at DESC
  `).all(userId) as any[];
}

export function getUserCard(userCardId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT uc.id as user_card_id, uc.user_id, uc.obtained_at, uc.lent_to, c.*
    FROM user_cards uc
    JOIN cards c ON c.id = uc.card_id
    WHERE uc.id = ?
  `).get(userCardId) as any;
}

export function giveCard(userId: string, cardId: string) {
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO user_cards (user_id, card_id) VALUES (?, ?)"
  ).run(userId, cardId);
  return result.lastInsertRowid as number;
}

export function transferCard(userCardId: number, newOwnerId: string) {
  const db = getDb();
  db.prepare("UPDATE user_cards SET user_id = ?, lent_to = NULL WHERE id = ?").run(
    newOwnerId,
    userCardId
  );
}

export function lendCard(userCardId: number, toUserId: string) {
  const db = getDb();
  db.prepare(
    "UPDATE user_cards SET lent_to = ?, lent_at = unixepoch() WHERE id = ?"
  ).run(toUserId, userCardId);
}

export function retrieveCard(userId: string) {
  const db = getDb();
  db.prepare(
    "UPDATE user_cards SET lent_to = NULL, lent_at = NULL WHERE user_id = ? AND lent_to IS NOT NULL"
  ).run(userId);
}

export function getLentCards(userId: string) {
  const db = getDb();
  return db.prepare(`
    SELECT uc.id as user_card_id, uc.lent_to, uc.lent_at, c.*
    FROM user_cards uc
    JOIN cards c ON c.id = uc.card_id
    WHERE uc.user_id = ? AND uc.lent_to IS NOT NULL
  `).all(userId) as any[];
}

export function addAuction(sellerId: string, userCardId: number, price: number) {
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO auctions (seller_id, user_card_id, price) VALUES (?, ?, ?)"
  ).run(sellerId, userCardId, price);
  return result.lastInsertRowid as number;
}

export function getAuctions() {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, c.name, c.tier, c.series, uc.user_id as seller_id
    FROM auctions a
    JOIN user_cards uc ON uc.id = a.user_card_id
    JOIN cards c ON c.id = uc.card_id
    WHERE a.active = 1
    ORDER BY a.created_at DESC
  `).all() as any[];
}

export function getAuction(auctionId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, c.name, c.tier, c.series, uc.user_id as card_owner
    FROM auctions a
    JOIN user_cards uc ON uc.id = a.user_card_id
    JOIN cards c ON c.id = uc.card_id
    WHERE a.id = ? AND a.active = 1
  `).get(auctionId) as any;
}

export function closeAuction(auctionId: number, buyerId: string) {
  const db = getDb();
  db.prepare(
    "UPDATE auctions SET active = 0, buyer_id = ?, sold_at = unixepoch() WHERE id = ?"
  ).run(buyerId, auctionId);
}

export function spawnCardInGroup(groupId: string, cardId: string, messageId?: string) {
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO card_spawns (group_id, card_id, message_id) VALUES (?, ?, ?)"
  ).run(groupId, cardId, messageId || null);
  return result.lastInsertRowid as number;
}

export function getActiveSpawn(groupId: string) {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM card_spawns WHERE group_id = ? AND claimed_by IS NULL ORDER BY spawned_at DESC LIMIT 1"
  ).get(groupId) as any;
}

export function claimSpawn(spawnId: number, userId: string) {
  const db = getDb();
  db.prepare(
    "UPDATE card_spawns SET claimed_by = ?, claimed_at = unixepoch() WHERE id = ?"
  ).run(userId, spawnId);
}

export function deleteCard(cardId: string) {
  const db = getDb();
  db.prepare("DELETE FROM card_spawns WHERE card_id = ?").run(cardId);
  db.prepare("DELETE FROM user_cards WHERE card_id = ?").run(cardId);
  db.prepare("DELETE FROM cards WHERE id = ?").run(cardId);
}

export function getDeck(userId: string) {
  const db = getDb();
  return db.prepare(`
    SELECT cd.slot, uc.id as user_card_id, c.*
    FROM card_deck cd
    JOIN user_cards uc ON uc.id = cd.user_card_id
    JOIN cards c ON c.id = uc.card_id
    WHERE cd.user_id = ?
    ORDER BY cd.slot
  `).all(userId) as any[];
}

export function addToDeck(userId: string, slot: number, userCardId: number) {
  const db = getDb();
  db.prepare(
    "INSERT OR REPLACE INTO card_deck (user_id, slot, user_card_id) VALUES (?, ?, ?)"
  ).run(userId, slot, userCardId);
}

export function removeFromDeck(userId: string, slot: number) {
  const db = getDb();
  db.prepare("DELETE FROM card_deck WHERE user_id = ? AND slot = ?").run(userId, slot);
}

export function clearDeck(userId: string) {
  const db = getDb();
  db.prepare("DELETE FROM card_deck WHERE user_id = ?").run(userId);
}

export function getRichList(groupId?: string, limit = 10) {
  const db = getDb();
  if (groupId) {
    return db.prepare(`
      SELECT u.id, u.name, u.balance + u.bank as total
      FROM users u
      WHERE u.id IN (SELECT user_id FROM message_counts WHERE group_id = ?)
      ORDER BY total DESC LIMIT ?
    `).all(groupId, limit) as any[];
  }
  return db.prepare(`
    SELECT id, name, balance + bank as total
    FROM users ORDER BY total DESC LIMIT ?
  `).all(limit) as any[];
}

export function getCardLeaderboard(limit = 10) {
  const db = getDb();
  return db.prepare(`
    SELECT user_id, COUNT(*) as card_count
    FROM user_cards GROUP BY user_id ORDER BY card_count DESC LIMIT ?
  `).all(limit) as any[];
}

export function setAfk(userId: string, reason: string) {
  const db = getDb();
  db.prepare(
    "INSERT OR REPLACE INTO afk_users (user_id, reason, started_at) VALUES (?, ?, unixepoch())"
  ).run(userId, reason);
}

export function removeAfk(userId: string) {
  const db = getDb();
  db.prepare("DELETE FROM afk_users WHERE user_id = ?").run(userId);
}

export function getAfk(userId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM afk_users WHERE user_id = ?").get(userId) as any;
}

export function getRpg(userId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM rpg_characters WHERE user_id = ?").get(userId) as any;
}

export function ensureRpg(userId: string) {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO rpg_characters (user_id) VALUES (?)
  `).run(userId);
  return getRpg(userId);
}

export function updateRpg(userId: string, data: Record<string, any>) {
  const db = getDb();
  const keys = Object.keys(data);
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE rpg_characters SET ${set} WHERE user_id = ?`).run(
    ...keys.map((k) => data[k]),
    userId
  );
}

export function getInventory(userId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM inventory WHERE user_id = ? AND quantity > 0").all(userId) as any[];
}

export function addToInventory(userId: string, item: string, qty = 1) {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM inventory WHERE user_id = ? AND item = ?").get(userId, item) as any;
  if (existing) {
    db.prepare("UPDATE inventory SET quantity = quantity + ? WHERE user_id = ? AND item = ?").run(qty, userId, item);
  } else {
    db.prepare("INSERT INTO inventory (user_id, item, quantity) VALUES (?, ?, ?)").run(userId, item, qty);
  }
}

export function removeFromInventory(userId: string, item: string, qty = 1) {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM inventory WHERE user_id = ? AND item = ?").get(userId, item) as any;
  if (!existing || existing.quantity < qty) return false;
  db.prepare("UPDATE inventory SET quantity = quantity - ? WHERE user_id = ? AND item = ?").run(qty, userId, item);
  return true;
}

export function getShop() {
  const db = getDb();
  return db.prepare("SELECT * FROM shop_items ORDER BY category, price").all() as any[];
}

export function getShopItem(name: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM shop_items WHERE LOWER(name) = LOWER(?)").get(name) as any;
}

export function getGuild(name: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM guilds WHERE LOWER(name) = LOWER(?)").get(name) as any;
}

export function getGuildById(guildId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM guilds WHERE id = ?").get(guildId) as any;
}

export function getUserGuild(userId: string) {
  const db = getDb();
  const membership = db.prepare("SELECT * FROM guild_members WHERE user_id = ?").get(userId) as any;
  if (!membership) return null;
  return db.prepare("SELECT * FROM guilds WHERE id = ?").get(membership.guild_id) as any;
}

export function createGuild(id: string, name: string, ownerId: string) {
  const db = getDb();
  db.prepare("INSERT INTO guilds (id, name, owner_id) VALUES (?, ?, ?)").run(id, name, ownerId);
  db.prepare("INSERT INTO guild_members (user_id, guild_id) VALUES (?, ?)").run(ownerId, id);
}

export function joinGuild(userId: string, guildId: string) {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO guild_members (user_id, guild_id) VALUES (?, ?)").run(userId, guildId);
}

export function leaveGuild(userId: string) {
  const db = getDb();
  db.prepare("DELETE FROM guild_members WHERE user_id = ?").run(userId);
}

export function getGuildMembers(guildId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM guild_members WHERE guild_id = ?").all(guildId) as any[];
}

export function kickFromGuild(userId: string, guildId: string) {
  const db = getDb();
  db.prepare("DELETE FROM guild_members WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
}

export function disbandGuild(guildId: string) {
  const db = getDb();
  db.prepare("DELETE FROM guild_members WHERE guild_id = ?").run(guildId);
  db.prepare("DELETE FROM guilds WHERE id = ?").run(guildId);
}

export function getAllGuilds() {
  const db = getDb();
  return db.prepare("SELECT * FROM guilds ORDER BY level DESC").all() as any[];
}

export function addStaff(userId: string, role: string, addedBy: string) {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO staff (user_id, role, added_by) VALUES (?, ?, ?)").run(userId, role, addedBy);
}

export function getStaff(userId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM staff WHERE user_id = ?").get(userId) as any;
}

export function getStaffList() {
  const db = getDb();
  return db.prepare("SELECT * FROM staff").all() as any[];
}

export function addMod(userId: string, groupId: string, addedBy: string) {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO mods (user_id, group_id, added_by) VALUES (?, ?, ?)").run(userId, groupId, addedBy);
}

export function getMods(groupId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM mods WHERE group_id = ?").all(groupId) as any[];
}

export function isMod(userId: string, groupId: string) {
  const db = getDb();
  return !!db.prepare("SELECT 1 FROM mods WHERE user_id = ? AND group_id = ?").get(userId, groupId);
}

export function getSummerTokens(userId: string) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM summer_tokens WHERE user_id = ?").get(userId) as any;
  return row?.tokens || 0;
}

export function addSummerTokens(userId: string, amount: number) {
  const db = getDb();
  db.prepare(`
    INSERT INTO summer_tokens (user_id, tokens) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET tokens = tokens + ?
  `).run(userId, amount, amount);
}

export function setSummerTokens(userId: string, amount: number) {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO summer_tokens (user_id, tokens) VALUES (?, ?)").run(userId, amount);
}

export function getTopSummerTokens(limit = 10) {
  const db = getDb();
  return db.prepare("SELECT * FROM summer_tokens ORDER BY tokens DESC LIMIT ?").all(limit) as any[];
}

export function createTradeOffer(fromUser: string, toUser: string, fromCard: number, toCard: number) {
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO trade_offers (from_user, to_user, from_card, to_card) VALUES (?, ?, ?, ?)"
  ).run(fromUser, toUser, fromCard, toCard);
  return result.lastInsertRowid as number;
}

export function getPendingTrade(toUser: string) {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM trade_offers WHERE to_user = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
  ).get(toUser) as any;
}

export function updateTradeStatus(id: number, status: string) {
  const db = getDb();
  db.prepare("UPDATE trade_offers SET status = ? WHERE id = ?").run(status, id);
}

export function createSellOffer(sellerId: string, buyerId: string, userCardId: number, price: number) {
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO sell_offers (seller_id, buyer_id, user_card_id, price) VALUES (?, ?, ?, ?)"
  ).run(sellerId, buyerId, userCardId, price);
  return result.lastInsertRowid as number;
}

export function getPendingSellOffer(buyerId: string) {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM sell_offers WHERE buyer_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
  ).get(buyerId) as any;
}

export function updateSellOfferStatus(id: number, status: string) {
  const db = getDb();
  db.prepare("UPDATE sell_offers SET status = ? WHERE id = ?").run(status, id);
}
