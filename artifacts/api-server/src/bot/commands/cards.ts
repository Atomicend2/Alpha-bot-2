import type { CommandContext } from "./index.js";
import { sendText, sendImage } from "../connection.js";
import {
  getUserCards, getCard, giveCard, transferCard, lendCard, retrieveCard, getLentCards,
  getUserCard, addAuction, getAuctions, getAuction, closeAuction,
  getDeck, addToDeck, removeFromDeck, clearDeck, getCardLeaderboard,
  getAllCards, ensureUser, getUser, updateUser, createTradeOffer, getPendingTrade,
  updateTradeStatus, createSellOffer, getPendingSellOffer, updateSellOfferStatus,
  getCardOwners, getCardIssueNumber,
} from "../db/queries.js";
import { getTierEmoji, formatNumber, generateId } from "../utils.js";
import sharp from "sharp";

export async function handleCards(ctx: CommandContext): Promise<void> {
  const { from, sender, args, command: cmd, msg, sock } = ctx;

  if (cmd === "collection" || cmd === "coll") {
    const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || sender;
    const cards = getUserCards(target);
    if (cards.length === 0) {
      await sendText(from, `🎴 @${target.split("@")[0]} has no cards yet!`, [target]);
      return;
    }
    let text = `*🎴 Your card collection:*\n\n`;
    cards.slice(0, 30).forEach((c, i) => {
      const tierNum = c.tier.replace(/^T/, "");
      const tierLabel = c.tier.startsWith("T") && !isNaN(Number(tierNum)) ? `Tier ${tierNum}` : c.tier;
      text += `${i + 1}. 🃏 ${c.name} ${tierLabel}\n`;
    });
    if (cards.length > 30) text += `\n_...and ${cards.length - 30} more_`;
    await sock.sendMessage(from, { text, mentions: [target] });
    return;
  }

  if (cmd === "card") {
    const idx = parseInt(args[0]) - 1;
    const cards = getUserCards(sender);
    if (isNaN(idx) || idx < 0 || idx >= cards.length) {
      await sendText(from, `❌ Invalid card index. You have ${cards.length} cards.`);
      return;
    }
    const c = cards[idx];
    const issueNum = getCardIssueNumber(c.user_card_id, c.id);
    const buf = await getCardImageBuffer(c);
    const caption =
      `∘₊✦──────✦₊∘\n` +
      `🎴 𝗖𝗔𝗥𝗗 𝗜𝗡𝗙𝗢\n` +
      `∘₊✦──────✦₊∘\n\n` +
      `𝗡𝗮𝗺𝗲: ${c.name}\n` +
      `𝗖𝗮𝗿𝗱 𝗜𝗗: ${c.id}\n` +
      `𝗗𝗲𝘀𝗰𝗿𝗶𝗽𝘁𝗶𝗼𝗻: ${c.description || c.name}\n` +
      `𝗧𝗶𝗲𝗿: ${c.tier}\n` +
      `𝗜𝘀𝘀𝘂𝗲: #${issueNum}\n\n` +
      `∘₊✦──────✦₊∘`;
    await sendImage(from, buf, caption);
    return;
  }

  if (cmd === "cardinfo" || cmd === "ci") {
    if (args.length === 0) { await sendText(from, "❌ Usage: .ci <card name> [tier]"); return; }

    // Tier map: "1"→"T1" ... "6"→"T6", "s"→"TS", "x"→"TX", "z"→"TZ"
    const tierMap: Record<string, string> = {
      "1": "T1", "2": "T2", "3": "T3", "4": "T4", "5": "T5", "6": "T6",
      "s": "TS", "x": "TX", "z": "TZ",
    };
    const lastArg = args[args.length - 1].toLowerCase();
    let searchTier: string | null = null;
    let nameParts = args;

    if (tierMap[lastArg]) {
      searchTier = tierMap[lastArg];
      nameParts = args.slice(0, -1);
    }

    const searchName = nameParts.join(" ");
    if (!searchName) { await sendText(from, "❌ Usage: .ci <card name> [tier]"); return; }

    const allCards = getAllCards();
    const matches = allCards.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(searchName.toLowerCase());
      const tierMatch = searchTier ? c.tier === searchTier : true;
      return nameMatch && tierMatch;
    });
    if (matches.length === 0) { await sendText(from, "❌ Card not found."); return; }
    if (matches.length === 1) {
      const found = matches[0];
      const owners = getCardOwners(found.id);
      const buf = await getCardImageBuffer(found);
      const ownerMentions: string[] = [];
      let ownersSection = "_⛔ No owners yet_";
      if (owners.length > 0) {
        const shown = owners.slice(0, 10);
        ownersSection = shown.map((o) => {
          ownerMentions.push(o.user_id);
          return `• @${o.user_id.split("@")[0]}`;
        }).join("\n");
        if (owners.length > 10) ownersSection += `\n_...and ${owners.length - 10} more_`;
      }
      const caption =
        `∘₊✦────────✦₊∘\n` +
        `🎴 𝗖𝗔𝗥𝗗 𝗜𝗡𝗙𝗢\n` +
        `∘₊✦────────✦₊∘\n\n` +
        `𝗡𝗮𝗺𝗲: ${found.name}\n` +
        `𝗦𝗲𝗿𝗶𝗲𝘀: ${found.series || "General"}\n` +
        `𝗧𝗶𝗲𝗿: ${found.tier}\n` +
        `𝗧𝗼𝘁𝗮𝗹 𝗢𝘄𝗻𝗲𝗿𝘀: ${owners.length}\n\n` +
        `✦────⋆⋅✧⋅⋆────✦\n` +
        `👥 𝗢𝗪𝗡𝗘𝗥𝗦\n` +
        `✦────⋆⋅✧⋅⋆────✦\n\n` +
        `${ownersSection}\n\n` +
        `∘₊✦────────✦₊∘`;
      await sock.sendMessage(from, { image: buf, caption, mentions: ownerMentions });
    } else {
      // Send each result as a separate image message
      const limit = Math.min(matches.length, 8);
      if (matches.length > 8) {
        await sendText(from, `🔍 Found *${matches.length}* results for "*${searchName}*". Showing the first 8 — be more specific to narrow it down.`);
      }
      for (let i = 0; i < limit; i++) {
        const found = matches[i];
        const owners = getCardOwners(found.id);
        const buf = await getCardImageBuffer(found);
        const ownerMentions: string[] = [];
        let ownersSection = "_⛔ No owners yet_";
        if (owners.length > 0) {
          const shown = owners.slice(0, 5);
          ownersSection = shown.map((o: any) => {
            ownerMentions.push(o.user_id);
            return `• @${o.user_id.split("@")[0]}`;
          }).join("\n");
          if (owners.length > 5) ownersSection += `\n_...and ${owners.length - 5} more_`;
        }
        const caption =
          `∘₊✦────────✦₊∘\n` +
          `🎴 𝗖𝗔𝗥𝗗 𝗜𝗡𝗙𝗢 — Result ${i + 1}/${limit}\n` +
          `∘₊✦────────✦₊∘\n\n` +
          `𝗡𝗮𝗺𝗲: ${found.name}\n` +
          `𝗦𝗲𝗿𝗶𝗲𝘀: ${found.series || "General"}\n` +
          `𝗧𝗶𝗲𝗿: ${found.tier}\n` +
          `𝗧𝗼𝘁𝗮𝗹 𝗢𝘄𝗻𝗲𝗿𝘀: ${owners.length}\n\n` +
          `✦────⋆⋅✧⋅⋆────✦\n` +
          `👥 𝗢𝗪𝗡𝗘𝗥𝗦\n` +
          `✦────⋆⋅✧⋅⋆────✦\n\n` +
          `${ownersSection}\n\n` +
          `∘₊✦────────✦₊∘`;
        await sock.sendMessage(from, { image: buf, caption, mentions: ownerMentions });
      }
    }
    return;
  }

  if (cmd === "mycollectionseries" || cmd === "mycolls") {
    const cards = getUserCards(sender);
    const series: Record<string, number> = {};
    for (const c of cards) {
      series[c.series] = (series[c.series] || 0) + 1;
    }
    const text = `📚 *Your Series Collection*\n\n` +
      Object.entries(series).map(([s, n]) => `• ${s}: ${n} cards`).join("\n") || "No cards yet!";
    await sendText(from, text);
    return;
  }

  if (cmd === "ss") {
    const seriesName = args.join(" ");
    if (!seriesName) { await sendText(from, "❌ Usage: .ss <series name>"); return; }
    const allCards = getAllCards();
    const seriesCards = allCards.filter((c) =>
      (c.series || "General").toLowerCase().includes(seriesName.toLowerCase())
    );
    if (seriesCards.length === 0) {
      await sendText(from, `❌ No cards found for series: *${seriesName}*`);
      return;
    }
    const actualSeries = seriesCards[0].series || "General";
    let text =
      `╭─❰ 🎴 ᴄᴀʀᴅs ʙʏ sᴇʀɪᴇꜱ ❱─╮\n` +
      `│ 📚 sᴇʀɪᴇs: ${actualSeries}\n` +
      `│ 🃏 ᴛᴏᴛᴀʟ ᴄᴀʀᴅs: ${seriesCards.length}\n` +
      `│\n`;
    for (let i = 0; i < seriesCards.length; i++) {
      const c = seriesCards[i];
      text += `├─ 🃏 ${i + 1}. ${c.name}\n`;
      text += `│   ᴛɪᴇʀ: ${c.tier}\n`;
    }
    text += `╰──────────────╯`;
    await sendText(from, text);
    return;
  }

  if (cmd === "sc") {
    const searchName = args.join(" ");
    if (!searchName) { await sendText(from, "❌ Usage: .sc <card name>"); return; }
    const myCards = getUserCards(sender);
    const found = myCards.filter((c) =>
      c.name.toLowerCase().includes(searchName.toLowerCase())
    );
    if (found.length === 0) {
      await sendText(from, `🔎 No cards found matching *"${searchName}"* in your collection.`);
      return;
    }
    let text = `🔎 Search Results for: *"${searchName}"*\n\n`;
    for (let i = 0; i < found.length; i++) {
      const c = found[i];
      text += `🃏 ${i + 1}. ${c.name} (${c.series || "General"})\n`;
      text += `   Tier: ${c.tier}\n`;
      text += `   Index: ${myCards.indexOf(c) + 1}\n\n`;
    }
    text += `Total found: ${found.length} card(s)`;
    await sendText(from, text);
    return;
  }

  if (cmd === "cardleaderboard" || cmd === "cardlb") {
    const lb = getCardLeaderboard(10);
    const MEDALS = ["🥇", "🥈", "🥉"];
    let text = "╔ ❰ 🎴 Cᴀʀᴅ Lᴇᴀᴅᴇʀʙᴏᴀʀᴅ ❱ ╗\n║ 🃏 Tᴏᴘ Cᴏʟʟᴇᴄᴛᴏʀs\n║\n";
    lb.forEach((e, i) => {
      const num = String(i + 1).padStart(2, "0");
      const medal = MEDALS[i];
      const u = getUser(e.user_id);
      const name = u?.name || e.user_id.split("@")[0];
      const prefix = medal ? `${medal} ${num}.` : `${num}.`;
      text += `║ ${prefix} ${name}\n║     └─ 🃏 Cᴀʀᴅs: ${e.card_count}\n║\n`;
    });
    text += "╚══════════════════╝";
    await sock.sendMessage(from, { text, mentions: lb.map((e) => e.user_id) });
    return;
  }

  if (cmd === "cardshop") {
    const cards = getAllCards();
    const tiers: Record<string, any[]> = {};
    for (const c of cards) {
      if (!tiers[c.tier]) tiers[c.tier] = [];
      tiers[c.tier].push(c);
    }
    let text = "🃏 *Card Shop*\n\n";
    for (const [tier, cs] of Object.entries(tiers)) {
      text += `${getTierEmoji(tier)} *${tier}*\n`;
      cs.slice(0, 5).forEach((c) => {
        text += `  • ${c.name} (${c.series}) — ID: \`${c.id}\`\n`;
      });
    }
    text += "\nUse .get [card_id] to claim a spawned card.";
    await sendText(from, text);
    return;
  }

  if (cmd === "stardust") {
    const cards = getUserCards(sender);
    const TIER_DUST: Record<string, number> = {"T1":5,"T2":10,"T3":25,"T4":50,"T5":100,"TS":250,"TX":500};
    const dust = cards.reduce((acc, c) => acc + (TIER_DUST[c.tier] || 5), 0);
    await sendText(from, `✨ Your stardust value: *${dust} SD*\n(Based on ${cards.length} cards)`);
    return;
  }

  if (cmd === "vs") {
    const challenged = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!challenged) { await sendText(from, "❌ Mention someone to VS."); return; }
    const myDeck = getDeck(sender);
    const theirDeck = getDeck(challenged);
    if (myDeck.length === 0) { await sendText(from, "❌ You don't have a deck set. Use .ctd [card #]"); return; }
    if (theirDeck.length === 0) { await sendText(from, "❌ Your opponent has no deck."); return; }

    const myPower = myDeck.reduce((acc, c) => acc + c.attack + c.defense + c.speed, 0);
    const theirPower = theirDeck.reduce((acc, c) => acc + c.attack + c.defense + c.speed, 0);
    const winner = myPower > theirPower ? sender : myPower < theirPower ? challenged : null;

    await sock.sendMessage(from, {
      text: `⚔️ *Card Battle*\n\n@${sender.split("@")[0]} Power: ${myPower}\n@${challenged.split("@")[0]} Power: ${theirPower}\n\n${winner ? `🏆 Winner: @${winner.split("@")[0]}!` : "🤝 It's a tie!"}`,
      mentions: [sender, challenged],
    });
    return;
  }

  if (cmd === "auction") {
    const userCardId = parseInt(args[0]);
    const price = parseInt(args[1]);
    if (isNaN(userCardId) || isNaN(price) || price <= 0) {
      await sendText(from, "❌ Usage: .auction [card_id] [price]");
      return;
    }
    const card = getUserCard(userCardId);
    if (!card || card.user_id !== sender) { await sendText(from, "❌ You don't own that card."); return; }
    const auctionId = addAuction(sender, userCardId, price);
    await sendText(from, `✅ Card *${card.name}* listed at auction for $${formatNumber(price)}!\nAuction ID: \`${auctionId}\``);
    return;
  }

  if (cmd === "myauc") {
    const auctions = getAuctions().filter((a) => a.seller_id === sender);
    if (auctions.length === 0) { await sendText(from, "📦 You have no active auctions."); return; }
    const text = "📦 *Your Auctions*\n\n" +
      auctions.map((a) => `#${a.id} — ${getTierEmoji(a.tier)} *${a.name}* — $${formatNumber(a.price)}`).join("\n");
    await sendText(from, text);
    return;
  }

  if (cmd === "listauc") {
    const auctions = getAuctions();
    if (auctions.length === 0) { await sendText(from, "📦 No auctions active."); return; }
    const text = "📦 *Active Auctions*\n\n" +
      auctions.map((a) => `#${a.id} — ${getTierEmoji(a.tier)} *${a.name}* (${a.tier}) — $${formatNumber(a.price)}`).join("\n");
    await sendText(from, text);
    return;
  }

  if (cmd === "cg") {
    const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;
    const mentioned = ctxInfo?.mentionedJid?.[0] || ctxInfo?.participant;
    const numArg = args.find((a) => /^\d+$/.test(a));
    const cardNum = numArg ? parseInt(numArg) : NaN;
    if (!mentioned || isNaN(cardNum)) { await sendText(from, "❌ Usage: .cg @user [card #]  or reply to a user's message with .cg [card #]"); return; }
    const cards = getUserCards(sender);
    if (cardNum < 1 || cardNum > cards.length) { await sendText(from, `❌ Invalid card number. You have ${cards.length} cards.`); return; }
    const card = cards[cardNum - 1];
    ensureUser(mentioned);
    transferCard(card.user_card_id, mentioned);
    await sock.sendMessage(from, {
      text: `🎁 @${sender.split("@")[0]} gifted *${card.name}* to @${mentioned.split("@")[0]}!`,
      mentions: [sender, mentioned],
    });
    return;
  }

  if (cmd === "ctd") {
    if (args[0]?.toLowerCase() === "clear") {
      clearDeck(sender);
      await sendText(from, "✅ Deck cleared.");
      return;
    }
    if (args[0]?.toLowerCase() === "remove") {
      const slot = parseInt(args[1]);
      if (isNaN(slot)) { await sendText(from, "❌ Usage: .ctd remove [slot]"); return; }
      removeFromDeck(sender, slot);
      await sendText(from, `✅ Removed card from slot ${slot}.`);
      return;
    }
    const cardNum = parseInt(args[0]);
    if (isNaN(cardNum)) { await sendText(from, "❌ Usage: .ctd [card #]"); return; }
    const cards = getUserCards(sender);
    if (cardNum < 1 || cardNum > cards.length) { await sendText(from, "❌ Invalid card number."); return; }
    const card = cards[cardNum - 1];
    const deck = getDeck(sender);
    if (deck.length >= 5) { await sendText(from, "❌ Deck is full (5 cards max). Use .ctd remove [slot] to remove one."); return; }
    const nextSlot = deck.length + 1;
    addToDeck(sender, nextSlot, card.user_card_id);
    await sendText(from, `✅ Added *${card.name}* to deck slot ${nextSlot}.`);
    return;
  }

  if (cmd === "deck") {
    const deck = getDeck(sender);
    if (deck.length === 0) { await sendText(from, "🃏 Your deck is empty. Use .ctd [card #]"); return; }
    const totalPower = deck.reduce((acc, c) => acc + c.attack + c.defense + c.speed, 0);
    let text = `🃏 *Your Deck* (Total Power: ${totalPower})\n\n`;
    deck.forEach((c) => {
      text += `[Slot ${c.slot}] ${getTierEmoji(c.tier)} *${c.name}* — ATK:${c.attack} DEF:${c.defense} SPD:${c.speed}\n`;
    });
    await sendText(from, text);
    return;
  }

  if (cmd === "sdi") {
    await sendText(from, "🎴 Deck background customization coming soon!");
    return;
  }

  if (cmd === "lc") {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const cardNum = parseInt(args[1] || args[0]);
    if (!mentioned || isNaN(cardNum)) { await sendText(from, "❌ Usage: .lc @user [card #]"); return; }
    const cards = getUserCards(sender);
    if (cardNum < 1 || cardNum > cards.length) { await sendText(from, "❌ Invalid card number."); return; }
    const card = cards[cardNum - 1];
    lendCard(card.user_card_id, mentioned);
    await sock.sendMessage(from, {
      text: `🤝 @${sender.split("@")[0]} lent *${card.name}* to @${mentioned.split("@")[0]}!`,
      mentions: [sender, mentioned],
    });
    return;
  }

  if (cmd === "lcd") {
    const lent = getLentCards(sender);
    if (lent.length === 0) { await sendText(from, "✅ You have no lent cards."); return; }
    const text = "🤝 *Lent Cards*\n\n" +
      lent.map((c) => `• *${c.name}* → @${c.lent_to?.split("@")[0]}`).join("\n");
    await sock.sendMessage(from, { text, mentions: lent.map((c) => c.lent_to).filter(Boolean) });
    return;
  }

  if (cmd === "retrieve") {
    retrieveCard(sender);
    await sendText(from, "✅ All lent cards have been retrieved!");
    return;
  }

  if (cmd === "sellc") {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const cardNum = parseInt(args[1] || args[0]);
    const price = parseInt(args[2] || args[1] || args[0]);
    if (!mentioned || isNaN(cardNum) || isNaN(price)) {
      await sendText(from, "❌ Usage: .sellc @user [card #] [price]");
      return;
    }
    const cards = getUserCards(sender);
    if (cardNum < 1 || cardNum > cards.length) { await sendText(from, "❌ Invalid card number."); return; }
    const card = cards[cardNum - 1];
    const offerId = createSellOffer(sender, mentioned, card.user_card_id, price);
    await sock.sendMessage(from, {
      text: `💰 @${mentioned.split("@")[0]}, @${sender.split("@")[0]} wants to sell you *${card.name}* for $${formatNumber(price)}.\n\nReply *.accept* to buy or *.decline* to reject.`,
      mentions: [sender, mentioned],
    });
    return;
  }

  if (cmd === "tc") {
    const quotedCtx = msg.message?.extendedTextMessage?.contextInfo;
    if (!quotedCtx) { await sendText(from, "❌ Reply to someone's message with .tc [your card #] [their card #]"); return; }
    const recipient = quotedCtx.participant || quotedCtx.remoteJid;
    if (!recipient) { await sendText(from, "❌ Couldn't determine recipient."); return; }
    const myCardNum = parseInt(args[0]);
    const theirCardNum = parseInt(args[1]);
    if (isNaN(myCardNum) || isNaN(theirCardNum)) { await sendText(from, "❌ Usage: .tc [your card #] [their card #] (reply to their message)"); return; }
    const myCards = getUserCards(sender);
    const theirCards = getUserCards(recipient);
    if (myCardNum < 1 || myCardNum > myCards.length) { await sendText(from, "❌ Invalid card number."); return; }
    if (theirCardNum < 1 || theirCardNum > theirCards.length) { await sendText(from, "❌ They don't have that card."); return; }
    const myCard = myCards[myCardNum - 1];
    const theirCard = theirCards[theirCardNum - 1];
    const offerId = createTradeOffer(sender, recipient, myCard.user_card_id, theirCard.user_card_id);
    await sock.sendMessage(from, {
      text: `🔄 @${recipient.split("@")[0]}, @${sender.split("@")[0]} wants to trade:\n*${myCard.name}* for your *${theirCard.name}*\n\nReply *.accept* or *.decline*`,
      mentions: [sender, recipient],
    });
    return;
  }

  if (cmd === "accept") {
    const trade = getPendingTrade(sender);
    if (trade) {
      const myCard = getUserCard(trade.to_card);
      const theirCard = getUserCard(trade.from_card);
      if (!myCard || !theirCard) { await sendText(from, "❌ Cards no longer available."); return; }
      transferCard(trade.from_card, sender);
      transferCard(trade.to_card, trade.from_user);
      updateTradeStatus(trade.id, "accepted");
      await sock.sendMessage(from, {
        text: `✅ Trade complete!\n@${sender.split("@")[0]} got *${theirCard.name}*\n@${trade.from_user.split("@")[0]} got *${myCard.name}*`,
        mentions: [sender, trade.from_user],
      });
      return;
    }

    const sell = getPendingSellOffer(sender);
    if (sell) {
      const buyerUser = ensureUser(sender);
      if ((buyerUser.balance || 0) < sell.price) {
        await sendText(from, `❌ Not enough money. Need $${formatNumber(sell.price)}.`);
        return;
      }
      const card = getUserCard(sell.user_card_id);
      transferCard(sell.user_card_id, sender);
      updateUser(sender, { balance: (buyerUser.balance || 0) - sell.price });
      const seller = ensureUser(sell.seller_id);
      updateUser(sell.seller_id, { balance: (seller.balance || 0) + sell.price });
      updateSellOfferStatus(sell.id, "accepted");
      await sock.sendMessage(from, {
        text: `✅ Purchase complete! @${sender.split("@")[0]} bought *${card.name}* for $${formatNumber(sell.price)}.`,
        mentions: [sender, sell.seller_id],
      });
      return;
    }

    await sendText(from, "❌ No pending offer found.");
    return;
  }

  if (cmd === "decline") {
    const trade = getPendingTrade(sender);
    if (trade) { updateTradeStatus(trade.id, "declined"); await sendText(from, "❌ Trade declined."); return; }
    const sell = getPendingSellOffer(sender);
    if (sell) { updateSellOfferStatus(sell.id, "declined"); await sendText(from, "❌ Offer declined."); return; }
    await sendText(from, "❌ No pending offer found.");
    return;
  }
}

async function getCardImageBuffer(card: any): Promise<Buffer> {
  if (card.image_data) {
    return Buffer.isBuffer(card.image_data) ? card.image_data : Buffer.from(card.image_data);
  }
  const svg = `<svg width="900" height="1260" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#111827"/><stop offset="55%" stop-color="#312e81"/><stop offset="100%" stop-color="#020617"/></linearGradient></defs>
    <rect width="900" height="1260" rx="42" fill="url(#bg)"/>
    <rect x="54" y="54" width="792" height="1152" rx="32" fill="none" stroke="#eab308" stroke-width="10"/>
    <text x="450" y="210" fill="#f8fafc" font-size="64" font-family="Arial" font-weight="700" text-anchor="middle">ALPHA CARD</text>
    <text x="450" y="560" fill="#fde68a" font-size="82" font-family="Arial" font-weight="700" text-anchor="middle">${escapeSvg(card.name || "Unknown Card")}</text>
    <text x="450" y="680" fill="#dbeafe" font-size="48" font-family="Arial" text-anchor="middle">${escapeSvg(card.series || "General")}</text>
    <text x="450" y="930" fill="#f8fafc" font-size="72" font-family="Arial" font-weight="700" text-anchor="middle">${escapeSvg(card.tier || "T?")}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

function escapeSvg(value: string): string {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch]!));
}
