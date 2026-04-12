import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, "../../..", "data");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, "bot.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      balance INTEGER DEFAULT 0,
      bank INTEGER DEFAULT 0,
      gems INTEGER DEFAULT 0,
      premium_balance INTEGER DEFAULT 0,
      premium INTEGER DEFAULT 0,
      premium_expiry INTEGER DEFAULT 0,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      bio TEXT DEFAULT '',
      age TEXT DEFAULT '',
      profile_picture BLOB,
      profile_background BLOB,
      last_daily INTEGER DEFAULT 0,
      warn_count INTEGER DEFAULT 0,
      registered INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      reason TEXT,
      warned_by TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT,
      antilink TEXT DEFAULT 'off',
      antilink_action TEXT DEFAULT 'delete',
      antispam TEXT DEFAULT 'off',
      anti_admin TEXT DEFAULT 'off',
      anti_bot TEXT DEFAULT 'off',
      anti_camping TEXT DEFAULT 'off',
      welcome TEXT DEFAULT 'off',
      welcome_msg TEXT DEFAULT '',
      leave TEXT DEFAULT 'off',
      leave_msg TEXT DEFAULT '',
      muted INTEGER DEFAULT 0,
      cards_enabled TEXT DEFAULT 'on',
      spawn_enabled TEXT DEFAULT 'on',
      games_enabled TEXT DEFAULT 'on',
      gambling_enabled TEXT DEFAULT 'on',
      blacklist TEXT DEFAULT '[]',
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS message_counts (
      user_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      last_message INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, group_id)
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tier TEXT NOT NULL,
      series TEXT DEFAULT 'General',
      image_url TEXT DEFAULT '',
      image_data BLOB,
      description TEXT DEFAULT '',
      attack INTEGER DEFAULT 50,
      defense INTEGER DEFAULT 50,
      speed INTEGER DEFAULT 50,
      uploaded_by TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS user_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      obtained_at INTEGER DEFAULT (unixepoch()),
      lent_to TEXT DEFAULT NULL,
      lent_at INTEGER DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS card_deck (
      user_id TEXT NOT NULL,
      slot INTEGER NOT NULL,
      user_card_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, slot)
    );

    CREATE TABLE IF NOT EXISTS deck_backgrounds (
      user_id TEXT PRIMARY KEY,
      background TEXT DEFAULT 'default'
    );

    CREATE TABLE IF NOT EXISTS auctions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id TEXT NOT NULL,
      user_card_id INTEGER NOT NULL,
      price INTEGER NOT NULL,
      active INTEGER DEFAULT 1,
      buyer_id TEXT DEFAULT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      sold_at INTEGER DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS card_spawns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      message_id TEXT,
      spawned_at INTEGER DEFAULT (unixepoch()),
      claimed_by TEXT DEFAULT NULL,
      claimed_at INTEGER DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS trade_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user TEXT NOT NULL,
      to_user TEXT NOT NULL,
      from_card INTEGER NOT NULL,
      to_card INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS sell_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      user_card_id INTEGER NOT NULL,
      price INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS guild_members (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      joined_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (user_id)
    );

    CREATE TABLE IF NOT EXISTS guilds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      description TEXT DEFAULT '',
      level INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS lotteries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT,
      pool INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      winner_id TEXT DEFAULT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      ended_at INTEGER DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS lottery_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lottery_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS afk_users (
      user_id TEXT PRIMARY KEY,
      reason TEXT DEFAULT '',
      started_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      group_id TEXT NOT NULL,
      player1 TEXT NOT NULL,
      player2 TEXT,
      state TEXT NOT NULL,
      current_turn TEXT,
      status TEXT DEFAULT 'waiting',
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS uno_games (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      players TEXT NOT NULL,
      deck TEXT NOT NULL,
      discard TEXT NOT NULL,
      current_player INTEGER DEFAULT 0,
      direction INTEGER DEFAULT 1,
      status TEXT DEFAULT 'waiting',
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS uno_hands (
      game_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      cards TEXT NOT NULL,
      PRIMARY KEY (game_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS word_chain (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      players TEXT NOT NULL,
      last_word TEXT DEFAULT '',
      used_words TEXT DEFAULT '[]',
      current_player INTEGER DEFAULT 0,
      status TEXT DEFAULT 'waiting',
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS rpg_characters (
      user_id TEXT PRIMARY KEY,
      class TEXT DEFAULT 'Warrior',
      hp INTEGER DEFAULT 100,
      max_hp INTEGER DEFAULT 100,
      attack INTEGER DEFAULT 20,
      defense INTEGER DEFAULT 10,
      speed INTEGER DEFAULT 15,
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      quest_active TEXT DEFAULT NULL,
      dungeon_floor INTEGER DEFAULT 1,
      last_adventure INTEGER DEFAULT 0,
      last_quest INTEGER DEFAULT 0,
      last_raid INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      item TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      acquired_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS shop_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price INTEGER NOT NULL,
      effect TEXT DEFAULT '',
      category TEXT DEFAULT 'general'
    );

    CREATE TABLE IF NOT EXISTS battle_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenger TEXT NOT NULL,
      challenged TEXT NOT NULL,
      group_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS summer_tokens (
      user_id TEXT PRIMARY KEY,
      tokens INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS staff (
      user_id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      added_by TEXT,
      added_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS mods (
      user_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      added_by TEXT,
      added_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, group_id)
    );

    CREATE TABLE IF NOT EXISTS banned_entities (
      type TEXT NOT NULL,
      target TEXT NOT NULL,
      display TEXT DEFAULT '',
      reason TEXT DEFAULT '',
      added_by TEXT,
      added_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (type, target)
    );

    CREATE TABLE IF NOT EXISTS bot_settings (
      key TEXT PRIMARY KEY,
      value BLOB NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    INSERT OR IGNORE INTO shop_items (name, description, price, effect, category) VALUES
      ('Health Potion', 'Restores 50 HP in battle', 500, 'heal:50', 'rpg'),
      ('Elixir', 'Fully restores HP', 2000, 'heal:full', 'rpg'),
      ('Sword', 'Increases attack by 10', 3000, 'attack:10', 'rpg'),
      ('Shield', 'Increases defense by 10', 3000, 'defense:10', 'rpg'),
      ('Speed Boots', 'Increases speed by 10', 3000, 'speed:10', 'rpg'),
      ('Lucky Charm', 'Boosts daily rewards', 1500, 'daily_boost', 'general'),
      ('VIP Pass', 'Access to exclusive commands', 10000, 'vip', 'premium'),
      ('Card Pack', 'Random card draw', 5000, 'card_pack', 'cards');
  `);

  ensureColumn(db, "users", "last_work", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "last_dig", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "last_fish", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "last_beg", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "last_gamble", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "dig_uses", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "dig_date", "TEXT DEFAULT ''");
  ensureColumn(db, "users", "fish_uses", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "fish_date", "TEXT DEFAULT ''");
  ensureColumn(db, "users", "gamble_uses", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "gamble_date", "TEXT DEFAULT ''");
  ensureColumn(db, "users", "borrowed_cash", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "lent_cash", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "premium_balance", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "premium", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "premium_expiry", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "registered", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "warn_count", "INTEGER DEFAULT 0");
  ensureColumn(db, "users", "profile_picture", "BLOB");
  ensureColumn(db, "users", "profile_background", "BLOB");
  ensureColumn(db, "groups", "ai_chat", "TEXT DEFAULT 'off'");
  ensureColumn(db, "groups", "antilink_action", "TEXT DEFAULT 'delete'");
  ensureColumn(db, "groups", "antispam", "TEXT DEFAULT 'off'");
  ensureColumn(db, "groups", "anti_admin", "TEXT DEFAULT 'off'");
  ensureColumn(db, "groups", "anti_bot", "TEXT DEFAULT 'off'");
  ensureColumn(db, "groups", "anti_camping", "TEXT DEFAULT 'off'");
  ensureColumn(db, "groups", "welcome", "TEXT DEFAULT 'off'");
  ensureColumn(db, "groups", "welcome_msg", "TEXT DEFAULT ''");
  ensureColumn(db, "groups", "leave", "TEXT DEFAULT 'off'");
  ensureColumn(db, "groups", "leave_msg", "TEXT DEFAULT ''");
  ensureColumn(db, "groups", "muted", "INTEGER DEFAULT 0");
  ensureColumn(db, "groups", "cards_enabled", "TEXT DEFAULT 'on'");
  ensureColumn(db, "groups", "spawn_enabled", "TEXT DEFAULT 'on'");
  ensureColumn(db, "groups", "games_enabled", "TEXT DEFAULT 'on'");
  ensureColumn(db, "groups", "gambling_enabled", "TEXT DEFAULT 'on'");
  ensureColumn(db, "groups", "blacklist", "TEXT DEFAULT '[]'");
  ensureColumn(db, "cards", "series", "TEXT DEFAULT 'General'");
  ensureColumn(db, "cards", "image_url", "TEXT DEFAULT ''");
  ensureColumn(db, "cards", "image_data", "BLOB");
  ensureColumn(db, "cards", "description", "TEXT DEFAULT ''");
  ensureColumn(db, "cards", "attack", "INTEGER DEFAULT 50");
  ensureColumn(db, "cards", "defense", "INTEGER DEFAULT 50");
  ensureColumn(db, "cards", "speed", "INTEGER DEFAULT 50");
  ensureColumn(db, "cards", "uploaded_by", "TEXT");
  ensureColumn(db, "staff", "added_by", "TEXT");
  ensureColumn(db, "staff", "added_at", "INTEGER DEFAULT 0");
  ensureColumn(db, "banned_entities", "display", "TEXT DEFAULT ''");
  ensureColumn(db, "banned_entities", "reason", "TEXT DEFAULT ''");
  ensureColumn(db, "banned_entities", "added_by", "TEXT");
  ensureColumn(db, "banned_entities", "added_at", "INTEGER DEFAULT 0");
  ensureColumn(db, "rpg_characters", "last_dungeon", "INTEGER DEFAULT 0");
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
