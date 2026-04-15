import type { CommandContext } from "./index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAllBots } from "../db/queries.js";
import { getDb } from "../db/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getRegisteredBot(sock: any): { name: string; image_data: Buffer | null } | null {
  try {
    const userId = sock?.user?.id || "";
    const phone = userId.split(":")[0].split("@")[0];
    if (!phone) return null;
    const db = getDb();
    const row = db.prepare("SELECT name, image_data FROM bots WHERE phone = ?").get(phone) as any;
    if (!row) return null;
    return {
      name: row.name || null,
      image_data: row.image_data ? (Buffer.isBuffer(row.image_data) ? row.image_data : Buffer.from(row.image_data)) : null,
    };
  } catch {
    return null;
  }
}

export async function handleMenu(ctx: CommandContext): Promise<void> {
  const { from, sender, sock } = ctx;
  const senderName = sender.split("@")[0];
  const registered = getRegisteredBot(sock);
  const botName = registered?.name || sock?.user?.name || "Alpha";

  const menuText = `┌─⟡ 『 𝗦𝗛𝗔𝗗𝗢𝗪 𝗚𝗔𝗥𝗗𝗘𝗡 』⟡
║
║ ┌────────────────────
║ ║ 👋 𝗛𝗲𝘆 : @${senderName}
║ ║ 👾 𝗕𝗼𝘁 : ${botName}
║ ║ 👑 𝗖𝗿𝗲𝗮𝘁𝗼𝗿 : Ryuk
║ ║ 🔹 𝗣𝗿𝗲𝗳𝗶𝘅 : [ . ]
║ └────────────────────
║
╠─⟡ 📋 𝗠𝗔𝗜𝗡
║ ┌────────────────────
║ ║ ➩ .menu
║ ║ ➩ .ping
║ ║ ➩ .bots
║ ║ ➩ .website
║ ║ ➩ .community
║ ║ ➩ .afk
║ ║ ➩ .help
║ ║ ➩ .info
║ ║ ➩ .uptime
║ └────────────────────
║
╠─⟡ ⚙️ 𝗔𝗗𝗠𝗜𝗡
║ ┌────────────────────
║ ║ ➩ .kick
║ ║ ➩ .delete
║ ║ ➩ .antilink
║ ║ ➩ .antilink set [action]
║ ║ ➩ .warn @user [reason]
║ ║ ➩ .resetwarn
║ ║ ➩ .groupinfo / .gi
║ ║ ➩ .welcome on/off
║ ║ ➩ .setwelcome
║ ║ ➩ .leave on/off
║ ║ ➩ .setleave
║ ║ ➩ .promote
║ ║ ➩ .demote
║ ║ ➩ .mute
║ ║ ➩ .unmute
║ ║ ➩ .hidetag
║ ║ ➩ .tagall
║ ║ ➩ .activity
║ ║ ➩ .active
║ ║ ➩ .inactive
║ ║ ➩ .open
║ ║ ➩ .close
║ ║ ➩ .purge [code]
║ ║ ➩ .antism on/off
║ ║ ➩ .blacklist add [word]
║ ║ ➩ .blacklist remove [word]
║ ║ ➩ .blacklist list
║ ║ ➩ .groupstats / .gs
║ └────────────────────
║
╠─⟡ 💰 𝗘𝗖𝗢𝗡𝗢𝗠𝗬
║ ┌────────────────────
║ ║ ➩ .bal / .balance
║ ║ ➩ .gems
║ ║ ➩ .premiumbal / .pbal
║ ║ ➩ .premium / .prem
║ ║ ➩ .membership / .memb
║ ║ ➩ .daily
║ ║ ➩ .withdraw / .wid [amount]
║ ║ ➩ .deposit / .dep [amount]
║ ║ ➩ .donate [amount]
║ ║ ➩ .lottery
║ ║ ➩ .lp (lottery pool)
║ ║ ➩ .richlist
║ ║ ➩ .richlistglobal / .richlg
║ ║ ➩ .register / .reg
║ ║ ➩ .setname <name>
║ ║ ➩ .setpp (reply to image)
║ ║ ➩ .setbg (reply to image)
║ ║ ➩ .profile / .p
║ ║ ➩ .bio [bio]
║ ║ ➩ .setage [age]
║ ║ ➩ .inventory / .inv
║ ║ ➩ .use [item name]
║ ║ ➩ .sell [item name]
║ ║ ➩ .buy [item name]
║ ║ ➩ .shop
║ ║ ➩ .leaderboard / .lb
║ ║ ➩ .work
║ ║ ➩ .dig
║ ║ ➩ .fish
║ ║ ➩ .beg
║ ║ ➩ .roast
║ ║ ➩ .cds
║ ║ ➩ .stats
║ ║ ➩ .lc (lent cash / lend card)
║ ║ ➩ .bc (borrowed cash)
║ └────────────────────
║
╠─⟡ 🎴 𝗖𝗔𝗥𝗗𝗦
║ ┌────────────────────
║ ║ ➩ .collection / .coll
║ ║ ➩ .deck
║ ║ ➩ .sdi (set deck background)
║ ║ ➩ .card [index]
║ ║ ➩ .cardinfo / .ci [name] [tier]
║ ║ ➩ .mycollectionseries / .mycolls
║ ║ ➩ .cardleaderboard / .cardlb
║ ║ ➩ .cardshop
║ ║ ➩ .get [id]
║ ║ ➩ .stardust
║ ║ ➩ .vs @user
║ ║ ➩ .auction [card_id] [price]
║ ║ ➩ .myauc
║ ║ ➩ .listauc
║ ║ ➩ .cg @user [card #] (gift card)
║ ║ ➩ .spawncard
║ ║ ➩ .ctd [card #] (add to deck)
║ ║ ➩ .ctd remove [slot] / .ctd clear
║ ║ ➩ .lc @user [card #] (lend card)
║ ║ ➩ .lcd (lent cards)
║ ║ ➩ .retrieve (get cards back)
║ ║ ➩ .sellc @user [card #] [price]
║ ║ ➩ .tc [card #] [their #] (reply)
║ ║ ➩ .accept / .decline (offers)
║ └────────────────────
║
╠─⟡ 🎮 𝗚𝗔𝗠𝗘𝗦
║ ┌────────────────────
║ ║ ➩ .tictactoe / .ttt @user
║ ║ ➩ .connectfour / .c4 @user
║ ║ ➩ .wcg start / .joinwcg / .wcg go
║ ║ ➩ .wordchain / .wcg (solo)
║ ║ ➩ .startbattle @user
║ ║ ➩ .truthordare / .td
║ ║ ➩ .stopgame
║ └────────────────────
║
╠─⟡ 🃏 𝗨𝗡𝗢
║ ┌────────────────────
║ ║ ➩ .uno
║ ║ ➩ .startuno
║ ║ ➩ .unoplay [number]
║ ║ ➩ .unodraw
║ ║ ➩ .unohand
║ └────────────────────
║
╠─⟡ 🎲 𝗚𝗔𝗠𝗕𝗟𝗘
║ ┌────────────────────
║ ║ ➩ .slots [amount]
║ ║ ➩ .dice [amount]
║ ║ ➩ .casino [amount]
║ ║ ➩ .coinflip / .cf [h/t] [amount]
║ ║ ➩ .doublebet / .db [amount]
║ ║ ➩ .doublepayout / .dp [amount]
║ ║ ➩ .roulette [color] [amount]
║ ║ ➩ .horse [1-4] [amount]
║ ║ ➩ .spin [amount]
║ └────────────────────
║
╠─⟡ 👤 𝗜𝗡𝗧𝗘𝗥𝗔𝗖𝗧𝗜𝗢𝗡
║ ┌────────────────────
║ ║ ➩ .hug @user
║ ║ ➩ .kiss @user
║ ║ ➩ .slap @user
║ ║ ➩ .wave
║ ║ ➩ .pat @user
║ ║ ➩ .dance
║ ║ ➩ .sad
║ ║ ➩ .smile
║ ║ ➩ .laugh
║ ║ ➩ .punch @user
║ ║ ➩ .kill @user
║ ║ ➩ .hit @user
║ ║ ➩ .kidnap @user
║ ║ ➩ .lick @user
║ ║ ➩ .bonk @user
║ ║ ➩ .tickle @user
║ ║ ➩ .shrug
║ └────────────────────
║
╠─⟡ 🎉 𝗙𝗨𝗡
║ ┌────────────────────
║ ║ ➩ .gay
║ ║ ➩ .lesbian
║ ║ ➩ .simp
║ ║ ➩ .match @user
║ ║ ➩ .ship @user
║ ║ ➩ .character
║ ║ ➩ .psize / .pp
║ ║ ➩ .skill
║ ║ ➩ .duality
║ ║ ➩ .gen
║ ║ ➩ .pov
║ ║ ➩ .social
║ ║ ➩ .relation
║ ║ ➩ .wouldyourather / .wyr
║ ║ ➩ .joke
║ ║ ➩ .truth
║ ║ ➩ .dare
║ ║ ➩ .truthordare / .td
║ └────────────────────
║
╠─⟡ ⚔️ 𝗥𝗣𝗚
║ ┌────────────────────
║ ║ ➩ .adventure
║ ║ ➩ .rpg
║ ║ ➩ .dungeon
║ ║ ➩ .heal
║ ║ ➩ .quest
║ ║ ➩ .raid
║ ║ ➩ .class
║ └────────────────────
║
╠─⟡ 🤖 𝗔𝗜
║ ┌────────────────────
║ ║ ➩ .ai / .gpt [question]
║ ║ ➩ .translate / .tt [lang] [text]
║ ║ ➩ .chat on/off
║ └────────────────────
║
╠─⟡ 🔄 𝗖𝗢𝗡𝗩𝗘𝗥𝗧𝗘𝗥
║ ┌────────────────────
║ ║ ➩ .sticker / .s
║ ║ ➩ .take <pack>, <name> (rename sticker)
║ ║ ➩ .toimg / .turnimg
║ ║ ➩ .play <song name>
║ ║ ➩ .speech <text> (reply to img/sticker to add text)
║ ║ ➩ .mood <tag> (upload mood sticker)
║ ║ ➩ .pintimg <query> (9 Pinterest images)
║ └────────────────────
║
╠─⟡ ☀️ 𝗦𝗨𝗠𝗠𝗘𝗥 𝗘𝗩𝗘𝗡𝗧
║ ┌────────────────────
║ ║ ➩ .summer
║ ║ ➩ .token check
║ ║ ➩ .token shop
║ ║ ➩ .token buy [#]
║ ║ ➩ .token top
║ └────────────────────
║
╠─⟡ 🏰 𝗚𝗨𝗜𝗟𝗗𝗦
║ ┌────────────────────
║ ║ ➩ .guild create [name] (Lvl 20)
║ ║ ➩ .guild join [name]
║ ║ ➩ .guild leave
║ ║ ➩ .guild info [name]
║ ║ ➩ .guild list
║ ║ ➩ .guild desc [text] (owner)
║ ║ ➩ .guild kick @user (owner)
║ ║ ➩ .guild disband (owner)
║ └────────────────────
║
╠─⟡ 👑 𝗦𝗧𝗔𝗙𝗙 / 𝗠𝗢𝗗𝗦 / 𝗚𝗨𝗔𝗥𝗗𝗜𝗔𝗡𝗦
║ ┌────────────────────
║ ║ ➩ .addmod @user
║ ║ ➩ .addguardian @user
║ ║ ➩ .recruit @user
║ ║ ➩ .ban <number>
║ ║ ➩ .unban <number>
║ ║ ➩ .ban <gc link>
║ ║ ➩ .unban <gc link>
║ ║ ➩ .banlist
║ ║ ➩ .addpremium @user (owner)
║ ║ ➩ .removepremium @user (owner)
║ ║ ➩ .mods
║ ║ ➩ .cardmakers
║ ║ ➩ .post [message]
║ ║ ➩ .join [link]
║ ║ ➩ .exit
║ ║ ➩ .show all T1/T2/T3/T4/T5/TS/TX
║ ║ ➩ .spawncard (manual card spawn)
║ ║ ➩ .dc (delete card — reply to spawn)
║ ║ ➩ .upload T<tier> <name>. <series>
║ ║ ➩ .ac <amount> <number> (add cash)
║ ║ ➩ .rc <amount> <number> (remove cash)
║ └────────────────────
║
╚─⟡ 🛡️ 𝑃𝑜𝑤𝑒𝑟 𝑏𝑒𝑙𝑜𝑛𝑔𝑠 𝑡𝑜 𝑡ℎ𝑜𝑠𝑒 𝑤ℎ𝑜 𝑟𝑢𝑙𝑒 𝑡ℎ𝑒 𝑠ℎ𝑎𝑑𝑜𝑤𝑠.`;

  const staticImagePath = path.join(__dirname, "menu-image.jpg");

  try {
    const menuImage: Buffer | null =
      registered?.image_data ||
      (fs.existsSync(staticImagePath) ? fs.readFileSync(staticImagePath) : null);

    if (menuImage) {
      await sock.sendMessage(from, {
        image: menuImage,
        caption: menuText,
        mentions: [sender],
      });
    } else {
      await sock.sendMessage(from, {
        text: menuText,
        mentions: [sender],
      });
    }
  } catch {
    await sock.sendMessage(from, {
      text: menuText,
      mentions: [sender],
    });
  }
}

export async function handleInfo(ctx: CommandContext): Promise<void> {
  const { from, sender, sock } = ctx;
  const registered = getRegisteredBot(sock);
  const botName = registered?.name || sock?.user?.name || "Alpha";
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = Math.floor(uptime % 60);

  const info = `🤖 *${botName} — Shadow Garden*\n\n` +
    `👾 Bot: ${botName}\n` +
    `👑 Creator: Ryuk\n` +
    `🔹 Prefix: [ . ]\n` +
    `📡 Status: Online ✅\n` +
    `⏱️ Uptime: ${h}h ${m}m ${s}s\n` +
    `📦 Version: 1.0.0\n` +
    `🛡️ Shadow Garden Bot`;

  await sock.sendMessage(from, { text: info, mentions: [sender] });
}

export { getRegisteredBot };

export async function handleBots(ctx: CommandContext): Promise<void> {
  const { from, sock } = ctx;
  const bots = getAllBots();

  if (bots.length === 0) {
    await sock.sendMessage(from, { text: "🤖 *Shadow Garden Bots*\n\nNo bots registered yet. Use the admin panel at the website to add bots." });
    return;
  }

  const header = `🤖 *Shadow Garden Bots* (${bots.length} registered)\n` +
    `━━━━━━━━━━━━━━━━━━━━\n`;

  for (const bot of bots as any[]) {
    const indicator = bot.status === "online" ? "🟢 Online" : "🔴 Offline";
    const caption = `${header}` +
      `👾 *${bot.name}*\n` +
      `📞 Number: ${bot.phone || "N/A"}\n` +
      `📡 Status: ${indicator}\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    if (bot.image_data) {
      await sock.sendMessage(from, {
        image: Buffer.from(bot.image_data),
        caption,
      });
    } else {
      await sock.sendMessage(from, { text: caption });
    }
  }
}
