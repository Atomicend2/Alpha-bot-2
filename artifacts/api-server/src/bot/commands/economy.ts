import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";
import {
  getUser, ensureUser, updateUser, getInventory, addToInventory, removeFromInventory,
  getShop, getShopItem, getRichList, ensureRpg,
} from "../db/queries.js";
import { formatNumber, timeAgo } from "../utils.js";

const DAILY_AMOUNT = 1000;
const DAILY_COOLDOWN = 86400;
const WORK_COOLDOWN = 3600;
const DIG_COOLDOWN = 1800;
const FISH_COOLDOWN = 1800;
const BEG_COOLDOWN = 300;

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
  { item: "Buried Treasure", value: 1000 },
  { item: "Old Ring", value: 150 },
  { item: "Gem Fragment", value: 500 },
  { item: "Nothing", value: 0 },
  { item: "Worm", value: 10 },
];

const FISH_CATCHES = [
  { item: "Common Fish", value: 50 },
  { item: "Rare Fish", value: 200 },
  { item: "Legendary Fish", value: 1000 },
  { item: "Boot", value: 5 },
  { item: "Trash Bag", value: 1 },
  { item: "Pearl", value: 500 },
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
    const cooldowns = [
      ["Daily", DAILY_COOLDOWN, user.last_daily || 0],
      ["Work", WORK_COOLDOWN, user.last_work || 0],
      ["Dig", DIG_COOLDOWN, user.last_dig || 0],
      ["Fish", FISH_COOLDOWN, user.last_fish || 0],
      ["Beg", BEG_COOLDOWN, user.last_beg || 0],
    ];
    let text = `╔═ ❰ ⏳ 𝗖𝗢𝗢𝗟𝗗𝗢𝗪𝗡𝗦 ❱ ═╗\n║ @${sender.split("@")[0]}\n║\n`;
    for (const [name, cooldown, last] of cooldowns) {
      const remaining = Math.max(0, Number(cooldown) - (now - Number(last)));
      text += `║ ➩ ${name}: ${remaining > 0 ? formatDuration(remaining) : "Ready"}\n`;
    }
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
    const target = ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      ? ensureUser(ctx.msg.message.extendedTextMessage.contextInfo.mentionedJid[0])
      : user;
    const targetId = ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || sender;
    const rpg = ensureRpg(targetId);

    const text = `👤 *Profile — ${target.name || `@${targetId.split("@")[0]}`}*\n\n` +
      `💰 Wallet: $${formatNumber(target.balance || 0)}\n` +
      `🏦 Bank: $${formatNumber(target.bank || 0)}\n` +
      `💎 Gems: ${target.gems || 0}\n` +
      `🎖️ Level: ${target.level || 1}\n` +
      `✨ XP: ${target.xp || 0}\n` +
      `⭐ Premium: ${target.premium ? "Yes" : "No"}\n` +
      `⚔️ RPG Class: ${rpg?.class || "Warrior"}\n` +
      `❤️ HP: ${rpg?.hp || 100}/${rpg?.max_hp || 100}\n` +
      `📝 Bio: ${target.bio || "(none)"}\n` +
      `🎂 Age: ${target.age || "(not set)"}`;

    await ctx.sock.sendMessage(from, { text, mentions: [targetId] });
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
    const lastDig = user.last_dig || 0;
    const diff = now - lastDig;
    if (diff < DIG_COOLDOWN) {
      await sendText(from, `⏳ Cooldown: ${formatDuration(DIG_COOLDOWN - diff)} left to dig again.`);
      return;
    }
    const find = DIG_FINDS[Math.floor(Math.random() * DIG_FINDS.length)];
    updateUser(sender, {
      balance: (user.balance || 0) + find.value,
      last_dig: now,
    });
    if (find.value > 0) addToInventory(sender, find.item);
    await sendText(from, `⛏️ You dug and found: *${find.item}*!\n${find.value > 0 ? `+$${formatNumber(find.value)}` : "Nothing of value..."}`);
    return;
  }

  if (cmd === "fish") {
    const lastFish = user.last_fish || 0;
    const diff = now - lastFish;
    if (diff < FISH_COOLDOWN) {
      await sendText(from, `⏳ Cooldown: ${formatDuration(FISH_COOLDOWN - diff)} left to fish again.`);
      return;
    }
    const catch_ = FISH_CATCHES[Math.floor(Math.random() * FISH_CATCHES.length)];
    updateUser(sender, {
      balance: (user.balance || 0) + catch_.value,
      last_fish: now,
    });
    if (catch_.value > 0) addToInventory(sender, catch_.item);
    await sendText(from, `🎣 You fished and caught: *${catch_.item}*!\n${catch_.value > 0 ? `+$${formatNumber(catch_.value)}` : "Better luck next time..."}`);
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
