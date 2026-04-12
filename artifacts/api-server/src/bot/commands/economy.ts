import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";
import {
  getUser, ensureUser, updateUser, getInventory, addToInventory, removeFromInventory,
  getShop, getShopItem, getRichList, ensureRpg, getUserRank, getUserGuild, isBanned,
} from "../db/queries.js";
import { formatNumber, timeAgo } from "../utils.js";
import sharp from "sharp";
import path from "node:path";

const DAILY_AMOUNT = 1000;
const DAILY_COOLDOWN = 86400;
const WORK_COOLDOWN = 3600;
const DIG_COOLDOWN = 120;
const FISH_COOLDOWN = 120;
const BEG_COOLDOWN = 300;
const DIG_FISH_DAILY_LIMIT = 20;

const WORK_JOBS = [
  "You coded for 8 hours straight",
  "You delivered packages in the rain",
  "You served tables all night",
  "You fixed a mysterious server bug",
  "You designed a logo for a client",
  "You streamed for 4 hours",
  "You wrote an article",
  "You taught online classes",
];

const DIG_FINDS = [
  { item: "Ancient Coin", value: 200 },
  { item: "Rusty Sword", value: 300 },
  { item: "Buried Treasure", value: 376 },
  { item: "Old Ring", value: 150 },
  { item: "Gem Fragment", value: 350 },
  { item: "Nothing", value: 0 },
  { item: "Worm", value: 10 },
];

const FISH_CATCHES = [
  { item: "Common Fish", value: 50 },
  { item: "Rare Fish", value: 200 },
  { item: "Legendary Fish", value: 376 },
  { item: "Boot", value: 5 },
  { item: "Trash Bag", value: 1 },
  { item: "Pearl", value: 350 },
  { item: "Nothing", value: 0 },
];

const BEG_RESPONSES = [
  "A kind stranger gave you some coins.",
  "Someone took pity on you.",
  "You found some loose change.",
  "A passerby dropped some coins.",
];

export async function handleEconomy(ctx: CommandContext): Promise<void> {
  const { from, sender, args, command: cmd } = ctx;

  const user = ensureUser(sender);
  const now = Math.floor(Date.now() / 1000);

  if (cmd === "balance" || cmd === "bal") {
    await sendText(
      from,
      `💰 *Balance — @${sender.split("@")[0]}*\n\n` +
      `🏦 Bank: $${formatNumber(user.bank || 0)}\n` +
      `👛 Wallet: $${formatNumber(user.balance || 0)}\n` +
      `💎 Gems: ${user.gems || 0}\n` +
      `📊 Total: $${formatNumber((user.balance || 0) + (user.bank || 0))}`,
      [sender]
    );
    return;
  }

  if (cmd === "gems") {
    await sendText(from, `💎 You have *${user.gems || 0}* gems.`);
    return;
  }

  if (cmd === "premiumbal" || cmd === "pbal") {
    await sendText(from, `⭐ Premium Balance: *${formatNumber(user.premium_balance || 0)} pts*`);
    return;
  }

  if (cmd === "premium" || cmd === "prem") {
    if (user.premium) {
      const exp = user.premium_expiry;
      const left = exp - now;
      if (left > 0) {
        await sendText(from, `⭐ You have *Premium* status!\nExpires in: ${formatDuration(left)}`);
      } else {
        updateUser(sender, { premium: 0 });
        await sendText(from, "❌ Your premium has expired.");
      }
    } else {
      await sendText(from, "❌ You don't have premium. Get it from an owner/admin.");
    }
    return;
  }

  if (cmd === "membership" || cmd === "memb") {
    const lvl = user.level || 1;
    const xp = user.xp || 0;
    const xpNeeded = lvl * 100;
    await sendText(
      from,
      `👤 *Membership — @${sender.split("@")[0]}*\n\n` +
      `🎖️ Level: ${lvl}\n` +
      `✨ XP: ${xp} / ${xpNeeded}\n` +
      `⭐ Premium: ${user.premium ? "Yes" : "No"}\n` +
      `📅 Joined: ${timeAgo(user.created_at || now)}`,
      [sender]
    );
    return;
  }

  if (cmd === "daily") {
    const last = user.last_daily || 0;
    const diff = now - last;
    if (diff < DAILY_COOLDOWN) {
      const remaining = DAILY_COOLDOWN - diff;
      await sendText(from, `⏳ Daily cooldown: ${formatDuration(remaining)} left.`);
      return;
    }
    const amount = DAILY_AMOUNT + (user.premium ? 500 : 0);
    updateUser(sender, { balance: (user.balance || 0) + amount, last_daily: now });
    await sendText(from, `🎁 Daily reward: *$${formatNumber(amount)}*!\nNew balance: $${formatNumber((user.balance || 0) + amount)}`);
    return;
  }

  if (cmd === "withdraw" || cmd === "wid") {
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
      await sendText(from, "❌ Enter a valid amount. Usage: .withdraw [amount]");
      return;
    }
    if (amount > (user.bank || 0)) {
      await sendText(from, `❌ Not enough in bank. Bank: $${formatNumber(user.bank || 0)}`);
      return;
    }
    updateUser(sender, { bank: (user.bank || 0) - amount, balance: (user.balance || 0) + amount });
    await sendText(from, `✅ Withdrew $${formatNumber(amount)} from bank.\nWallet: $${formatNumber((user.balance || 0) + amount)}`);
    return;
  }

  if (cmd === "deposit" || cmd === "dep") {
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
      await sendText(from, "❌ Enter a valid amount. Usage: .deposit [amount]");
      return;
    }
    if (amount > (user.balance || 0)) {
      await sendText(from, `❌ Not enough in wallet. Wallet: $${formatNumber(user.balance || 0)}`);
      return;
    }
    updateUser(sender, { balance: (user.balance || 0) - amount, bank: (user.bank || 0) + amount });
    await sendText(from, `✅ Deposited $${formatNumber(amount)} to bank.\nBank: $${formatNumber((user.bank || 0) + amount)}`);
    return;
  }

  if (cmd === "donate") {
    const info = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const mentioned = info?.mentionedJid?.[0] || info?.participant;
    const amount = parseInt(args[args.length - 1]);
    if (!mentioned || isNaN(amount) || amount <= 0) {
      await sendText(from, "❌ Usage: .donate @user [amount] or reply with .donate [amount]");
      return;
    }
    if (amount > (user.balance || 0)) {
      await sendText(from, "❌ Not enough in wallet.");
      return;
    }
    const target = ensureUser(mentioned);
    updateUser(sender, { balance: (user.balance || 0) - amount });
    updateUser(mentioned, { balance: (target.balance || 0) + amount });
    await sendText(from, `💸 @${sender.split("@")[0]} donated $${formatNumber(amount)} to @${mentioned.split("@")[0]}!`, [sender, mentioned]);
    return;
  }

  if (cmd === "cds") {
    const digUsage = getDailyUsage(user, "dig", now);
    const fishUsage = getDailyUsage(user, "fish", now);
    const gambleDay = new Date(now * 1000).toISOString().slice(0, 10);
    const gambleUses = user.gamble_date === gambleDay ? Number(user.gamble_uses || 0) : 0;
    const cooldowns = [
      ["Daily", DAILY_COOLDOWN, user.last_daily || 0],
      ["Work", WORK_COOLDOWN, user.last_work || 0],
      ["Dig", DIG_COOLDOWN, user.last_dig || 0],
      ["Fish", FISH_COOLDOWN, user.last_fish || 0],
      ["Beg", BEG_COOLDOWN, user.last_beg || 0],
      ["Gamble", 420, user.last_gamble || 0],
    ];
    let text = `╔═ ❰ ⏳ 𝗖𝗢𝗢𝗟𝗗𝗢𝗪𝗡𝗦 ❱ ═╗\n║ @${sender.split("@")[0]}\n║\n`;
    for (const [name, cooldown, last] of cooldowns) {
      const remaining = Math.max(0, Number(cooldown) - (now - Number(last)));
      text += `║ ➩ ${name}: ${remaining > 0 ? formatDuration(remaining) : "Ready"}\n`;
    }
    text += `║\n║ ⛏️ Dig uses: ${digUsage.count}/${DIG_FISH_DAILY_LIMIT}\n`;
    text += `║ 🎣 Fish uses: ${fishUsage.count}/${DIG_FISH_DAILY_LIMIT}\n`;
    text += `║ 🎰 Gamble uses: ${gambleUses}/20\n`;
    text += "╚══════════════════╝";
    await sendText(from, text, [sender]);
    return;
  }

  if (cmd === "richlist") {
    const list = getRichList(from.endsWith("@g.us") ? from : undefined, 10);
    let text = "👑 *Rich List (Group)*\n\n";
    list.forEach((u, i) => {
      text += `${i + 1}. @${u.id.split("@")[0]} — $${formatNumber(u.total)}\n`;
    });
    await ctx.sock.sendMessage(from, { text, mentions: list.map((u) => u.id) });
    return;
  }

  if (cmd === "richlistglobal" || cmd === "richlg") {
    const list = getRichList(undefined, 10);
    let text = "👑 *Rich List (Global)*\n\n";
    list.forEach((u, i) => {
      text += `${i + 1}. @${u.id.split("@")[0]} — $${formatNumber(u.total)}\n`;
    });
    await ctx.sock.sendMessage(from, { text, mentions: list.map((u) => u.id) });
    return;
  }

  if (cmd === "register" || cmd === "reg") {
    if (user.registered) {
      await sendText(from, "✅ You're already registered!");
      return;
    }
    updateUser(sender, { registered: 1, balance: (user.balance || 0) + 2000 });
    await sendText(from, `✅ Welcome! You've been registered and received a $2,000 starter bonus!\n\nUse .profile to see your profile.`);
    return;
  }

  if (cmd === "setname") {
    const name = args.join(" ");
    if (!name) { await sendText(from, "❌ Usage: .setname <name>"); return; }
    updateUser(sender, { name });
    await sendText(from, `✅ Name set to: *${name}*`);
    return;
  }

  if (cmd === "profile" || cmd === "p") {
    const info = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const targetId = info?.mentionedJid?.[0] || info?.participant || sender;
    const target = ensureUser(targetId);
    const rpg = ensureRpg(targetId);
    const rank = getUserRank(targetId);
    const guild = getUserGuild(targetId);
    const role = getProfileRole(target);
    const name = target.name || `@${targetId.split("@")[0]}`;
    const age = target.age || "Not set";
    const bio = target.bio || "No bio set";
    const registered = formatProfileDate(Number(target.created_at || now));
    const profileImage = await buildProfileImage(ctx, targetId, target, rpg, rank, role).catch(async () => null);

    const text =
      `╭━━━✦ 𝙋𝙇𝘼𝙔𝙀𝙍 𝙋𝙍𝙊𝙁𝙄𝙇𝙀 ✦━━━╮\n` +
      ` Welcome to your profile\n\n` +
      `✧ 𝗡𝗮𝗺𝗲: ${name}\n` +
      `✧ 𝗔𝗴𝗲: ${age}\n` +
      `✧ 𝗕𝗶𝗼: ${bio}\n` +
      `✧ 𝗥𝗲𝗴𝗶𝘀𝘁𝗲𝗿𝗲𝗱: ${registered}\n` +
      `✧ 𝗥𝗼𝗹𝗲: ${role}\n` +
      `✧ 𝗚𝘂𝗶𝗹𝗱: ${guild?.name || "None"}\n\n` +
      `✧ 𝗕𝗮𝗻𝗻𝗲𝗱: ${isBanned("user", targetId) ? "Yes" : "No"}`;

    if (profileImage) {
      await ctx.sock.sendMessage(from, { image: profileImage, caption: text, mentions: [targetId] });
    } else {
      await ctx.sock.sendMessage(from, { text, mentions: [targetId] });
    }
    return;
  }

  if (cmd === "bio") {
    const bio = args.join(" ");
    if (!bio) { await sendText(from, "❌ Usage: .bio [your bio]"); return; }
    updateUser(sender, { bio });
    await sendText(from, `✅ Bio updated: ${bio}`);
    return;
  }

  if (cmd === "setage") {
    const age = args[0];
    if (!age) { await sendText(from, "❌ Usage: .setage [age]"); return; }
    updateUser(sender, { age });
    await sendText(from, `✅ Age set to: ${age}`);
    return;
  }

  if (cmd === "inventory" || cmd === "inv") {
    const inv = getInventory(sender);
    if (inv.length === 0) {
      await sendText(from, "🎒 Your inventory is empty.");
      return;
    }
    const text = `🎒 *Inventory — @${sender.split("@")[0]}*\n\n` +
      inv.map((i) => `• ${i.item} x${i.quantity}`).join("\n");
    await sendText(from, text);
    return;
  }

  if (cmd === "shop") {
    const items = getShop();
    const categories: Record<string, any[]> = {};
    for (const item of items) {
      if (!categories[item.category]) categories[item.category] = [];
      categories[item.category].push(item);
    }
    let text = "🏪 *SHOP*\n\n";
    for (const [cat, items] of Object.entries(categories)) {
      text += `📦 *${cat.toUpperCase()}*\n`;
      for (const item of items) {
        text += `  • ${item.name} — $${formatNumber(item.price)}\n    ${item.description}\n`;
      }
      text += "\n";
    }
    text += "Use .buy [item name] to purchase.";
    await sendText(from, text);
    return;
  }

  if (cmd === "buy") {
    const itemName = args.join(" ");
    const item = getShopItem(itemName);
    if (!item) { await sendText(from, "❌ Item not found. Use .shop to see available items."); return; }
    if ((user.balance || 0) < item.price) {
      await sendText(from, `❌ Not enough money. You need $${formatNumber(item.price)}, you have $${formatNumber(user.balance || 0)}.`);
      return;
    }
    updateUser(sender, { balance: (user.balance || 0) - item.price });
    addToInventory(sender, item.name);
    await sendText(from, `✅ Purchased *${item.name}* for $${formatNumber(item.price)}!`);
    return;
  }

  if (cmd === "sell") {
    const itemName = args.join(" ");
    const removed = removeFromInventory(sender, itemName);
    if (!removed) { await sendText(from, "❌ You don't have that item."); return; }
    const item = getShopItem(itemName);
    const sellPrice = Math.floor((item?.price || 100) * 0.5);
    updateUser(sender, { balance: (user.balance || 0) + sellPrice });
    await sendText(from, `✅ Sold *${itemName}* for $${formatNumber(sellPrice)}.`);
    return;
  }

  if (cmd === "use") {
    const itemName = args.join(" ");
    const inv = getInventory(sender);
    const entry = inv.find((i) => i.item.toLowerCase() === itemName.toLowerCase());
    if (!entry) { await sendText(from, "❌ You don't have that item."); return; }

    const item = getShopItem(itemName);
    if (!item) { await sendText(from, "❌ Unknown item effect."); return; }

    if (item.effect.startsWith("heal:")) {
      const rpg = ensureRpg(sender);
      let heal = item.effect === "heal:full" ? rpg.max_hp : parseInt(item.effect.split(":")[1]);
      const newHp = Math.min(rpg.hp + heal, rpg.max_hp);
      const { updateRpg } = await import("../db/queries.js");
      updateRpg(sender, { hp: newHp });
      removeFromInventory(sender, itemName);
      await sendText(from, `❤️ Used *${itemName}*. HP: ${newHp}/${rpg.max_hp}`);
    } else {
      removeFromInventory(sender, itemName);
      await sendText(from, `✅ Used *${itemName}*. Effect applied!`);
    }
    return;
  }

  if (cmd === "leaderboard" || cmd === "lb") {
    const list = getRichList(from.endsWith("@g.us") ? from : undefined, 10);
    let text = "🏆 *Leaderboard*\n\n";
    list.forEach((u, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
      text += `${medal} @${u.id.split("@")[0]} — $${formatNumber(u.total)}\n`;
    });
    await ctx.sock.sendMessage(from, { text, mentions: list.map((u) => u.id) });
    return;
  }

  if (cmd === "work") {
    const lastWork = user.last_work || 0;
    const diff = now - lastWork;
    if (diff < WORK_COOLDOWN) {
      await sendText(from, `⏳ Cooldown: ${formatDuration(WORK_COOLDOWN - diff)} left to work again.`);
      return;
    }
    const job = WORK_JOBS[Math.floor(Math.random() * WORK_JOBS.length)];
    const earned = 200 + Math.floor(Math.random() * 300);
    updateUser(sender, { balance: (user.balance || 0) + earned, last_work: now });
    await sendText(from, `💼 ${job} and earned *$${formatNumber(earned)}*!\nWallet: $${formatNumber((user.balance || 0) + earned)}`);
    return;
  }

  if (cmd === "dig") {
    const usage = getDailyUsage(user, "dig", now);
    if (usage.count >= DIG_FISH_DAILY_LIMIT) {
      await sendText(from, `⛔ Daily dig limit reached (${DIG_FISH_DAILY_LIMIT}/day). Try again tomorrow.`);
      return;
    }
    const lastDig = user.last_dig || 0;
    const diff = now - lastDig;
    if (diff < DIG_COOLDOWN) {
      await sendText(from, `⏳ Cooldown: ${formatDuration(DIG_COOLDOWN - diff)} left to dig again.`);
      return;
    }
    const find = DIG_FINDS[Math.floor(Math.random() * DIG_FINDS.length)];
    const value = Math.min(376, find.value);
    updateUser(sender, {
      balance: (user.balance || 0) + value,
      last_dig: now,
      dig_uses: usage.count + 1,
      dig_date: usage.day,
    });
    if (value > 0) addToInventory(sender, find.item);
    await sendText(from, `⛏️ You dug and found: *${find.item}*!\n${value > 0 ? `+$${formatNumber(value)}` : "Nothing of value..."}\nUses today: ${usage.count + 1}/${DIG_FISH_DAILY_LIMIT}`);
    return;
  }

  if (cmd === "fish") {
    const usage = getDailyUsage(user, "fish", now);
    if (usage.count >= DIG_FISH_DAILY_LIMIT) {
      await sendText(from, `⛔ Daily fish limit reached (${DIG_FISH_DAILY_LIMIT}/day). Try again tomorrow.`);
      return;
    }
    const lastFish = user.last_fish || 0;
    const diff = now - lastFish;
    if (diff < FISH_COOLDOWN) {
      await sendText(from, `⏳ Cooldown: ${formatDuration(FISH_COOLDOWN - diff)} left to fish again.`);
      return;
    }
    const catch_ = FISH_CATCHES[Math.floor(Math.random() * FISH_CATCHES.length)];
    const value = Math.min(376, catch_.value);
    updateUser(sender, {
      balance: (user.balance || 0) + value,
      last_fish: now,
      fish_uses: usage.count + 1,
      fish_date: usage.day,
    });
    if (value > 0) addToInventory(sender, catch_.item);
    await sendText(from, `🎣 You fished and caught: *${catch_.item}*!\n${value > 0 ? `+$${formatNumber(value)}` : "Better luck next time..."}\nUses today: ${usage.count + 1}/${DIG_FISH_DAILY_LIMIT}`);
    return;
  }

  if (cmd === "beg") {
    const lastBeg = user.last_beg || 0;
    const diff = now - lastBeg;
    if (diff < BEG_COOLDOWN) {
      await sendText(from, `⏳ Cooldown: ${formatDuration(BEG_COOLDOWN - diff)} left.`);
      return;
    }
    const response = BEG_RESPONSES[Math.floor(Math.random() * BEG_RESPONSES.length)];
    const earned = 10 + Math.floor(Math.random() * 90);
    updateUser(sender, { balance: (user.balance || 0) + earned, last_beg: now });
    await sendText(from, `🙏 ${response}\nYou received *$${formatNumber(earned)}*.`);
    return;
  }

  if (cmd === "roast") {
    const mentioned = ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const roasts = [
      "You're so slow, even your internet runs faster than your brain.",
      "You're the reason they put instructions on shampoo.",
      "If brains were gasoline, you couldn't power a go-kart.",
      "You have the personality of a wet napkin.",
      "I'd roast you harder, but my mom says I can't burn trash.",
    ];
    const target = mentioned ? `@${mentioned.split("@")[0]}` : "you";
    await ctx.sock.sendMessage(from, {
      text: `🔥 ${target}: ${roasts[Math.floor(Math.random() * roasts.length)]}`,
      mentions: mentioned ? [mentioned] : [],
    });
    return;
  }

  if (cmd === "stats") {
    const inv = getInventory(sender);
    const rpg = ensureRpg(sender);
    await sendText(from, `📊 *Stats — @${sender.split("@")[0]}*\n\n` +
      `💰 Wallet: $${formatNumber(user.balance || 0)}\n` +
      `🏦 Bank: $${formatNumber(user.bank || 0)}\n` +
      `💎 Gems: ${user.gems || 0}\n` +
      `🎖️ Level: ${user.level || 1} (${user.xp || 0} XP)\n` +
      `🎒 Items: ${inv.length}\n` +
      `⚔️ Attack: ${rpg?.attack || 20}\n` +
      `🛡️ Defense: ${rpg?.defense || 10}\n` +
      `💨 Speed: ${rpg?.speed || 15}`);
    return;
  }

  if (cmd === "lc" && !args[0]?.startsWith("@")) {
    const borrowed = user.borrowed_cash || 0;
    const lent = user.lent_cash || 0;
    await sendText(from, `💸 *Lend/Borrow Status*\n\nYou lent: $${formatNumber(lent)}\nYou borrowed: $${formatNumber(borrowed)}`);
    return;
  }

  if (cmd === "bc") {
    const borrowed = user.borrowed_cash || 0;
    await sendText(from, `💸 You have borrowed $${formatNumber(borrowed)} total.`);
    return;
  }
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function getDailyUsage(user: any, type: "dig" | "fish", now: number): { day: string; count: number } {
  const day = new Date(now * 1000).toISOString().slice(0, 10);
  const dateKey = `${type}_date`;
  const usesKey = `${type}_uses`;
  return {
    day,
    count: user[dateKey] === day ? Number(user[usesKey] || 0) : 0,
  };
}

function getProfileRole(user: any): string {
  const now = Math.floor(Date.now() / 1000);
  if (user.premium && (!user.premium_expiry || Number(user.premium_expiry) > now)) return "Premium";
  if (user.registered) return "Registered";
  return "Unregistered";
}

function formatProfileDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function buildProfileImage(ctx: CommandContext, targetId: string, user: any, rpg: any, rank: number, role: string): Promise<Buffer> {
  const templatePath = path.resolve(process.cwd(), "../../attached_assets/IMG-20260412-WA0616_1776007528987.jpg");
  const width = 765;
  const height = 850;
  const level = Math.max(1, Number(user.level || 1));
  const xp = Math.max(0, Number(user.xp || 0));
  const xpNeeded = level * 100;
  const progress = Math.max(0, Math.min(1, xp / xpNeeded));
  const name = String(user.name || targetId.split("@")[0]).slice(0, 28);
  const subtitle = `${role} ~ ${rpg?.class || "Warrior"}`;
  const bio = String(user.bio || "").slice(0, 44);
  const avatar = await getProfileAvatar(ctx, targetId);
  const avatarSize = 190;
  const avatarMask = Buffer.from(`<svg width="${avatarSize}" height="${avatarSize}"><circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" fill="#fff"/></svg>`);
  const circularAvatar = await sharp(avatar)
    .resize(avatarSize, avatarSize, { fit: "cover" })
    .composite([{ input: avatarMask, blend: "dest-in" }])
    .png()
    .toBuffer();
  const progressWidth = 342;
  const progressFill = Math.round(progressWidth * progress);
  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        text { font-family: Arial, Helvetica, sans-serif; fill: white; }
        .shadow { paint-order: stroke; stroke: rgba(0,0,0,.72); stroke-width: 5px; stroke-linejoin: round; }
      </style>
      <rect x="0" y="0" width="${width}" height="${height}" fill="rgba(0,0,0,.20)"/>
      <rect x="10" y="28" width="190" height="52" rx="8" fill="rgba(0,0,0,.25)"/>
      <text x="18" y="48" font-size="18" font-weight="700" class="shadow">Wallet: ${formatNumber(Number(user.balance || 0))}</text>
      <text x="18" y="70" font-size="18" font-weight="700" class="shadow">Bank: ${formatNumber(Number(user.bank || 0))}</text>
      <circle cx="382" cy="246" r="101" fill="none" stroke="rgba(0,0,0,.85)" stroke-width="6"/>
      <rect x="185" y="365" width="395" height="210" rx="28" fill="rgba(0,0,0,.26)"/>
      <text x="382" y="407" text-anchor="middle" font-size="34" font-weight="800" class="shadow">${escapeXml(name)}</text>
      <text x="382" y="448" text-anchor="middle" font-size="28" font-style="normal" class="shadow">${escapeXml(subtitle)}</text>
      <text x="382" y="493" text-anchor="middle" font-size="27" class="shadow">Rank #${rank}   Level ${level}</text>
      <rect x="211" y="520" width="${progressWidth}" height="27" rx="13" fill="#555" stroke="rgba(0,0,0,.85)" stroke-width="2"/>
      <rect x="211" y="520" width="${progressFill}" height="27" rx="13" fill="#7252ff"/>
      <text x="382" y="540" text-anchor="middle" font-size="17" font-weight="700" class="shadow">${xp}/${xpNeeded} XP</text>
      ${bio ? `<text x="382" y="590" text-anchor="middle" font-size="21" class="shadow">${escapeXml(bio)}</text>` : ""}
      <text x="382" y="826" text-anchor="middle" font-size="28" font-weight="800" font-style="italic" fill="rgba(255,255,255,.88)" class="shadow">SHADOW GARDEN</text>
    </svg>
  `);
  return sharp(templatePath)
    .resize(width, height, { fit: "cover" })
    .composite([
      { input: circularAvatar, left: 287, top: 146 },
      { input: overlay, left: 0, top: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function getProfileAvatar(ctx: CommandContext, targetId: string): Promise<Buffer> {
  try {
    const url = await (ctx.sock as any).profilePictureUrl(targetId, "image");
    if (url) {
      const res = await fetch(url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    }
  } catch {}
  return sharp({
    create: {
      width: 300,
      height: 300,
      channels: 4,
      background: "#161622",
    },
  })
    .composite([{
      input: Buffer.from(`<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="300" fill="#151527"/><text x="150" y="176" text-anchor="middle" font-size="92" font-family="Arial" font-weight="700" fill="#ffffff">${escapeXml(targetId[0]?.toUpperCase() || "U")}</text></svg>`),
      left: 0,
      top: 0,
    }])
    .png()
    .toBuffer();
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
