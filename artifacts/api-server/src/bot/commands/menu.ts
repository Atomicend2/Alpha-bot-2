import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";
import { getSocket } from "../connection.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function handleMenu(ctx: CommandContext): Promise<void> {
  const { from, sender, sock } = ctx;
  const senderName = sender.split("@")[0];

  const menuText = `┌─⟡ 『 𝗦𝗛𝗔𝗗𝗢𝗪 𝗚𝗔𝗥𝗗𝗘𝗡 』⟡
║
║ ┌────────────────────
║ ║ 👋 𝗛𝗲𝘆    : @${senderName}
║ ║ 👾 𝗕𝗼𝘁     : Alpha
║ ║ 👑 𝗖𝗿𝗲𝗮𝘁𝗼𝗿 : Ryuk
║ ║ 🔹 𝗣𝗿𝗲𝗳𝗶𝘅  : [ . ]
║ └────────────────────
║
╠─⟡ 📋 𝗠𝗔𝗜𝗡
║ ┌────────────────────
║ ║ ➩ .menu
║ ║ ➩ .ping
║ ║ ➩ .afk
║ ║ ➩ .help
║ ║ ➩ .info
║ ║ ➩ .uptime
║ └────────────────────
║
╠─⟡ ⚙️ 𝗔𝗗𝗠𝗜𝗡
║ ┌────────────────────
║ ║ ➩ .kick | .delete
║ ║ ➩ .antilink [on/off]
║ ║ ➩ .warn @user [reason]
║ ║ ➩ .resetwarn | .groupstats
║ ║ ➩ .welcome on/off | .leave on/off
║ ║ ➩ .promote | .demote
║ ║ ➩ .mute | .unmute | .open | .close
║ ║ ➩ .tagall | .hidetag [msg]
║ ║ ➩ .active | .inactive | .activity
║ ║ ➩ .blacklist add/remove/list
║ └────────────────────
║
╠─⟡ 💰 𝗘𝗖𝗢𝗡𝗢𝗠𝗬
║ ┌────────────────────
║ ║ ➩ .bal | .daily | .work
║ ║ ➩ .dig | .fish | .beg
║ ║ ➩ .dep | .wid | .donate
║ ║ ➩ .shop | .buy | .sell | .use
║ ║ ➩ .inventory | .profile
║ ║ ➩ .register | .leaderboard
║ ║ ➩ .richlist | .richlg
║ └────────────────────
║
╠─⟡ 🎴 𝗖𝗔𝗥𝗗𝗦
║ ┌────────────────────
║ ║ ➩ .collection | .deck
║ ║ ➩ .get [id] | .card [#]
║ ║ ➩ .cardinfo [name] [tier]
║ ║ ➩ .ctd [card #] | .vs @user
║ ║ ➩ .auction | .listauc | .myauc
║ ║ ➩ .cg @user [card #] (gift)
║ ║ ➩ .lc @user [card #] (lend)
║ ║ ➩ .lcd | .retrieve
║ ║ ➩ .sellc @user [card #] [price]
║ ║ ➩ .tc [card #] [their #] (trade)
║ ║ ➩ .accept | .decline
║ └────────────────────
║
╠─⟡ 🎮 𝗚𝗔𝗠𝗘𝗦
║ ┌────────────────────
║ ║ ➩ .ttt @user | .c4 @user
║ ║ ➩ .wcg start | .joinwcg | .wcg go
║ ║ ➩ .startbattle @user
║ ║ ➩ .uno | .startuno
║ ║ ➩ .truthordare | .truth | .dare
║ ║ ➩ .stopgame
║ └────────────────────
║
╠─⟡ 🎲 𝗚𝗔𝗠𝗕𝗟𝗘
║ ┌────────────────────
║ ║ ➩ .slots | .dice | .casino
║ ║ ➩ .cf [h/t] [amount]
║ ║ ➩ .roulette [color] [amount]
║ ║ ➩ .horse [1-4] [amount]
║ ║ ➩ .spin [amount]
║ └────────────────────
║
╠─⟡ 👤 𝗜𝗡𝗧𝗘𝗥𝗔𝗖𝗧𝗜𝗢𝗡
║ ┌────────────────────
║ ║ ➩ .hug | .kiss | .slap | .pat
║ ║ ➩ .punch | .kill | .bonk
║ ║ ➩ .wave | .dance | .sad | .laugh
║ └────────────────────
║
╠─⟡ 🎉 𝗙𝗨𝗡
║ ┌────────────────────
║ ║ ➩ .gay | .simp | .match @user
║ ║ ➩ .ship @user | .character
║ ║ ➩ .pov | .joke | .wyr
║ ║ ➩ .truth | .dare | .td
║ └────────────────────
║
╠─⟡ ⚔️ 𝗥𝗣𝗚
║ ┌────────────────────
║ ║ ➩ .rpg | .class [name]
║ ║ ➩ .adventure | .quest
║ ║ ➩ .dungeon | .raid | .heal
║ └────────────────────
║
╠─⟡ 🤖 𝗔𝗜
║ ┌────────────────────
║ ║ ➩ .ai / .gpt [question]
║ ║ ➩ .translate [lang] [text]
║ ║ ➩ .chat on/off
║ └────────────────────
║
╠─⟡ 🏰 𝗚𝗨𝗜𝗟𝗗𝗦
║ ┌────────────────────
║ ║ ➩ .guild create [name] (Lv 20)
║ ║ ➩ .guild join/leave/info/list
║ └────────────────────
║
╠─⟡ ☀️ 𝗦𝗨𝗠𝗠𝗘𝗥
║ ┌────────────────────
║ ║ ➩ .summer | .token check
║ ║ ➩ .token shop | .token buy [#]
║ └────────────────────
║
╚─⟡ 🛡️ 𝑃𝑜𝑤𝑒𝑟 𝑏𝑒𝑙𝑜𝑛𝑔𝑠 𝑡𝑜 𝑡ℎ𝑜𝑠𝑒 𝑤ℎ𝑜 𝑟𝑢𝑙𝑒 𝑡ℎ𝑒 𝑠ℎ𝑎𝑑𝑜𝑤𝑠.`;

  const imagePath = path.join(__dirname, "../menu-image.jpg");

  try {
    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      await sock.sendMessage(from, {
        image: imageBuffer,
        caption: menuText,
        mentions: [sender],
      });
    } else {
      await sock.sendMessage(from, {
        text: menuText,
        mentions: [sender],
      });
    }
  } catch (err) {
    await sock.sendMessage(from, {
      text: menuText,
      mentions: [sender],
    });
  }
}

export async function handleInfo(ctx: CommandContext): Promise<void> {
  const { from, sender, sock } = ctx;
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = Math.floor(uptime % 60);

  const info = `🤖 *Alpha Bot — Shadow Garden*\n\n` +
    `👾 Bot: Alpha\n` +
    `👑 Creator: Ryuk\n` +
    `🔹 Prefix: [ . ]\n` +
    `📡 Status: Online ✅\n` +
    `⏱️ Uptime: ${h}h ${m}m ${s}s\n` +
    `📦 Version: 1.0.0\n` +
    `🛡️ Shadow Garden Bot`;

  await sock.sendMessage(from, { text: info, mentions: [sender] });
}
