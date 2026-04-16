import type { CommandContext } from "./index.js";
import { BOT_OWNER_LID, sendText } from "../connection.js";
import {
  getUser, ensureUser, updateUser, getInventory, addToInventory, removeFromInventory,
  getShop, getShopItem, getRichList, ensureRpg, getUserRank, getUserGuild, isBanned, getStaff, isMod,
  getXpLeaderboard, isBot,
} from "../db/queries.js";
import { formatNumber, timeAgo } from "../utils.js";
import sharp from "sharp";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { logger } from "../../lib/logger.js";

const DAILY_AMOUNT = 1000;
const DAILY_COOLDOWN = 86400;
const WORK_COOLDOWN = 3600;
const DIG_COOLDOWN = 120;
const FISH_COOLDOWN = 120;
const BEG_COOLDOWN = 300;
const STEAL_COOLDOWN = 6000;
const DIG_FISH_MIN_REWARD = 180;
const DIG_FISH_MAX_REWARD = 383;

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
  { item: "Ancient Coin" },
  { item: "Rusty Sword" },
  { item: "Buried Treasure" },
  { item: "Old Ring" },
  { item: "Gem Fragment" },
  { item: "Crystal Shard" },
  { item: "Golden Relic" },
];

const FISH_CATCHES = [
  { item: "Common Fish" },
  { item: "Rare Fish" },
  { item: "Legendary Fish" },
  { item: "Golden Koi" },
  { item: "Deep Sea Pearl" },
  { item: "Moonlit Tuna" },
  { item: "Treasure Clam" },
];

const BEG_RESPONSES = [
  "A kind stranger gave you some coins.",
  "Someone took pity on you.",
  "You found some loose change.",
  "A passerby dropped some coins.",
];

const execFileAsync = promisify(execFile);

async function runFfmpeg(args: string[]): Promise<void> {
  await execFileAsync("ffmpeg", ["-loglevel", "error", ...args], { maxBuffer: 10 * 1024 * 1024 });
}

export async function handleEconomy(ctx: CommandContext): Promise<void> {
  const { from, sender, args, command: cmd } = ctx;

  const user = ensureUser(sender);
  const now = Math.floor(Date.now() / 1000);

  if (cmd === "balance" || cmd === "bal") {
    const displayName = user.name || sender.split("@")[0];
    const wallet = user.balance || 0;
    const bank = user.bank || 0;
    const bankMax = user.bank_max || 100000;
    const total = wallet + bank;
    const bankPct = Math.min(100, Math.round((bank / bankMax) * 100));
    await sendText(
      from,
      `💰 𝗔𝗖𝗖𝗢𝗨𝗡𝗧 𝗕𝗔𝗟𝗔𝗡𝗖𝗘 💰\n\n` +
      `╭━✩ 𝐒𝐇𝚫𝐃𝐎𝐖 𝐆𝚫𝐑𝐃𝚵𝐍 ☆━╮\n\n` +
      `🌟 𝗡𝗮𝗺𝗲: ${displayName}\n\n` +
      `🪙 𝗪𝗮𝗹𝗹𝗲𝘁: \`⎾$${formatNumber(wallet)}⏌\`\n\n` +
      `🏦 𝗕𝗮𝗻𝗸:   \`⎾$${formatNumber(bank)} / $${formatNumber(bankMax)}⏌\` (${bankPct}%)\n\n` +
      `🌠  𝗧𝗼𝘁𝗮𝗹: \`⎾$${formatNumber(total)}⏌\`\n\n` +
      `╰━━━━━━━━━━━━━━━━━╯`
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
    const inv = getInventory(sender);
    const hasLuckyCharm = inv.some((i) => i.item.toLowerCase().includes("lucky charm"));
    let amount = DAILY_AMOUNT + (user.premium ? 500 : 0);
    let bonusNote = "";
    if (hasLuckyCharm) {
      amount = Math.floor(amount * 1.5);
      bonusNote = "\n🍀 *Lucky Charm* bonus: +50%!";
    }
    updateUser(sender, { balance: (user.balance || 0) + amount, last_daily: now });
    await sendText(from, `🎁 Daily reward: *$${formatNumber(amount)}*!${bonusNote}\nNew balance: $${formatNumber((user.balance || 0) + amount)}`);
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
    const wallet = user.balance || 0;
    const parsed = parseInt(args[0]);
    const amount = (isNaN(parsed) || !args[0]) ? wallet : parsed;
    if (amount <= 0) {
      await sendText(from, "❌ Your wallet is empty.");
      return;
    }
    if (amount > wallet) {
      await sendText(from, `❌ Not enough in wallet. Wallet: $${formatNumber(wallet)}`);
      return;
    }
    const bankMax = user.bank_max || 100000;
    const currentBank = user.bank || 0;
    const space = bankMax - currentBank;
    if (space <= 0) {
      await sendText(from, `❌ Bank is full! Max: $${formatNumber(bankMax)}.\nBuy a *Bank Note* from *.shop* to expand.`);
      return;
    }
    const depositable = Math.min(amount, space);
    const refund = amount - depositable;
    updateUser(sender, { balance: wallet - depositable - (refund > 0 ? 0 : 0), bank: currentBank + depositable });
    let msg = `✅ Deposited *$${formatNumber(depositable)}* to bank.\nBank: $${formatNumber(currentBank + depositable)} / $${formatNumber(bankMax)}`;
    if (refund > 0) msg += `\n⚠️ Bank full — $${formatNumber(refund)} not deposited. Buy a *Bank Note* to expand.`;
    await sendText(from, msg);
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
    if (isBot(mentioned)) {
      await sendText(from, "❌ Bots are not part of the economy system.");
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
    const rpg = ensureRpg(sender);
    const allCooldowns: Array<{ emoji: string; name: string; cd: number; last: number }> = [
      { emoji: "📅", name: "Daily",       cd: DAILY_COOLDOWN,   last: user.last_daily || 0 },
      { emoji: "💼", name: "Work",        cd: WORK_COOLDOWN,    last: user.last_work || 0 },
      { emoji: "⛏️", name: "Dig",         cd: DIG_COOLDOWN,     last: user.last_dig || 0 },
      { emoji: "🎣", name: "Fish",        cd: FISH_COOLDOWN,    last: user.last_fish || 0 },
      { emoji: "🙏", name: "Beg",         cd: BEG_COOLDOWN,     last: user.last_beg || 0 },
      { emoji: "🎰", name: "Slots",       cd: 300,              last: user.last_slots || 0 },
      { emoji: "🎲", name: "Dice",        cd: 120,              last: user.last_dice || 0 },
      { emoji: "🪙", name: "Coinflip",    cd: 120,              last: user.last_coinflip || 0 },
      { emoji: "🃏", name: "Casino",      cd: 420,              last: user.last_casino || 0 },
      { emoji: "🎯", name: "Doublebet",   cd: 240,              last: user.last_doublebet || 0 },
      { emoji: "💰", name: "Doublepayout",cd: 300,              last: user.last_doublepayout || 0 },
      { emoji: "🎡", name: "Roulette",    cd: 300,              last: user.last_roulette || 0 },
      { emoji: "🏇", name: "Horse",       cd: 240,              last: user.last_horse || 0 },
      { emoji: "🌀", name: "Spin",        cd: 180,              last: user.last_spin || 0 },
      { emoji: "🔫", name: "Steal",       cd: STEAL_COOLDOWN,   last: user.last_steal || 0 },
      { emoji: "🏰", name: "Raid",        cd: 21600,            last: rpg.last_raid || 0 },
      { emoji: "📜", name: "Quest",       cd: 240,              last: rpg.last_quest || 0 },
    ];
    const active = allCooldowns.filter((c) => now - c.last < c.cd);
    let text = `˗ˏˋ★ᯓ 𝗔𝗖𝗧𝗜𝗩𝗘 𝗖𝗢𝗢𝗟𝗗𝗢𝗪𝗡𝗦 ᯓ★ˎˊ˗\n`;
    if (active.length === 0) {
      text += `\n✅ *No active cooldowns!* You're all good to go.\n`;
    } else {
      text += "\n";
      for (const c of active) {
        const rem = c.cd - (now - c.last);
        text += `• \`${c.emoji} ${c.name}\`— \`${formatDuration(rem)}\` left\n`;
      }
    }
    text += `\n> *Wait until cooldown ends to use these commands again or contact mods/guardians for premium (20% cooldown reduction)*`;
    await sendText(from, text);
    return;
  }

  if (cmd === "richlist") {
    const list = getRichList(from.endsWith("@g.us") ? from : undefined, 10);
    const MEDALS = ["🥇", "🥈", "🥉"];
    let text = "╔ ❰ 🏆 Gᴄ Rɪᴄʜʟɪsᴛ ❱ ╗\n║  💰 Tᴏᴘ Mᴇᴍʙᴇʀs\n║\n";
    list.forEach((u, i) => {
      const num = String(i + 1).padStart(2, "0");
      const medal = MEDALS[i];
      const name = u.name || u.id.split("@")[0];
      const prefix = medal ? `${medal} ${num}.` : `${num}.`;
      text += `║ ${prefix} ${name}\n║     └─ 💰 Bᴀʟ: $${formatNumber(u.total)}\n║\n`;
    });
    text += "╚══════════════════╝";
    await ctx.sock.sendMessage(from, { text, mentions: list.map((u) => u.id) });
    return;
  }

  if (cmd === "richlistglobal" || cmd === "richlg") {
    const list = getRichList(undefined, 10);
    const MEDALS = ["🥇", "🥈", "🥉"];
    let text = "╔ ❰ 🏆 Gʟᴏʙᴀʟ Rɪᴄʜʟɪsᴛ ❱ ╗\n║ 🌍 Tᴏᴘ Pʟᴀʏᴇʀs\n║\n";
    list.forEach((u, i) => {
      const num = String(i + 1).padStart(2, "0");
      const medal = MEDALS[i];
      const name = u.name || u.id.split("@")[0];
      const prefix = medal ? `${medal} ${num}.` : `${num}.`;
      text += `║ ${prefix} ${name}\n║     └─ 💰 Bᴀʟ: $${formatNumber(u.total)}\n║\n`;
    });
    text += "╚══════════════════╝";
    await ctx.sock.sendMessage(from, { text, mentions: list.map((u) => u.id) });
    return;
  }

  if (cmd === "register" || cmd === "reg") {
    if (user.registered) {
      await sendText(from, "✅ You're already registered!");
      return;
    }
    updateUser(sender, { registered: 1, balance: (user.balance || 0) + 45000 });
    await sendText(from, `✅ Welcome! You've been registered and received a $45,000 starter bonus!\n\nUse .profile to see your profile.`);
    return;
  }

  if (cmd === "setname") {
    const name = args.join(" ");
    if (!name) {
      await sendText(from, "❌ Usage: .setname <name>\n📃 Requires: *Rename Sheet📃* (buy from .shop for $91,000)\nName must be 2–20 characters.");
      return;
    }
    if (name.length < 2 || name.length > 20) {
      await sendText(from, "❌ Name must be between 2 and 20 characters.");
      return;
    }
    const inv = getInventory(sender);
    const sheet = inv.find((i) => i.item.toLowerCase().includes("rename sheet"));
    if (!sheet) {
      await sendText(from, "❌ You need a *Rename Sheet📃* to change your name.\nBuy one from the *.shop* for $91,000.");
      return;
    }
    removeFromInventory(sender, sheet.item);
    updateUser(sender, { name });
    await sendText(from, `✅ Name changed to: *${name}*\n📃 1 Rename Sheet consumed.`);
    return;
  }

  if (cmd === "setpp" || cmd === "setbg") {
    const media = await getCommandProfileMedia(ctx).catch(() => null);
    if (!media) {
      await sendText(from, `❌ Reply to an image/video/sticker or send media with .${cmd} as the caption.`);
      return;
    }
    const imageKey = cmd === "setpp" ? "profile_picture" : "profile_background";
    const videoKey = cmd === "setpp" ? "profile_picture_video" : "profile_background_video";
    const label = cmd === "setpp" ? "picture" : "background";
    if (media.type === "video") {
      if (!canSetProfileVideo(ctx, user)) {
        await sendText(from, "❌ Only owner, guardians, mods, group mods, and active premium users can set video profile media.");
        return;
      }
      const poster = await getVideoPoster(media.buffer).catch(() => null);
      const resizedPoster = poster
        ? await sharp(poster)
          .resize(cmd === "setpp" ? 640 : 765, cmd === "setpp" ? 640 : 850, { fit: "cover" })
          .jpeg({ quality: 92 })
          .toBuffer()
        : null;
      updateUser(sender, { [videoKey]: media.buffer, [imageKey]: resizedPoster });
      await sendText(from, `✅ Your animated profile ${label} has been updated.`);
      return;
    }
    const resized = await sharp(media.buffer)
      .resize(cmd === "setpp" ? 640 : 765, cmd === "setpp" ? 640 : 850, { fit: "cover" })
      .jpeg({ quality: 92 })
      .toBuffer();
    updateUser(sender, { [imageKey]: resized, [videoKey]: null });
    await sendText(from, `✅ Your profile ${label} has been updated.`);
    return;
  }

  if (cmd === "profile" || cmd === "p") {
    const info = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const targetId = info?.mentionedJid?.[0] || info?.participant || sender;
    const target = ensureUser(targetId);
    const rpg = ensureRpg(targetId);
    const rank = getUserRank(targetId);
    const guild = getUserGuild(targetId);
    const role = getProfileRole(targetId);
    const name = target.name || `@${targetId.split("@")[0]}`;
    const age = target.age || "Not set";
    const bio = target.bio || "No bio set";
    const registered = formatProfileDate(Number(target.created_at || now));
    const daysSinceReg = Math.floor((now - Number(target.created_at || now)) / 86400);
    const hasVideoProfile = Buffer.isBuffer(target.profile_picture_video) || Buffer.isBuffer(target.profile_background_video);
    const animatedProfile = hasVideoProfile
      ? await buildAnimatedProfileGif(ctx, targetId, target, rpg, rank, role).catch(async () => null)
      : null;
    const profileImage = animatedProfile
      ? null
      : await buildProfileImage(ctx, targetId, target, rpg, rank, role).catch(async () => null);

    const text =
      `╭━✦ 𝙋𝙇𝘼𝙔𝙀𝙍 𝙋𝙍𝙊𝙁𝙄𝙇𝙀 ✦━╮\n` +
      `    Welcome to your profile\n\n` +
      `✧ 𝗡𝗮𝗺𝗲: ۶ৎ ${name}\n` +
      `✧ 𝗔𝗴𝗲: ${age}\n` +
      `✧ 𝗕𝗶𝗼: ${bio}\n` +
      `✧ 𝗥𝗲𝗴𝗶𝘀𝘁𝗲𝗿𝗲𝗱: ${registered} (${daysSinceReg}d ago)\n` +
      `✧ 𝗥𝗼𝗹𝗲: ${role}\n` +
      `✧ 𝗚𝘂𝗶𝗹𝗱: ${guild?.name || "None"}\n` +
      `✧ 𝗗𝘂𝗻𝗴𝗲𝗼𝗻: Floor ${rpg.dungeon_floor} · Lv.${rpg.level}\n\n` +
      `✧ 𝗕𝗮𝗻𝗻𝗲𝗱: ${isBanned("user", targetId) ? "Yes" : "No"}`;

    if (animatedProfile) {
      await ctx.sock.sendMessage(from, { video: animatedProfile, gifPlayback: true, mimetype: "video/mp4", caption: text, mentions: [targetId] });
    } else if (profileImage) {
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
    if (!age || !/^\d+$/.test(age)) {
      await sendText(from, "❌ Usage: .setage [age] — only numbers are allowed.");
      return;
    }
    const ageNum = parseInt(age, 10);
    if (ageNum < 13 || ageNum > 50) {
      await sendText(from, "❌ Age must be between 13 and 50.");
      return;
    }
    updateUser(sender, { age });
    await sendText(from, `✅ Age set to: ${age}`);
    return;
  }

  const ALL_ITEM_EMOJIS: Record<string, string> = {
    "Health Potion": "🧪",
    "Mana Potion": "💧",
    "Elixir": "⚗️",
    "Mega Elixir": "✨",
    "Sword": "⚔️",
    "Steel Sword": "🗡️",
    "Shadow Blade": "🌑",
    "Shield": "🛡️",
    "Diamond Shield": "🔷",
    "Speed Boots": "👟",
    "Turbo Boots": "🥾",
    "Lucky Charm": "🍀",
    "Dungeon Key": "🗝️",
    "Guild License": "📜",
    "Rename Sheet📃": "📃",
    "Pistol": "🔫",
    "Protection Ward": "🔐",
    "Mystery Box": "🎁",
    "XP Scroll": "⚡",
    "Iron Helmet": "⛑️",
    "Iron Chestplate": "🦺",
    "Iron Sword": "🔪",
    "Shadow Cloak": "🧥",
    "10K Bank Note": "💵",
    "50K Bank Note": "💴",
    "100K Bank Note": "💶",
    "Gem Shard": "💎",
    "Gem Crystal": "🔮",
    "Gem Stone": "🪨",
    "Lottery Ticket": "🎟️",
    "Golden Ticket": "🏅",
  };

  if (cmd === "inventory" || cmd === "inv") {
    const inv = getInventory(sender);
    if (inv.length === 0) {
      await sendText(from, "🎒 Your inventory is empty.");
      return;
    }
    const text = `🎒 *Inventory — @${sender.split("@")[0]}*\n\n` +
      inv.map((i) => `${ALL_ITEM_EMOJIS[i.item] || "📦"} *${i.item}* x${i.quantity}`).join("\n");
    await sendText(from, text);
    return;
  }

  if (cmd === "shop") {
    const CAT_EMOJIS: Record<string, string> = {
      rpg: "⚔️",
      general: "🛍️",
      premium: "👑",
      cards: "🎴",
      passive: "💰",
      lottery: "🎟️",
    };
    const CAT_ORDER = ["general", "rpg", "passive", "lottery", "premium", "cards"];
    const items = getShop();
    const seen = new Set<string>();
    const categories: Record<string, any[]> = {};
    for (const item of items) {
      if (seen.has(item.name)) continue;
      seen.add(item.name);
      if (!categories[item.category]) categories[item.category] = [];
      categories[item.category].push(item);
    }
    const sortedCats = [...CAT_ORDER.filter((c) => categories[c]), ...Object.keys(categories).filter((c) => !CAT_ORDER.includes(c))];
    let text = "┌─⟡ 『 🏪 𝗦𝗛𝗢𝗣 』⟡\n║\n";
    for (const cat of sortedCats) {
      const catItems = categories[cat];
      if (!catItems?.length) continue;
      const catEmoji = CAT_EMOJIS[cat] || "📦";
      text += `╠─⟡ ${catEmoji} *${cat.toUpperCase()}*\n`;
      text += `║ ┌────────────────────\n`;
      for (const item of catItems) {
        const emoji = ALL_ITEM_EMOJIS[item.name] || "•";
        text += `║ ║ ${emoji} *${item.name}* — $${formatNumber(item.price)}\n`;
        if (item.description) text += `║ ║    _${item.description}_\n`;
      }
      text += `║ └────────────────────\n║\n`;
    }
    text += `╚══════════════════╝\n> *.buy [item name]* to purchase · *.use [item name]* to use`;
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
    if (item.effect === "lottery_ticket" || item.effect === "lottery_ticket_gold") {
      const ticketValue = item.effect === "lottery_ticket_gold" ? 3 : 1;
      updateUser(sender, { lottery_tickets: Number(user.lottery_tickets || 0) + ticketValue });
      await sendText(from, `✅ Purchased *${item.name}* for $${formatNumber(item.price)}!\n🎟️ Lottery entries added: ${ticketValue}`);
      return;
    }
    addToInventory(sender, item.name);
    await sendText(from, `✅ Purchased *${item.name}* for $${formatNumber(item.price)}!`);
    return;
  }

  if (cmd === "sell") {
    const itemName = args.join(" ");
    const inv = getInventory(sender);
    const invEntry = inv.find((i) => i.item.toLowerCase() === itemName.toLowerCase());
    if (!invEntry) { await sendText(from, "❌ You don't have that item."); return; }
    const removed = removeFromInventory(sender, invEntry.item);
    if (!removed) { await sendText(from, "❌ Could not remove item."); return; }
    const item = getShopItem(invEntry.item);
    const sellPrice = Math.floor((item?.price || 100) * 0.5);
    updateUser(sender, { balance: (user.balance || 0) + sellPrice });
    await sendText(from, `✅ Sold *${invEntry.item}* for $${formatNumber(sellPrice)}.`);
    return;
  }

  if (cmd === "use") {
    const itemName = args.join(" ");
    const inv = getInventory(sender);
    const entry = inv.find((i) => i.item.toLowerCase() === itemName.toLowerCase());
    if (!entry) { await sendText(from, "❌ You don't have that item. Check *.inv* for your inventory."); return; }

    const item = getShopItem(entry.item);
    if (!item) { await sendText(from, "❌ This item cannot be used directly."); return; }

    const effect = item.effect;

    // Heal effects
    if (effect.startsWith("heal:")) {
      const { updateRpg } = await import("../db/queries.js");
      const rpg = ensureRpg(sender);
      const heal = effect === "heal:full" ? rpg.max_hp : parseInt(effect.split(":")[1]);
      const newHp = Math.min(rpg.hp + heal, rpg.max_hp);
      updateRpg(sender, { hp: newHp });
      removeFromInventory(sender, entry.item);
      await sendText(from, `❤️ Used *${entry.item}*.\nHP restored: +${newHp - rpg.hp} → ${newHp}/${rpg.max_hp}`);
      return;
    }

    // RPG stat boosts
    if (effect.startsWith("attack:") || effect.startsWith("defense:") || effect.startsWith("speed:")) {
      const { updateRpg } = await import("../db/queries.js");
      const rpg = ensureRpg(sender);
      const [stat, valStr] = effect.split(":");
      const val = parseInt(valStr);
      const updated: Record<string, number> = {};
      if (stat === "attack") updated.attack = (rpg.attack || 10) + val;
      if (stat === "defense") updated.defense = (rpg.defense || 5) + val;
      if (stat === "speed") updated.speed = (rpg.speed || 5) + val;
      updateRpg(sender, updated);
      removeFromInventory(sender, entry.item);
      const statName = stat.charAt(0).toUpperCase() + stat.slice(1);
      await sendText(from, `⚔️ Used *${entry.item}*.\n${statName} increased by +${val}!`);
      return;
    }

    // Bank cap expansion
    if (effect.startsWith("bank_cap:")) {
      const increase = parseInt(effect.split(":")[1]);
      const currentMax = user.bank_max || 100000;
      const newMax = currentMax + increase;
      updateUser(sender, { bank_max: newMax });
      removeFromInventory(sender, entry.item);
      await sendText(from, `💰 Used *${entry.item}*.\nBank capacity: $${formatNumber(currentMax)} → *$${formatNumber(newMax)}*!`);
      return;
    }

    // Gem conversion
    if (effect.startsWith("gems:")) {
      const gems = parseInt(effect.split(":")[1]);
      updateUser(sender, { gems: (user.gems || 0) + gems });
      removeFromInventory(sender, entry.item);
      await sendText(from, `💎 Used *${entry.item}*.\n+${gems} gems added! Total: ${(user.gems || 0) + gems} gems`);
      return;
    }

    // XP scroll
    if (effect.startsWith("xp:")) {
      const xpGain = parseInt(effect.split(":")[1]);
      const { addUserXp } = await import("../db/queries.js");
      addUserXp(sender, xpGain);
      removeFromInventory(sender, entry.item);
      await sendText(from, `⚡ Used *${entry.item}*.\n+${xpGain} XP granted!`);
      return;
    }

    // Mystery box
    if (effect === "mystery_box") {
      const roll = Math.random();
      let reward = "";
      if (roll < 0.4) {
        const cash = 500 + Math.floor(Math.random() * 4500);
        updateUser(sender, { balance: (user.balance || 0) + cash });
        reward = `💰 You found *$${formatNumber(cash)}*!`;
      } else if (roll < 0.7) {
        const gems = 5 + Math.floor(Math.random() * 20);
        updateUser(sender, { gems: (user.gems || 0) + gems });
        reward = `💎 You found *${gems} gems*!`;
      } else if (roll < 0.9) {
        addToInventory(sender, "Health Potion");
        reward = `🧪 You found a *Health Potion*!`;
      } else {
        addToInventory(sender, "Gem Shard");
        reward = `💎 You found a *Gem Shard*! Lucky!`;
      }
      removeFromInventory(sender, entry.item);
      await sendText(from, `🎁 *Mystery Box opened!*\n\n${reward}`);
      return;
    }

    // Protection Ward
    if (effect.startsWith("protection:")) {
      const duration = parseInt(effect.split(":")[1]);
      const expiresAt = now + duration;
      updateUser(sender, { protected_until: expiresAt });
      removeFromInventory(sender, entry.item);
      const hours = Math.floor(duration / 3600);
      await sendText(from, `🔐 Used *${entry.item}*.\nYou are protected from theft for *${hours} hours*!`);
      return;
    }

    // Lottery ticket — redirect to .lottery
    if (effect === "lottery_ticket" || effect === "lottery_ticket_gold") {
      await sendText(from, `🎟️ You have *${entry.item}* in your inventory.\nType *.lottery* to enter the draw with it!`);
      return;
    }

    // Items that are passively checked (Pistol, Rename Sheet, Guild License) — don't consume, explain usage
    if (effect === "steal") {
      await sendText(from, `🔫 *Pistol* is a passive tool. Just type *.steal @user* to use it!`);
      return;
    }
    if (effect === "rename") {
      await sendText(from, `📃 *Rename Sheet* is a passive item. Type *.setname [new name]* to use it!`);
      return;
    }
    if (effect === "guild_license") {
      await sendText(from, `📜 *Guild License* is a passive item. Type *.guild create [name]* to use it!`);
      return;
    }
    if (effect === "daily_boost") {
      await sendText(from, `🍀 *Lucky Charm* is a passive item. Keep it in your inventory and your daily rewards will be boosted by 50%%!`);
      return;
    }
    if (effect === "dungeon_key") {
      await sendText(from, `🗝️ *Dungeon Key* unlocks special floors. Type *.dungeon* to use it!`);
      return;
    }
    if (effect.startsWith("dungeon:")) {
      await sendText(from, `⚔️ *${entry.item}* is dungeon equipment. It is applied automatically when you enter the dungeon with *.dungeon*!`);
      return;
    }

    // Fallback
    removeFromInventory(sender, entry.item);
    await sendText(from, `✅ Used *${entry.item}*. Effect applied!`);
    return;
  }

  if (cmd === "leaderboard" || cmd === "lb") {
    const list = getXpLeaderboard(10);
    const MEDALS = ["🥇", "🥈", "🥉"];
    let text = "╔ ❰ 🏆 Xᴘ Lᴇᴀᴅᴇʀʙᴏᴀʀᴅ ❱ ╗\n║  🌟 Tᴏᴘ Pʟᴀʏᴇʀs\n║\n";
    list.forEach((u, i) => {
      const num = String(i + 1).padStart(2, "0");
      const medal = MEDALS[i];
      const name = u.name || u.id.split("@")[0];
      const prefix = medal ? `${medal} ${num}.` : `${num}.`;
      const level = Number(u.level || 1);
      const xp = Number(u.xp || 0);
      const totalXp = getTotalXpScore(level, xp);
      text += `║ ${prefix} ${name}\n║     └─ ⭐ Lᴠ ${level} · ${formatNumber(xp)} / ${formatNumber(level * 100)} XP\n║        Tᴏᴛᴀʟ XP: ${formatNumber(totalXp)}\n║\n`;
    });
    text += "╚══════════════════╝";
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
    const value = randomDigFishReward();
    updateUser(sender, {
      balance: (user.balance || 0) + value,
      last_dig: now,
    });
    addToInventory(sender, find.item);
    await sendText(from, `⛏️ You dug and found: *${find.item}*!\n+$${formatNumber(value)}`);
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
    const value = randomDigFishReward();
    updateUser(sender, {
      balance: (user.balance || 0) + value,
      last_fish: now,
    });
    addToInventory(sender, catch_.item);
    await sendText(from, `🎣 You fished and caught: *${catch_.item}*!\n+$${formatNumber(value)}`);
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

  if (cmd === "steal") {
    const info = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const targetId = info?.mentionedJid?.[0] || info?.participant;
    if (!targetId) {
      await sendText(from, "❌ Usage: .steal @user or reply to their message with .steal");
      return;
    }
    if (targetId === sender) {
      await sendText(from, "❌ You can't steal from yourself.");
      return;
    }
    if (isBot(targetId)) {
      await sendText(from, "❌ Bots are not part of the economy system.");
      return;
    }
    const targetUser = ensureUser(targetId);
    const protectedUntil = targetUser.protected_until || 0;
    if (now < protectedUntil) {
      const remaining = protectedUntil - now;
      await sendText(from, `🔐 @${targetId.split("@")[0]} is protected by a *Protection Ward* for ${formatDuration(remaining)} more.`, [targetId]);
      return;
    }
    const inv = getInventory(sender);
    const pistol = inv.find((i) => i.item.toLowerCase() === "pistol");
    if (!pistol) {
      await sendText(from, "❌ You need a *Pistol* to steal.\nBuy one from the *.shop* for $15,000.");
      return;
    }
    const lastSteal = user.last_steal || 0;
    const diff = now - lastSteal;
    if (diff < STEAL_COOLDOWN) {
      await sendText(from, `⏳ Steal cooldown: ${formatDuration(STEAL_COOLDOWN - diff)} left.`);
      return;
    }
    const target = ensureUser(targetId);
    const targetBal = target.balance || 0;
    if (targetBal <= 0) {
      await sendText(from, `❌ @${targetId.split("@")[0]} has nothing to steal!`, [targetId]);
      return;
    }
    updateUser(sender, { last_steal: now });
    const success = Math.random() < 0.5;
    if (success) {
      const pct = 0.1 + Math.random() * 0.2;
      const stolen = Math.max(1, Math.floor(targetBal * pct));
      updateUser(sender, { balance: (user.balance || 0) + stolen });
      updateUser(targetId, { balance: Math.max(0, targetBal - stolen) });
      await sendText(from,
        `🔫 *Heist Successful!*\n\n` +
        `You robbed @${targetId.split("@")[0]} and got away with *$${formatNumber(stolen)}*!\n` +
        `Your new balance: $${formatNumber((user.balance || 0) + stolen)}`,
        [targetId]
      );
    } else {
      const pct = 0.05 + Math.random() * 0.1;
      const lost = Math.max(1, Math.floor((user.balance || 0) * pct));
      updateUser(sender, { balance: Math.max(0, (user.balance || 0) - lost) });
      await sendText(from,
        `🚓 *Caught Red-Handed!*\n\n` +
        `You failed to rob @${targetId.split("@")[0]} and lost *$${formatNumber(lost)}* in the chaos.\n` +
        `Your new balance: $${formatNumber(Math.max(0, (user.balance || 0) - lost))}`,
        [targetId]
      );
    }
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
    const level = Number(user.level || 1);
    const xp = Number(user.xp || 0);
    const xpNeeded = level * 100;
    const total = Number(user.balance || 0) + Number(user.bank || 0);
    const rank = getUserRank(sender);
    const guild = getUserGuild(sender);
    await sendText(from,
      `╔ ❰ 📊 Sᴛᴀᴛs Pᴀɴᴇʟ ❱ ╗\n` +
      `║  👤 @${sender.split("@")[0]}\n` +
      `║\n` +
      `╠═ ❰ Eᴄᴏɴᴏᴍʏ ❱\n` +
      `║ 💰 Wᴀʟʟᴇᴛ: $${formatNumber(user.balance || 0)}\n` +
      `║ 🏦 Bᴀɴᴋ: $${formatNumber(user.bank || 0)}\n` +
      `║ 💸 Tᴏᴛᴀʟ: $${formatNumber(total)}\n` +
      `║ 💎 Gᴇᴍs: ${formatNumber(user.gems || 0)}\n` +
      `║\n` +
      `╠═ ❰ Pʀᴏɢʀᴇss ❱\n` +
      `║ ⭐ Lᴠ: ${level}  ·  Rᴀɴᴋ #${rank}\n` +
      `║ ✨ XP: ${formatNumber(xp)} / ${formatNumber(xpNeeded)}\n` +
      `║ 🌌 Tᴏᴛᴀʟ XP: ${formatNumber(getTotalXpScore(level, xp))}\n` +
      `║\n` +
      `╠═ ❰ Rᴘɢ ❱\n` +
      `║ ⚔️ Aᴛᴋ: ${rpg?.attack || 20}  🛡️ Dᴇғ: ${rpg?.defense || 10}\n` +
      `║ 💨 Sᴘᴅ: ${rpg?.speed || 15}  ❤️ HP: ${rpg?.hp || 100}/${rpg?.max_hp || 100}\n` +
      `║ 🧬 Cʟᴀss: ${rpg?.class || "Warrior"}\n` +
      `║ 🏰 Gᴜɪʟᴅ: ${guild?.name || "None"}\n` +
      `║\n` +
      `╠═ ❰ Iɴᴠᴇɴᴛᴏʀʏ ❱\n` +
      `║ 🎒 Iᴛᴇᴍ Tʏᴘᴇs: ${inv.length}\n` +
      `║ 🧾 Rᴇɢɪsᴛᴇʀᴇᴅ: ${user.registered ? "Yᴇs" : "Nᴏ"}\n` +
      `╚══════════════════╝`,
      [sender]
    );
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

  if (cmd === "lend") {
    const info = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const mentioned = info?.mentionedJid?.[0] || info?.participant;
    const amount = parseInt(args.find((a) => !a.startsWith("@")) || "");
    if (!mentioned || isNaN(amount) || amount <= 0) {
      await sendText(from, "❌ Usage: .lend @user [amount]\nExample: .lend @friend 500\n\nUse .repay @user [amount] to repay a loan.");
      return;
    }
    if (mentioned === sender) {
      await sendText(from, "❌ You can't lend money to yourself.");
      return;
    }
    if (isBot(mentioned)) {
      await sendText(from, "❌ Bots are not part of the economy system.");
      return;
    }
    const senderBal = user.balance || 0;
    if (amount > senderBal) {
      await sendText(from, `❌ Not enough in wallet. You have $${formatNumber(senderBal)}.`);
      return;
    }
    const target = ensureUser(mentioned);
    updateUser(sender, {
      balance: senderBal - amount,
      lent_cash: (user.lent_cash || 0) + amount,
    });
    updateUser(mentioned, {
      balance: (target.balance || 0) + amount,
      borrowed_cash: (target.borrowed_cash || 0) + amount,
    });
    await sendText(from,
      `🤝 *Cash Lent!*\n\n` +
      `@${sender.split("@")[0]} lent *$${formatNumber(amount)}* to @${mentioned.split("@")[0]}.\n\n` +
      `💼 Your wallet: $${formatNumber(senderBal - amount)}\n` +
      `📋 Total lent by you: $${formatNumber((user.lent_cash || 0) + amount)}\n\n` +
      `_@${mentioned.split("@")[0]}: use .repay @${sender.split("@")[0]} ${amount} to pay back!_`,
      [sender, mentioned]
    );
    return;
  }

  if (cmd === "repay") {
    const info = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const mentioned = info?.mentionedJid?.[0] || info?.participant;
    const amount = parseInt(args.find((a) => !a.startsWith("@")) || "");
    if (!mentioned || isNaN(amount) || amount <= 0) {
      await sendText(from, "❌ Usage: .repay @user [amount]\nExample: .repay @lender 500");
      return;
    }
    if (mentioned === sender) {
      await sendText(from, "❌ You can't repay yourself.");
      return;
    }
    if (isBot(mentioned)) {
      await sendText(from, "❌ Bots are not part of the economy system.");
      return;
    }
    const senderBal = user.balance || 0;
    const senderBorrowed = user.borrowed_cash || 0;
    if (amount > senderBal) {
      await sendText(from, `❌ Not enough in wallet to repay. You have $${formatNumber(senderBal)}.`);
      return;
    }
    if (senderBorrowed <= 0) {
      await sendText(from, "❌ You have no recorded borrowed cash to repay.");
      return;
    }
    const repayAmount = Math.min(amount, senderBorrowed);
    const target = ensureUser(mentioned);
    updateUser(sender, {
      balance: senderBal - repayAmount,
      borrowed_cash: Math.max(0, senderBorrowed - repayAmount),
    });
    updateUser(mentioned, {
      balance: (target.balance || 0) + repayAmount,
      lent_cash: Math.max(0, (target.lent_cash || 0) - repayAmount),
    });
    const remaining = Math.max(0, senderBorrowed - repayAmount);
    await sendText(from,
      `✅ *Loan Repaid!*\n\n` +
      `@${sender.split("@")[0]} repaid *$${formatNumber(repayAmount)}* to @${mentioned.split("@")[0]}.\n\n` +
      `💼 Your wallet: $${formatNumber(senderBal - repayAmount)}\n` +
      `📋 Remaining debt: $${formatNumber(remaining)}`,
      [sender, mentioned]
    );
    return;
  }
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function randomDigFishReward(): number {
  return DIG_FISH_MIN_REWARD + Math.floor(Math.random() * (DIG_FISH_MAX_REWARD - DIG_FISH_MIN_REWARD + 1));
}

function getTotalXpScore(level: number, xp: number): number {
  let total = Math.max(0, Number(xp || 0));
  for (let lvl = 1; lvl < Math.max(1, Number(level || 1)); lvl++) {
    total += lvl * 100;
  }
  return total;
}

function getProfileRole(userId: string): string {
  const phone = userId.split("@")[0];
  if (phone === BOT_OWNER_LID || userId === `${BOT_OWNER_LID}@s.whatsapp.net` || userId === `${BOT_OWNER_LID}@lid`) {
    return "Owner";
  }
  const staff = getStaff(userId);
  if (staff?.role === "guardian") return "Guardian";
  if (staff?.role === "mod") return "mod";
  return "normal user";
}

function canSetProfileVideo(ctx: CommandContext, user: any): boolean {
  if (ctx.isOwner) return true;
  const staff = getStaff(ctx.sender);
  if (staff?.role === "guardian" || staff?.role === "mod") return true;
  if (ctx.from.endsWith("@g.us") && isMod(ctx.sender, ctx.from)) return true;
  if (!user?.premium) return false;
  const expiry = Number(user.premium_expiry || 0);
  return expiry === 0 || expiry > Math.floor(Date.now() / 1000);
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
  const templatePath = path.resolve(process.cwd(), "../../attached_assets/IMG-20260410-WA0424(1)_1776008329836.jpg");
  const width = 765;
  const height = 850;
  const level = Math.max(1, Number(user.level || 1));
  const xp = Math.max(0, Number(user.xp || 0));
  const xpNeeded = level * 100;
  const progress = Math.max(0, Math.min(1, xp / xpNeeded));
  const name = String(user.name || targetId.split("@")[0]).slice(0, 28);
  const subtitle = `${role} ~ ${rpg?.class || "Warrior"}`;
  const bio = String(user.bio || "").slice(0, 44);
  const avatar = await getProfileAvatar(ctx, targetId, user);
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
  const background = user.profile_background && Buffer.isBuffer(user.profile_background)
    ? user.profile_background
    : templatePath;
  return sharp(background)
    .resize(width, height, { fit: "cover" })
    .composite([
      { input: circularAvatar, left: 287, top: 146 },
      { input: overlay, left: 0, top: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function buildAnimatedProfileGif(ctx: CommandContext, targetId: string, user: any, rpg: any, rank: number, role: string): Promise<Buffer> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `profile-${randomUUID()}-`));
  try {
    const bgFrames = Buffer.isBuffer(user.profile_background_video)
      ? await extractVideoFrames(tmpDir, "bg", user.profile_background_video, "scale=765:850:force_original_aspect_ratio=increase,crop=765:850")
      : [];
    const avatarFrames = Buffer.isBuffer(user.profile_picture_video)
      ? await extractVideoFrames(tmpDir, "avatar", user.profile_picture_video, "scale=640:640:force_original_aspect_ratio=increase,crop=640:640")
      : [];
    const frameCount = Math.max(bgFrames.length, avatarFrames.length, 1);
    const outputPattern = path.join(tmpDir, "profile_%03d.png");
    for (let i = 0; i < frameCount; i++) {
      const frameUser = {
        ...user,
        profile_background: bgFrames.length > 0 ? bgFrames[i % bgFrames.length] : user.profile_background,
        profile_picture: avatarFrames.length > 0 ? avatarFrames[i % avatarFrames.length] : user.profile_picture,
      };
      const frame = await buildProfileImage(ctx, targetId, frameUser, rpg, rank, role);
      await sharp(frame).png().toFile(path.join(tmpDir, `profile_${String(i + 1).padStart(3, "0")}.png`));
    }
    const outPath = path.join(tmpDir, "profile.mp4");
    await runFfmpeg([
      "-y",
      "-framerate", "6",
      "-i", outputPattern,
      "-movflags", "+faststart",
      "-pix_fmt", "yuv420p",
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      outPath,
    ]);
    return await fs.readFile(outPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function extractVideoFrames(tmpDir: string, prefix: string, buffer: Buffer, vf: string): Promise<Buffer[]> {
  const inputPath = path.join(tmpDir, `${prefix}.mp4`);
  const framePattern = path.join(tmpDir, `${prefix}_%03d.jpg`);
  await fs.writeFile(inputPath, buffer);
  await runFfmpeg([
    "-y",
    "-i", inputPath,
    "-vf", `fps=6,${vf}`,
    "-frames:v", "18",
    framePattern,
  ]);
  const entries = (await fs.readdir(tmpDir))
    .filter((name) => name.startsWith(`${prefix}_`) && name.endsWith(".jpg"))
    .sort();
  return Promise.all(entries.map((name) => fs.readFile(path.join(tmpDir, name))));
}

async function getVideoPoster(buffer: Buffer): Promise<Buffer | null> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `poster-${randomUUID()}-`));
  try {
    const inputPath = path.join(tmpDir, "input.mp4");
    const outputPath = path.join(tmpDir, "poster.jpg");
    await fs.writeFile(inputPath, buffer);
    await runFfmpeg(["-y", "-i", inputPath, "-frames:v", "1", outputPath]);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function getProfileAvatar(ctx: CommandContext, targetId: string, user: any): Promise<Buffer> {
  if (user.profile_picture && Buffer.isBuffer(user.profile_picture)) {
    return user.profile_picture;
  }
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

async function getCommandProfileMedia(ctx: CommandContext): Promise<{ buffer: Buffer; type: "image" | "video" } | null> {
  const { from, msg, sock } = ctx;
  const directImage = msg.message?.imageMessage ? msg : null;
  const directVideo = msg.message?.videoMessage ? msg : null;
  const directDocument = msg.message?.documentMessage ? msg : null;
  const context = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = context?.quotedMessage;
  const quotedMedia = quoted?.imageMessage || quoted?.stickerMessage || quoted?.videoMessage || quoted?.documentMessage ? quoted : null;
  const target = directImage || directVideo || directDocument || (quotedMedia ? {
    key: {
      remoteJid: from,
      fromMe: false,
      id: context?.stanzaId || "",
      participant: context?.participant,
    },
    message: quotedMedia,
  } : null);
  if (!target) return null;
  const message = (target as any).message || {};
  const docMime = message.documentMessage?.mimetype || "";
  const type = message.videoMessage || docMime.startsWith("video/") ? "video" : "image";
  if (message.documentMessage && type !== "video") return null;
  const downloaded = await downloadMediaMessage(
    target as any,
    "buffer",
    {},
    { reuploadRequest: (sock as any).updateMediaMessage, logger: logger as any }
  );
  return { buffer: Buffer.isBuffer(downloaded) ? downloaded : Buffer.from(downloaded as any), type };
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
