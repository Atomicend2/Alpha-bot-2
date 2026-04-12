import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";
import { ensureRpg, updateRpg, addToInventory, getUser, updateUser } from "../db/queries.js";
import { formatNumber } from "../utils.js";

const CLASSES = ["Warrior", "Mage", "Archer", "Rogue", "Paladin", "Assassin"];
const CLASS_STATS: Record<string, { hp: number; attack: number; defense: number; speed: number }> = {
  Warrior: { hp: 150, attack: 25, defense: 20, speed: 10 },
  Mage: { hp: 80, attack: 40, defense: 8, speed: 18 },
  Archer: { hp: 100, attack: 35, defense: 12, speed: 22 },
  Rogue: { hp: 90, attack: 38, defense: 10, speed: 28 },
  Paladin: { hp: 140, attack: 22, defense: 28, speed: 8 },
  Assassin: { hp: 85, attack: 45, defense: 7, speed: 30 },
};

const ADVENTURES = [
  { name: "Forest Quest", enemy: "Goblin", reward: 300, difficulty: 1 },
  { name: "Mountain Climb", enemy: "Troll", reward: 600, difficulty: 2 },
  { name: "Dark Cave", enemy: "Dragon", reward: 1500, difficulty: 3 },
  { name: "Castle Siege", enemy: "Dark Knight", reward: 3000, difficulty: 4 },
  { name: "Shadow Realm", enemy: "Demon Lord", reward: 8000, difficulty: 5 },
];

const QUESTS = [
  { name: "Slay 5 slimes", reward: 200, xp: 50 },
  { name: "Collect 10 herbs", reward: 150, xp: 30 },
  { name: "Rescue a village", reward: 500, xp: 100 },
  { name: "Defeat the bandit boss", reward: 800, xp: 150 },
  { name: "Find the lost artifact", reward: 1200, xp: 200 },
];

const DUNGEON_ENEMIES: Record<number, { name: string; hp: number; attack: number; reward: number }> = {
  1: { name: "Slime King", hp: 50, attack: 10, reward: 200 },
  2: { name: "Skeleton Warrior", hp: 80, attack: 18, reward: 400 },
  3: { name: "Orc Champion", hp: 120, attack: 28, reward: 700 },
  4: { name: "Shadow Beast", hp: 200, attack: 40, reward: 1200 },
  5: { name: "Dark Dragon", hp: 350, attack: 60, reward: 2500 },
};

const DUNGEON_MOVES: Record<string, { label: string; damage: number; incoming: number; reward: number; success: number; note: string }> = {
  attack: { label: "Direct Attack", damage: 1.0, incoming: 1.0, reward: 1.0, success: 0, note: "Balanced strike with normal risk." },
  guard: { label: "Guard Counter", damage: 0.75, incoming: 0.45, reward: 0.85, success: 0.08, note: "Safer move with reduced damage taken." },
  skill: { label: "Class Skill", damage: 1.35, incoming: 1.1, reward: 1.15, success: -0.04, note: "High damage, slightly risky." },
  rush: { label: "Rush", damage: 1.55, incoming: 1.35, reward: 1.25, success: -0.1, note: "Fast and dangerous." },
  sneak: { label: "Sneak Strike", damage: 1.2, incoming: 0.75, reward: 1.1, success: 0.04, note: "Clever attack with better survival odds." },
  loot: { label: "Loot Path", damage: 0.85, incoming: 0.95, reward: 1.5, success: -0.06, note: "Lower damage, bigger coin reward." },
  scout: { label: "Scout", damage: 0.7, incoming: 0.55, reward: 0.8, success: 0.14, note: "Safe information-gathering route." },
  heal: { label: "Drain Heal", damage: 0.9, incoming: 0.8, reward: 0.9, success: 0.06, note: "Recover a little HP if you survive." },
  focus: { label: "Focus", damage: 1.15, incoming: 0.9, reward: 1.05, success: 0.07, note: "Steady technique and cleaner hits." },
  ambush: { label: "Ambush", damage: 1.7, incoming: 1.4, reward: 1.35, success: -0.13, note: "Big reward if the ambush works." },
  retreat: { label: "Tactical Retreat", damage: 0.45, incoming: 0.25, reward: 0.35, success: 0.2, note: "Very safe, very small reward." },
};

export async function handleRpg(ctx: CommandContext): Promise<void> {
  const { from, sender, args, command: cmd } = ctx;
  const rpg = ensureRpg(sender);
  const user = getUser(sender);
  const now = Math.floor(Date.now() / 1000);

  if (cmd === "rpg") {
    await sendText(from, `⚔️ *RPG Status — @${sender.split("@")[0]}*\n\n` +
      `🎭 Class: ${rpg.class}\n` +
      `❤️ HP: ${rpg.hp}/${rpg.max_hp}\n` +
      `⚔️ Attack: ${rpg.attack}\n` +
      `🛡️ Defense: ${rpg.defense}\n` +
      `💨 Speed: ${rpg.speed}\n` +
      `🎖️ Level: ${rpg.level}\n` +
      `✨ XP: ${rpg.xp}\n` +
      `🏰 Dungeon Floor: ${rpg.dungeon_floor}`,
      [sender]
    );
    return;
  }

  if (cmd === "class") {
    const newClass = args[0];
    if (!newClass) {
      await sendText(from, `🎭 *Available Classes:*\n\n${CLASSES.map((c) => {
        const s = CLASS_STATS[c];
        return `• *${c}* — HP:${s.hp} ATK:${s.attack} DEF:${s.defense} SPD:${s.speed}`;
      }).join("\n")}\n\nUsage: .class [name]`);
      return;
    }
    const cls = CLASSES.find((c) => c.toLowerCase() === newClass.toLowerCase());
    if (!cls) { await sendText(from, "❌ Invalid class."); return; }
    const stats = CLASS_STATS[cls];
    updateRpg(sender, { class: cls, hp: stats.hp, max_hp: stats.hp, attack: stats.attack, defense: stats.defense, speed: stats.speed });
    await sendText(from, `✅ Class changed to *${cls}*!\n❤️ HP: ${stats.hp} | ⚔️ ATK: ${stats.attack} | 🛡️ DEF: ${stats.defense} | 💨 SPD: ${stats.speed}`);
    return;
  }

  if (cmd === "adventure") {
    const cooldown = 3600;
    if (now - (rpg.last_adventure || 0) < cooldown) {
      await sendText(from, `⏳ Adventure cooldown: ${formatDuration(cooldown - (now - rpg.last_adventure))} left.`);
      return;
    }
    const adv = ADVENTURES[Math.floor(Math.random() * ADVENTURES.length)];
    const successChance = Math.min(0.9, 0.4 + (rpg.level * 0.1) - (adv.difficulty * 0.1));
    const success = Math.random() < successChance;

    if (success) {
      const reward = adv.reward + Math.floor(Math.random() * adv.reward * 0.5);
      const xp = adv.difficulty * 50;
      updateRpg(sender, { last_adventure: now, xp: rpg.xp + xp });
      updateUser(sender, { balance: (user?.balance || 0) + reward });
      checkLevelUp(sender, rpg.xp + xp, rpg.level);
      await sendText(from, `⚔️ *Adventure: ${adv.name}*\n\nYou battled the *${adv.enemy}* and won!\n+$${formatNumber(reward)} | +${xp} XP`);
    } else {
      const hpLost = Math.floor(rpg.max_hp * 0.3);
      updateRpg(sender, { hp: Math.max(1, rpg.hp - hpLost), last_adventure: now });
      await sendText(from, `❌ *Adventure: ${adv.name}*\n\nThe *${adv.enemy}* was too strong!\n-${hpLost} HP`);
    }
    return;
  }

  if (cmd === "heal") {
    if (rpg.hp >= rpg.max_hp) {
      await sendText(from, "❤️ You're already at full HP!");
      return;
    }
    const cost = 200;
    if (!user || (user.balance || 0) < cost) {
      await sendText(from, `❌ Need $${cost} to heal. Use potions from your inventory instead.`);
      return;
    }
    updateUser(sender, { balance: (user.balance || 0) - cost });
    updateRpg(sender, { hp: rpg.max_hp });
    await sendText(from, `❤️ Healed to full HP (${rpg.max_hp}/${rpg.max_hp}) for $${cost}.`);
    return;
  }

  if (cmd === "quest") {
    const cooldown = 240;
    if (now - (rpg.last_quest || 0) < cooldown) {
      await sendText(from, `⏳ Quest cooldown: ${formatDuration(cooldown - (now - rpg.last_quest))} left.`);
      return;
    }
    const quest = QUESTS[Math.floor(Math.random() * QUESTS.length)];
    const success = Math.random() < 0.7;
    if (success) {
      updateRpg(sender, { last_quest: now, xp: rpg.xp + quest.xp });
      updateUser(sender, { balance: (user?.balance || 0) + quest.reward });
      checkLevelUp(sender, rpg.xp + quest.xp, rpg.level);
      await sendText(from, `📜 *Quest: ${quest.name}*\n\n✅ Quest complete!\n+$${formatNumber(quest.reward)} | +${quest.xp} XP`);
    } else {
      updateRpg(sender, { last_quest: now });
      await sendText(from, `📜 *Quest: ${quest.name}*\n\n❌ Quest failed. Better luck next time!`);
    }
    return;
  }

  if (cmd === "dungeon") {
    const cooldown = 360;
    if (now - (rpg.last_dungeon || 0) < cooldown) {
      await sendText(from, `⏳ Dungeon cooldown: ${formatDuration(cooldown - (now - rpg.last_dungeon))} left.`);
      return;
    }
    const requestedMove = (args[0] || "").toLowerCase();
    const moveKeys = Object.keys(DUNGEON_MOVES);
    const moveKey = DUNGEON_MOVES[requestedMove] ? requestedMove : moveKeys[Math.floor(Math.random() * moveKeys.length)];
    const move = DUNGEON_MOVES[moveKey];
    const floor = rpg.dungeon_floor;
    const enemy = DUNGEON_ENEMIES[Math.min(floor, 5)];
    const playerDmg = Math.max(1, Math.floor((rpg.attack - Math.floor(enemy.attack * 0.3) + Math.floor(Math.random() * 15)) * move.damage));
    const enemyDmg = Math.max(1, Math.floor((enemy.attack - Math.floor(rpg.defense * 0.5) + Math.floor(Math.random() * 10)) * move.incoming));
    const turnsToKill = Math.ceil(enemy.hp / playerDmg);
    const hpLost = enemyDmg * turnsToKill;
    const survivalScore = rpg.hp / Math.max(1, hpLost);
    const successChance = Math.max(0.15, Math.min(0.95, 0.45 + survivalScore * 0.28 + move.success));
    const success = Math.random() < successChance;
    const moveList = moveKeys.map((key) => `║ ${key.padEnd(8)} │ ${DUNGEON_MOVES[key].label}`).join("\n");

    if (success) {
      const newFloor = floor + 1;
      const xp = floor * 80;
      const reward = Math.floor(enemy.reward * move.reward);
      const hpAfter = Math.min(rpg.max_hp, Math.max(1, rpg.hp - Math.floor(hpLost * 0.5) + (moveKey === "heal" ? Math.floor(rpg.max_hp * 0.15) : 0)));
      updateRpg(sender, { dungeon_floor: newFloor, hp: hpAfter, last_dungeon: now, xp: rpg.xp + xp });
      updateUser(sender, { balance: (user?.balance || 0) + reward });
      addToInventory(sender, "Dungeon Key", 1);
      checkLevelUp(sender, rpg.xp + xp, rpg.level);
      await sendText(from, dungeonResult(sender, floor, enemy.name, moveKey, move.label, "✅ Victory", reward, xp, hpAfter, rpg.max_hp, newFloor, move.note, moveList), [sender]);
    } else {
      updateRpg(sender, { hp: 1, last_dungeon: now });
      await sendText(from, dungeonResult(sender, floor, enemy.name, moveKey, move.label, "❌ Defeated", 0, 0, 1, rpg.max_hp, floor, "Barely escaped. Use .heal or a safer move next time.", moveList), [sender]);
    }
    return;
  }

  if (cmd === "raid") {
    const cooldown = 21600;
    if (now - (rpg.last_raid || 0) < cooldown) {
      await sendText(from, `⏳ Raid cooldown: ${formatDuration(cooldown - (now - rpg.last_raid))} left.`);
      return;
    }
    const success = Math.random() < 0.5;
    if (success) {
      const reward = 2000 + Math.floor(Math.random() * 3000);
      const xp = 200;
      updateRpg(sender, { last_raid: now, xp: rpg.xp + xp });
      updateUser(sender, { balance: (user?.balance || 0) + reward });
      checkLevelUp(sender, rpg.xp + xp, rpg.level);
      await sendText(from, `⚔️ *Raid Complete!*\n\nYour party stormed the fortress!\n+$${formatNumber(reward)} | +${xp} XP`);
    } else {
      const hpLost = Math.floor(rpg.max_hp * 0.4);
      updateRpg(sender, { hp: Math.max(1, rpg.hp - hpLost), last_raid: now });
      await sendText(from, `⚔️ *Raid Failed!*\n\nThe enemy was too powerful.\n-${hpLost} HP`);
    }
    return;
  }
}

function checkLevelUp(userId: string, xp: number, currentLevel: number) {
  const xpNeeded = currentLevel * 100;
  if (xp >= xpNeeded) {
    updateRpg(userId, { level: currentLevel + 1, xp: xp - xpNeeded });
  }
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function dungeonResult(
  sender: string,
  floor: number,
  enemy: string,
  moveKey: string,
  moveLabel: string,
  outcome: string,
  reward: number,
  xp: number,
  hp: number,
  maxHp: number,
  nextFloor: number,
  note: string,
  moveList: string
): string {
  return `╔═ ❰ 🏰 𝗗𝗨𝗡𝗚𝗘𝗢𝗡 ❱ ═╗\n` +
    `║ 👤 User     │ @${sender.split("@")[0]}\n` +
    `║ 🧱 Floor    │ ${floor}\n` +
    `║ 👹 Enemy    │ ${enemy}\n` +
    `║ ⚔️ Move     │ ${moveKey} — ${moveLabel}\n` +
    `║ 🎯 Result   │ ${outcome}\n` +
    `║ ❤️ HP       │ ${hp}/${maxHp}\n` +
    `║ 💰 Reward   │ $${formatNumber(reward)}\n` +
    `║ ✨ XP       │ +${xp}\n` +
    `║ 🚪 Next     │ Floor ${nextFloor}\n` +
    `╠═ ❰ 𝗠𝗢𝗩𝗘𝗦 ❱ ═╗\n` +
    `${moveList}\n` +
    `╠═══════════════\n` +
    `║ ${note}\n` +
    `║ Use: .dungeon <move>\n` +
    `╚══════════════╝`;
}
