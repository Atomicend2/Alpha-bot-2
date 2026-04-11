import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";
import { getUser, ensureUser, updateUser } from "../db/queries.js";
import { formatNumber, coinFlip, rollDice, spin, checkSlotWin, getRouletteColor } from "../utils.js";

export async function handleGambling(ctx: CommandContext): Promise<void> {
  const { from, sender, args, command: cmd } = ctx;
  const user = ensureUser(sender);

  if (cmd === "slots") {
    const amount = parseAmount(args[0], user.balance);
    if (!checkBet(from, user, amount)) return;
    const result = spin();
    const multiplier = checkSlotWin(result);
    let winnings = 0;
    let msg = "";
    if (multiplier > 0) {
      winnings = amount * multiplier;
      msg = `🎰 ${result}\n\n🎉 *JACKPOT!* You won $${formatNumber(winnings)}! (${multiplier}x)`;
    } else if (multiplier === 0) {
      winnings = 0;
      msg = `🎰 ${result}\n\n😐 Two of a kind — break even!`;
    } else {
      winnings = -amount;
      msg = `🎰 ${result}\n\n😭 No match. You lost $${formatNumber(amount)}.`;
    }
    updateUser(sender, { balance: (user.balance || 0) + winnings });
    await sendText(from, msg + `\nBalance: $${formatNumber((user.balance || 0) + winnings)}`);
    return;
  }

  if (cmd === "dice") {
    const amount = parseAmount(args[0], user.balance);
    if (!checkBet(from, user, amount)) return;
    const roll = rollDice();
    const win = roll >= 4;
    const winnings = win ? amount : -amount;
    updateUser(sender, { balance: (user.balance || 0) + winnings });
    await sendText(
      from,
      `🎲 Rolled: *${roll}* ${["⚀","⚁","⚂","⚃","⚄","⚅"][roll-1]}\n` +
      `${win ? `🎉 Win! +$${formatNumber(amount)}` : `😭 Lose. -$${formatNumber(amount)}`}\n` +
      `Balance: $${formatNumber((user.balance || 0) + winnings)}`
    );
    return;
  }

  if (cmd === "coinflip" || cmd === "cf") {
    const choice = args[0]?.toLowerCase();
    const amount = parseAmount(args[1] || args[0], user.balance);
    if (!choice || !["h","t","heads","tails"].includes(choice)) {
      await sendText(from, "❌ Usage: .cf [h/t] [amount]");
      return;
    }
    if (!checkBet(from, user, amount)) return;
    const result = coinFlip();
    const userPick = choice === "h" || choice === "heads" ? "heads" : "tails";
    const win = userPick === result;
    const winnings = win ? amount : -amount;
    updateUser(sender, { balance: (user.balance || 0) + winnings });
    await sendText(
      from,
      `🪙 Flip: *${result}*\n` +
      `${win ? `🎉 Correct! +$${formatNumber(amount)}` : `😭 Wrong. -$${formatNumber(amount)}`}\n` +
      `Balance: $${formatNumber((user.balance || 0) + winnings)}`
    );
    return;
  }

  if (cmd === "casino") {
    const amount = parseAmount(args[0], user.balance);
    if (!checkBet(from, user, amount)) return;
    const rand = Math.random();
    let winnings = 0;
    let msg = "";
    if (rand < 0.05) {
      winnings = amount * 5;
      msg = `🎰 JACKPOT! You won 5x — $${formatNumber(winnings)}!`;
    } else if (rand < 0.3) {
      winnings = amount * 2;
      msg = `🎰 Big win! You won 2x — $${formatNumber(winnings)}!`;
    } else if (rand < 0.5) {
      winnings = Math.floor(amount * 0.5);
      msg = `🎰 Small win. You won $${formatNumber(winnings)}.`;
    } else {
      winnings = -amount;
      msg = `🎰 House wins. You lost $${formatNumber(amount)}.`;
    }
    updateUser(sender, { balance: (user.balance || 0) + winnings });
    await sendText(from, msg + `\nBalance: $${formatNumber((user.balance || 0) + winnings)}`);
    return;
  }

  if (cmd === "doublebet" || cmd === "db") {
    const amount = parseAmount(args[0], user.balance);
    if (!checkBet(from, user, amount)) return;
    const win = Math.random() < 0.45;
    const winnings = win ? amount * 2 : -amount;
    updateUser(sender, { balance: (user.balance || 0) + winnings });
    await sendText(
      from,
      win ? `🎲 You doubled! +$${formatNumber(amount * 2)}` : `😭 Lost. -$${formatNumber(amount)}`,
      );
    return;
  }

  if (cmd === "doublepayout" || cmd === "dp") {
    const amount = parseAmount(args[0], user.balance);
    if (!checkBet(from, user, amount)) return;
    const win = Math.random() < 0.4;
    const payout = win ? amount * 3 : -amount;
    updateUser(sender, { balance: (user.balance || 0) + payout });
    await sendText(
      from,
      win ? `🎰 Triple payout! +$${formatNumber(amount * 3)}` : `😭 Lost. -$${formatNumber(amount)}`
    );
    return;
  }

  if (cmd === "roulette") {
    const color = args[0]?.toLowerCase();
    const amount = parseAmount(args[1], user.balance);
    if (!["red","black","green"].includes(color)) {
      await sendText(from, "❌ Usage: .roulette [red/black/green] [amount]");
      return;
    }
    if (!checkBet(from, user, amount)) return;
    const num = Math.floor(Math.random() * 37);
    const result = getRouletteColor(num);
    const win = result === color;
    const multiplier = color === "green" ? 14 : 2;
    const winnings = win ? amount * multiplier : -amount;
    updateUser(sender, { balance: (user.balance || 0) + winnings });
    await sendText(
      from,
      `🎡 Ball landed on *${num}* (${result})\n` +
      `${win ? `🎉 You picked ${color} — win! +$${formatNumber(amount * multiplier)}` : `😭 You picked ${color} — lose. -$${formatNumber(amount)}`}\n` +
      `Balance: $${formatNumber((user.balance || 0) + winnings)}`
    );
    return;
  }

  if (cmd === "horse") {
    const pick = parseInt(args[0]);
    const amount = parseAmount(args[1], user.balance);
    if (isNaN(pick) || pick < 1 || pick > 4) {
      await sendText(from, "❌ Usage: .horse [1-4] [amount]");
      return;
    }
    if (!checkBet(from, user, amount)) return;
    const winner = Math.ceil(Math.random() * 4);
    const win = pick === winner;
    const winnings = win ? amount * 4 : -amount;
    const horses = ["🐴", "🐎", "🏇", "🦄"];
    updateUser(sender, { balance: (user.balance || 0) + winnings });
    await sendText(
      from,
      `🏇 Race Results: ${horses.map((h, i) => `${h}${i === winner - 1 ? "🏆" : ""}`).join(" ")}\n\n` +
      `Winner: Horse #${winner}\n` +
      `${win ? `🎉 Correct! +$${formatNumber(amount * 4)}` : `😭 Wrong. -$${formatNumber(amount)}`}\n` +
      `Balance: $${formatNumber((user.balance || 0) + winnings)}`
    );
    return;
  }

  if (cmd === "spin") {
    const amount = parseAmount(args[0], user.balance);
    if (!checkBet(from, user, amount)) return;
    const outcomes = [
      { label: "💰 2x", multi: 2, chance: 0.2 },
      { label: "💸 1.5x", multi: 1.5, chance: 0.25 },
      { label: "❌ 0x", multi: 0, chance: 0.35 },
      { label: "💥 3x", multi: 3, chance: 0.1 },
      { label: "☠️ -0.5x", multi: -0.5, chance: 0.1 },
    ];
    let rand = Math.random();
    let outcome = outcomes[outcomes.length - 1];
    for (const o of outcomes) {
      if (rand < o.chance) { outcome = o; break; }
      rand -= o.chance;
    }
    const won = Math.floor(amount * outcome.multi);
    const diff = won - amount;
    updateUser(sender, { balance: (user.balance || 0) + diff });
    await sendText(
      from,
      `🌀 Spin result: *${outcome.label}*\n` +
      `${diff >= 0 ? `+$${formatNumber(diff)}` : `-$${formatNumber(-diff)}`}\n` +
      `Balance: $${formatNumber((user.balance || 0) + diff)}`
    );
    return;
  }
}

function parseAmount(val: string | undefined, balance: number): number {
  if (!val) return 100;
  if (val === "all") return balance;
  if (val === "half") return Math.floor(balance / 2);
  const n = parseInt(val);
  return isNaN(n) ? 100 : n;
}

function checkBet(from: string, user: any, amount: number): boolean {
  if (amount <= 0) {
    sendText(from, "❌ Bet amount must be positive.");
    return false;
  }
  if (amount > (user.balance || 0)) {
    sendText(from, `❌ Not enough money. You have $${formatNumber(user.balance || 0)}.`);
    return false;
  }
  return true;
}
