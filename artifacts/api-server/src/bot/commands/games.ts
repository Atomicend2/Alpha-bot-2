import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";
import { getDb } from "../db/database.js";
import { ensureUser, updateUser, getUser } from "../db/queries.js";
import { formatNumber, generateId } from "../utils.js";

function createTTTBoard(): string[][] {
  return [
    ["1","2","3"],["4","5","6"],["7","8","9"]
  ];
}

function renderTTT(board: string[][]): string {
  return board.map((row) => row.join(" | ")).join("\n---------\n");
}

function checkTTTWinner(b: string[][]): string | null {
  const lines = [
    [b[0][0],b[0][1],b[0][2]],[b[1][0],b[1][1],b[1][2]],[b[2][0],b[2][1],b[2][2]],
    [b[0][0],b[1][0],b[2][0]],[b[0][1],b[1][1],b[2][1]],[b[0][2],b[1][2],b[2][2]],
    [b[0][0],b[1][1],b[2][2]],[b[0][2],b[1][1],b[2][0]],
  ];
  for (const [a, bb, c] of lines) {
    if (a !== "1" && a !== "2" && a !== "3" && a !== "4" && a !== "5" && a !== "6" && a !== "7" && a !== "8" && a !== "9" && a === bb && bb === c) return a;
  }
  return null;
}

const UNO_COLORS = ["Red","Green","Blue","Yellow"];
const UNO_VALUES = ["0","1","2","3","4","5","6","7","8","9","Skip","Reverse","Draw2"];
const UNO_SPECIALS = ["Wild","Wild Draw4"];

function createUnoDeck(): string[] {
  const deck: string[] = [];
  for (const color of UNO_COLORS) {
    for (const val of UNO_VALUES) {
      deck.push(`${color} ${val}`);
      if (val !== "0") deck.push(`${color} ${val}`);
    }
  }
  for (const s of UNO_SPECIALS) {
    for (let i = 0; i < 4; i++) deck.push(s);
  }
  return shuffleArr(deck);
}

function shuffleArr<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function canPlayUno(card: string, topCard: string): boolean {
  if (card.startsWith("Wild")) return true;
  const [cardColor, cardVal] = card.split(" ");
  const [topColor, topVal] = topCard.split(" ");
  return cardColor === topColor || cardVal === topVal;
}

export async function handleGames(ctx: CommandContext): Promise<void> {
  const { from, sender, args, command: cmd, msg, sock } = ctx;
  const db = getDb();

  if (cmd === "tictactoe" || cmd === "ttt") {
    const challenged = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!challenged) { await sendText(from, "❌ Mention someone to play! Usage: .ttt @user"); return; }
    if (challenged === sender) { await sendText(from, "❌ You can't play against yourself!"); return; }

    const existingGame = db.prepare("SELECT * FROM games WHERE group_id = ? AND type = 'ttt' AND status != 'ended'").get(from);
    if (existingGame) { await sendText(from, "❌ A game is already active. Use .stopgame to stop it."); return; }

    const board = createTTTBoard();
    const gameId = generateId(8);
    db.prepare(`
      INSERT INTO games (id, type, group_id, player1, player2, state, current_turn, status)
      VALUES (?, 'ttt', ?, ?, ?, ?, ?, 'active')
    `).run(gameId, from, sender, challenged, JSON.stringify(board), sender);

    await sock.sendMessage(from, {
      text: `⭕❌ *Tic Tac Toe*\n\n@${sender.split("@")[0]} (❌) vs @${challenged.split("@")[0]} (⭕)\n\n${renderTTT(board)}\n\n@${sender.split("@")[0]}'s turn! Type 1-9 to place.`,
      mentions: [sender, challenged],
    });
    return;
  }

  if (cmd === "connectfour" || cmd === "c4") {
    const challenged = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!challenged) { await sendText(from, "❌ Mention someone to play! Usage: .c4 @user"); return; }
    const board = Array.from({length:6}, () => Array(7).fill("⚫"));
    const gameId = generateId(8);
    db.prepare(`
      INSERT INTO games (id, type, group_id, player1, player2, state, current_turn, status)
      VALUES (?, 'c4', ?, ?, ?, ?, ?, 'active')
    `).run(gameId, from, sender, challenged, JSON.stringify(board), sender);

    const render = board.map((r) => r.join("")).join("\n") + "\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣";
    await sock.sendMessage(from, {
      text: `🔴🟡 *Connect Four*\n\n@${sender.split("@")[0]} (🔴) vs @${challenged.split("@")[0]} (🟡)\n\n${render}\n\n@${sender.split("@")[0]}'s turn! Type 1-7 to drop.`,
      mentions: [sender, challenged],
    });
    return;
  }

  if (cmd === "stopgame") {
    const game = db.prepare("SELECT * FROM games WHERE group_id = ? AND status = 'active'").get(from) as any;
    if (!game) { await sendText(from, "❌ No active game."); return; }
    if (!ctx.isAdmin && !ctx.isOwner && game.player1 !== sender && game.player2 !== sender) {
      await sendText(from, "❌ Only admins or players can stop the game.");
      return;
    }
    db.prepare("UPDATE games SET status = 'ended' WHERE id = ?").run(game.id);
    await sendText(from, "✅ Game stopped.");
    return;
  }

  if (cmd === "truthordare" || cmd === "td") {
    const truths = [
      "What's the most embarrassing thing you've done?",
      "Who was your first crush?",
      "What's a secret you've never told anyone?",
      "What's the most childish thing you still do?",
      "What's your biggest fear?",
    ];
    const dares = [
      "Send a voice note singing a song!",
      "Change your status to something embarrassing for 1 hour!",
      "Send your most embarrassing photo!",
      "Text your crush right now!",
      "Do 10 push-ups and send proof!",
    ];
    const isTruth = Math.random() < 0.5;
    const list = isTruth ? truths : dares;
    const pick = list[Math.floor(Math.random() * list.length)];
    await sendText(from, `${isTruth ? "🤔 *TRUTH*" : "💥 *DARE*"}\n\n${pick}`);
    return;
  }

  if (cmd === "truth") {
    const truths = [
      "What's your biggest regret?","Have you ever lied to your best friend?",
      "What's something you've stolen?","Who do you have a crush on right now?","What's your darkest secret?",
    ];
    await sendText(from, `🤔 *Truth:*\n\n${truths[Math.floor(Math.random() * truths.length)]}`);
    return;
  }

  if (cmd === "dare") {
    const dares = [
      "Send a voice note of yourself saying a nursery rhyme!",
      "Change your profile picture for 1 hour!",
      "Tag 3 people and say something nice!",
      "Do a handstand and send a photo!",
      "Tell a joke right now!",
    ];
    await sendText(from, `💥 *Dare:*\n\n${dares[Math.floor(Math.random() * dares.length)]}`);
    return;
  }

  if (cmd === "uno") {
    const existing = db.prepare("SELECT * FROM uno_games WHERE group_id = ? AND status = 'waiting'").get(from) as any;
    if (existing) {
      const players = JSON.parse(existing.players);
      if (!players.includes(sender)) {
        players.push(sender);
        db.prepare("UPDATE uno_games SET players = ? WHERE id = ?").run(JSON.stringify(players), existing.id);
        await sock.sendMessage(from, {
          text: `🃏 @${sender.split("@")[0]} joined UNO! ${players.length} players. Type .startuno to start.`,
          mentions: [sender],
        });
      } else {
        await sendText(from, "❌ You're already in the game!");
      }
      return;
    }
    const gameId = generateId(8);
    db.prepare(`
      INSERT INTO uno_games (id, group_id, players, deck, discard, status)
      VALUES (?, ?, ?, '[]', '[]', 'waiting')
    `).run(gameId, from, JSON.stringify([sender]));
    await sock.sendMessage(from, {
      text: `🃏 *UNO* started! @${sender.split("@")[0]} joined. Others type *.uno* to join!\nType *.startuno* when ready.`,
      mentions: [sender],
    });
    return;
  }

  if (cmd === "startuno") {
    const game = db.prepare("SELECT * FROM uno_games WHERE group_id = ? AND status = 'waiting'").get(from) as any;
    if (!game) { await sendText(from, "❌ No UNO game waiting. Use .uno to start one."); return; }
    const players: string[] = JSON.parse(game.players);
    if (players.length < 2) { await sendText(from, "❌ Need at least 2 players!"); return; }
    const deck = createUnoDeck();
    const hands: Record<string, string[]> = {};
    for (const p of players) {
      hands[p] = deck.splice(0, 7);
      db.prepare("INSERT OR REPLACE INTO uno_hands (game_id, user_id, cards) VALUES (?, ?, ?)")
        .run(game.id, p, JSON.stringify(hands[p]));
    }
    const topCard = deck.splice(0, 1)[0];
    db.prepare("UPDATE uno_games SET deck = ?, discard = ?, status = 'active' WHERE id = ?")
      .run(JSON.stringify(deck), JSON.stringify([topCard]), game.id);

    const currentPlayer = players[0];
    await sock.sendMessage(from, {
      text: `🃏 *UNO Started!*\n\nPlayers: ${players.map((p) => `@${p.split("@")[0]}`).join(", ")}\nTop card: ${topCard}\n\n@${currentPlayer.split("@")[0]}'s turn! Type *.unohand* to see your cards, *.unoplay [number]* to play, or *.unodraw* to draw.`,
      mentions: players,
    });
    return;
  }

  if (cmd === "unohand") {
    const game = db.prepare("SELECT * FROM uno_games WHERE group_id = ? AND status = 'active'").get(from) as any;
    if (!game) { await sendText(from, "❌ No active UNO game."); return; }
    const hand = db.prepare("SELECT * FROM uno_hands WHERE game_id = ? AND user_id = ?").get(game.id, sender) as any;
    if (!hand) { await sendText(from, "❌ You're not in this game."); return; }
    const cards: string[] = JSON.parse(hand.cards);
    const text = `🃏 *Your UNO Hand* (${cards.length} cards)\n\n${cards.map((c, i) => `${i+1}. ${c}`).join("\n")}\n\nTop card: ${JSON.parse(game.discard).slice(-1)[0]}`;
    try {
      await sock.sendMessage(sender, { text });
      await sendText(from, "📬 Hand sent to your DM!");
    } catch {
      await sendText(from, text);
    }
    return;
  }

  if (cmd === "unoplay") {
    const cardIdx = parseInt(args[0]) - 1;
    const game = db.prepare("SELECT * FROM uno_games WHERE group_id = ? AND status = 'active'").get(from) as any;
    if (!game) { await sendText(from, "❌ No active UNO game."); return; }
    const players: string[] = JSON.parse(game.players);
    const currentPlayer = players[game.current_player];
    if (currentPlayer !== sender) { await sendText(from, "❌ It's not your turn!"); return; }
    const handRow = db.prepare("SELECT * FROM uno_hands WHERE game_id = ? AND user_id = ?").get(game.id, sender) as any;
    const hand: string[] = JSON.parse(handRow.cards);
    if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= hand.length) {
      await sendText(from, `❌ Invalid card number. You have ${hand.length} cards.`);
      return;
    }
    const card = hand[cardIdx];
    const discard: string[] = JSON.parse(game.discard);
    const topCard = discard[discard.length - 1];
    if (!canPlayUno(card, topCard)) {
      await sendText(from, `❌ Can't play *${card}* on *${topCard}*!`);
      return;
    }
    hand.splice(cardIdx, 1);
    discard.push(card);
    db.prepare("UPDATE uno_hands SET cards = ? WHERE game_id = ? AND user_id = ?").run(JSON.stringify(hand), game.id, sender);
    if (hand.length === 0) {
      db.prepare("UPDATE uno_games SET status = 'ended' WHERE id = ?").run(game.id);
      await sock.sendMessage(from, {
        text: `🎉 @${sender.split("@")[0]} played *${card}* and *WON UNO*! 🏆`,
        mentions: [sender],
      });
      return;
    }
    let nextPlayer = (game.current_player + game.direction + players.length) % players.length;
    if (card.includes("Skip")) nextPlayer = (nextPlayer + game.direction + players.length) % players.length;
    if (card.includes("Reverse")) {
      db.prepare("UPDATE uno_games SET direction = ? WHERE id = ?").run(-game.direction, game.id);
      nextPlayer = (game.current_player - game.direction + players.length) % players.length;
    }
    if (card.includes("Draw2")) {
      const nextHand = db.prepare("SELECT * FROM uno_hands WHERE game_id = ? AND user_id = ?").get(game.id, players[nextPlayer]) as any;
      if (nextHand) {
        const deck: string[] = JSON.parse(game.deck);
        const drawn = deck.splice(0, 2);
        const nh: string[] = JSON.parse(nextHand.cards);
        nh.push(...drawn);
        db.prepare("UPDATE uno_hands SET cards = ? WHERE game_id = ? AND user_id = ?").run(JSON.stringify(nh), game.id, players[nextPlayer]);
        db.prepare("UPDATE uno_games SET deck = ? WHERE id = ?").run(JSON.stringify(deck), game.id);
      }
      nextPlayer = (nextPlayer + game.direction + players.length) % players.length;
    }
    db.prepare("UPDATE uno_games SET discard = ?, current_player = ? WHERE id = ?").run(JSON.stringify(discard), nextPlayer, game.id);
    await sock.sendMessage(from, {
      text: `🃏 @${sender.split("@")[0]} played *${card}*!\nTop: ${card}\n\n@${players[nextPlayer].split("@")[0]}'s turn! (${hand.length} cards left for @${sender.split("@")[0]})`,
      mentions: [sender, players[nextPlayer]],
    });
    return;
  }

  if (cmd === "unodraw") {
    const game = db.prepare("SELECT * FROM uno_games WHERE group_id = ? AND status = 'active'").get(from) as any;
    if (!game) { await sendText(from, "❌ No active UNO game."); return; }
    const players: string[] = JSON.parse(game.players);
    if (players[game.current_player] !== sender) { await sendText(from, "❌ Not your turn!"); return; }
    const deck: string[] = JSON.parse(game.deck);
    if (deck.length === 0) { await sendText(from, "❌ Deck is empty!"); return; }
    const drawn = deck.splice(0, 1)[0];
    const handRow = db.prepare("SELECT * FROM uno_hands WHERE game_id = ? AND user_id = ?").get(game.id, sender) as any;
    const hand: string[] = JSON.parse(handRow.cards);
    hand.push(drawn);
    db.prepare("UPDATE uno_hands SET cards = ? WHERE game_id = ? AND user_id = ?").run(JSON.stringify(hand), game.id, sender);
    db.prepare("UPDATE uno_games SET deck = ? WHERE id = ?").run(JSON.stringify(deck), game.id);
    const nextPlayer = (game.current_player + game.direction + players.length) % players.length;
    db.prepare("UPDATE uno_games SET current_player = ? WHERE id = ?").run(nextPlayer, game.id);
    await sock.sendMessage(from, {
      text: `🃏 @${sender.split("@")[0]} drew a card.\n@${players[nextPlayer].split("@")[0]}'s turn!`,
      mentions: [sender, players[nextPlayer]],
    });
    return;
  }

  if (cmd === "wordchain" || cmd === "wcg") {
    const sub = args[0]?.toLowerCase();
    if (sub === "start") {
      const existing = db.prepare("SELECT * FROM word_chain WHERE group_id = ? AND status != 'ended'").get(from) as any;
      if (existing) { await sendText(from, "❌ A word chain game is already active. Use .stopgame"); return; }
      const gameId = generateId(8);
      db.prepare(`INSERT INTO word_chain (id, group_id, players, status) VALUES (?, ?, ?, 'waiting')`).run(gameId, from, JSON.stringify([sender]));
      await sock.sendMessage(from, {
        text: `📝 *Word Chain* started! @${sender.split("@")[0]} joined. Type *.joinwcg* to join, *.wcg go* to begin!`,
        mentions: [sender],
      });
      return;
    }
    if (sub === "go") {
      const game = db.prepare("SELECT * FROM word_chain WHERE group_id = ? AND status = 'waiting'").get(from) as any;
      if (!game) { await sendText(from, "❌ No game waiting."); return; }
      const players: string[] = JSON.parse(game.players);
      const starters = ["apple","banana","cat","dog","elephant","forest","guitar","house","island","jungle"];
      const startWord = starters[Math.floor(Math.random() * starters.length)];
      db.prepare("UPDATE word_chain SET status = 'active', last_word = ?, used_words = ? WHERE id = ?")
        .run(startWord, JSON.stringify([startWord]), game.id);
      await sock.sendMessage(from, {
        text: `📝 *Word Chain Started!*\nPlayers: ${players.map((p) => `@${p.split("@")[0]}`).join(", ")}\n\nFirst word: *${startWord}*\nYour word must start with: *${startWord.slice(-1).toUpperCase()}*\n\n@${players[0].split("@")[0]}'s turn!`,
        mentions: players,
      });
      return;
    }
    await sendText(from, "Usage: .wcg start | .joinwcg | .wcg go | .wordchain (solo word)");
    return;
  }

  if (cmd === "joinwcg") {
    const game = db.prepare("SELECT * FROM word_chain WHERE group_id = ? AND status = 'waiting'").get(from) as any;
    if (!game) { await sendText(from, "❌ No game to join."); return; }
    const players: string[] = JSON.parse(game.players);
    if (players.includes(sender)) { await sendText(from, "❌ You're already in!"); return; }
    players.push(sender);
    db.prepare("UPDATE word_chain SET players = ? WHERE id = ?").run(JSON.stringify(players), game.id);
    await sock.sendMessage(from, {
      text: `✅ @${sender.split("@")[0]} joined Word Chain! (${players.length} players)`,
      mentions: [sender],
    });
    return;
  }

  if (cmd === "startbattle") {
    const challenged = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!challenged) { await sendText(from, "❌ Mention someone to battle!"); return; }
    const { ensureRpg } = await import("../db/queries.js");
    const p1 = ensureRpg(sender);
    const p2 = ensureRpg(challenged);
    const damage = (atk: number, def: number) => Math.max(1, atk - Math.floor(def * 0.5) + Math.floor(Math.random() * 20) - 10);
    let p1hp = p1.hp, p2hp = p2.hp;
    let log = `⚔️ *Battle!*\n@${sender.split("@")[0]} (HP:${p1hp}) vs @${challenged.split("@")[0]} (HP:${p2hp})\n\n`;
    let round = 0;
    while (p1hp > 0 && p2hp > 0 && round < 20) {
      round++;
      const d1 = damage(p1.attack, p2.defense);
      const d2 = damage(p2.attack, p1.defense);
      p2hp -= d1; p1hp -= d2;
      log += `R${round}: @${sender.split("@")[0]} dealt ${d1} dmg | @${challenged.split("@")[0]} dealt ${d2} dmg\n`;
      if (round >= 5) break;
    }
    const winner = p1hp > p2hp ? sender : p2hp > p1hp ? challenged : null;
    log += `\n${winner ? `🏆 @${winner.split("@")[0]} wins!` : "🤝 Draw!"}`;
    await sock.sendMessage(from, { text: log, mentions: [sender, challenged] });
    return;
  }

  if (cmd === "pvp") {
    // .pvp @user [percent]  — stake a % of your balance in an instant battle
    const mentioned =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
      msg.message?.extendedTextMessage?.contextInfo?.participant || null;

    if (!mentioned || mentioned === sender) {
      await sendText(from, "❌ *Usage:* .pvp @user [percent]\n\nMention or reply to an opponent to challenge them. Example: .pvp @user 20");
      return;
    }

    // Parse optional percentage (default 20%)
    const pctArg = args.find((a) => /^\d+$/.test(a));
    const pct = Math.min(Math.max(parseInt(pctArg || "20"), 1), 50); // clamp 1–50%

    const challenger = ensureUser(sender);
    const opponent = ensureUser(mentioned);

    const challengerBal = challenger.balance ?? 0;
    const opponentBal = opponent.balance ?? 0;

    if (challengerBal <= 0) {
      await sendText(from, "❌ You have no Gold to stake!");
      return;
    }
    if (opponentBal <= 0) {
      await sendText(from, `❌ @${mentioned.split("@")[0]} has no Gold to stake!`);
      return;
    }

    const challengerStake = Math.max(1, Math.floor(challengerBal * pct / 100));
    const opponentStake = Math.max(1, Math.floor(opponentBal * pct / 100));

    // RPG stats for battle
    const { ensureRpg } = await import("../db/queries.js");
    const p1 = ensureRpg(sender);
    const p2 = ensureRpg(mentioned);

    const calcDmg = (atk: number, def: number) =>
      Math.max(1, atk - Math.floor(def * 0.5) + Math.floor(Math.random() * 15) - 7);

    let p1hp = p1.hp;
    let p2hp = p2.hp;
    const rounds: string[] = [];
    let roundNum = 0;

    while (p1hp > 0 && p2hp > 0 && roundNum < 10) {
      roundNum++;
      const d1 = calcDmg(p1.attack, p2.defense);
      const d2 = calcDmg(p2.attack, p1.defense);
      p2hp = Math.max(0, p2hp - d1);
      p1hp = Math.max(0, p1hp - d2);
      rounds.push(`R${roundNum}: ⚔️ ${d1} dmg → 🛡️ ${d2} dmg`);
    }

    const draw = p1hp === p2hp;
    const winner = draw ? null : (p1hp > p2hp ? sender : mentioned);
    const loser = draw ? null : (winner === sender ? mentioned : sender);

    const senderTag = `@${sender.split("@")[0]}`;
    const mentionedTag = `@${mentioned.split("@")[0]}`;

    let resultText: string;
    if (draw) {
      resultText = `🤝 *Draw!* No Gold exchanged.`;
    } else {
      const isChallenger = winner === sender;
      const winnerStake = isChallenger ? opponentStake : challengerStake;
      const loserStake = isChallenger ? challengerStake : opponentStake;
      db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(winnerStake, winner!);
      db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(loserStake, loser!);
      const winnerTag = winner === sender ? senderTag : mentionedTag;
      const loserTag = loser === sender ? senderTag : mentionedTag;
      resultText =
        `🏆 *${winnerTag} wins!*\n` +
        `💸 *${loserTag}* loses *${loserStake.toLocaleString()} Gold* (${pct}%)\n` +
        `💰 *${winnerTag}* gains *${winnerStake.toLocaleString()} Gold*`;
    }

    const battleLog =
      `⚔️ *PVP DUEL — SHADOW GARDEN*\n\n` +
      `${senderTag} vs ${mentionedTag}\n` +
      `🎰 Stake: *${pct}%* of each player's balance\n` +
      `💰 ${senderTag}: *${challengerStake.toLocaleString()} Gold*  |  ${mentionedTag}: *${opponentStake.toLocaleString()} Gold*\n\n` +
      `─────────────────\n` +
      rounds.slice(0, 5).join("\n") +
      (rounds.length > 5 ? `\n_...${rounds.length - 5} more rounds..._` : "") +
      `\n─────────────────\n\n` +
      resultText;

    await sock.sendMessage(from, { text: battleLog, mentions: [sender, mentioned] });
    return;
  }
}

export async function handleGameInput(ctx: CommandContext, text: string): Promise<boolean> {
  const { from, sender, sock } = ctx;
  const db = getDb();

  const tttGame = db.prepare("SELECT * FROM games WHERE group_id = ? AND type = 'ttt' AND status = 'active'").get(from) as any;
  if (tttGame) {
    const num = parseInt(text.trim());
    if (!isNaN(num) && num >= 1 && num <= 9 && tttGame.current_turn === sender) {
      const board: string[][] = JSON.parse(tttGame.state);
      const piece = tttGame.player1 === sender ? "❌" : "⭕";
      let placed = false;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (board[r][c] === String(num)) {
            board[r][c] = piece;
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
      if (!placed) return false;
      const winner = checkTTTWinner(board);
      const nextTurn = tttGame.current_turn === tttGame.player1 ? tttGame.player2 : tttGame.player1;
      const flat = board.flat();
      const isDraw = !winner && !flat.some((v) => !["❌","⭕"].includes(v));
      if (winner) {
        db.prepare("UPDATE games SET status = 'ended' WHERE id = ?").run(tttGame.id);
        await sock.sendMessage(from, {
          text: `${renderTTT(board)}\n\n🏆 @${sender.split("@")[0]} wins!`,
          mentions: [sender],
        });
      } else if (isDraw) {
        db.prepare("UPDATE games SET status = 'ended' WHERE id = ?").run(tttGame.id);
        await sendText(from, `${renderTTT(board)}\n\n🤝 It's a draw!`);
      } else {
        db.prepare("UPDATE games SET state = ?, current_turn = ? WHERE id = ?").run(JSON.stringify(board), nextTurn, tttGame.id);
        await sock.sendMessage(from, {
          text: `${renderTTT(board)}\n\n@${nextTurn.split("@")[0]}'s turn!`,
          mentions: [nextTurn],
        });
      }
      return true;
    }
  }

  const wcgGame = db.prepare("SELECT * FROM word_chain WHERE group_id = ? AND status = 'active'").get(from) as any;
  if (wcgGame && /^[a-zA-Z]+$/.test(text.trim())) {
    const word = text.trim().toLowerCase();
    const players: string[] = JSON.parse(wcgGame.players);
    const currentPlayer = players[wcgGame.current_player];
    if (currentPlayer !== sender) return false;
    const lastWord: string = wcgGame.last_word;
    const usedWords: string[] = JSON.parse(wcgGame.used_words);
    if (word[0] !== lastWord.slice(-1).toLowerCase()) return false;
    if (usedWords.includes(word)) {
      await sock.sendMessage(from, {
        text: `❌ @${sender.split("@")[0]} — *${word}* was already used! They're out!`,
        mentions: [sender],
      });
      players.splice(wcgGame.current_player, 1);
      if (players.length <= 1) {
        db.prepare("UPDATE word_chain SET status = 'ended' WHERE id = ?").run(wcgGame.id);
        await sock.sendMessage(from, {
          text: `🏆 @${players[0]?.split("@")[0] || "Nobody"} wins Word Chain!`,
          mentions: players,
        });
        return true;
      }
      db.prepare("UPDATE word_chain SET players = ?, current_player = ? WHERE id = ?")
        .run(JSON.stringify(players), wcgGame.current_player % players.length, wcgGame.id);
      return true;
    }
    usedWords.push(word);
    const nextIdx = (wcgGame.current_player + 1) % players.length;
    db.prepare("UPDATE word_chain SET last_word = ?, used_words = ?, current_player = ? WHERE id = ?")
      .run(word, JSON.stringify(usedWords), nextIdx, wcgGame.id);
    await sock.sendMessage(from, {
      text: `✅ @${sender.split("@")[0]} said *${word}*\nNext: @${players[nextIdx].split("@")[0]} — must start with *${word.slice(-1).toUpperCase()}*`,
      mentions: [sender, players[nextIdx]],
    });
    return true;
  }

  return false;
}
