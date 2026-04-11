import type { WASocket } from "@whiskeysockets/baileys";
import { getAllCards, getActiveSpawn, claimSpawn, spawnCardInGroup, giveCard, getCard, ensureUser, getUser } from "../db/queries.js";
import { sendText, sendImage } from "../connection.js";
import { getTierEmoji, getWeightedRandomCard } from "../utils.js";
import { logger } from "../../lib/logger.js";

const spawnCounters: Map<string, number> = new Map();
const SPAWN_THRESHOLD = 15;

export async function checkAutoSpawn(sock: WASocket, groupId: string): Promise<void> {
  const count = (spawnCounters.get(groupId) || 0) + 1;
  spawnCounters.set(groupId, count);

  if (count >= SPAWN_THRESHOLD + Math.floor(Math.random() * 10)) {
    spawnCounters.set(groupId, 0);
    await spawnCard(sock, groupId);
  }
}

export async function spawnCard(sock: WASocket, groupId: string, specific?: string): Promise<void> {
  const existing = getActiveSpawn(groupId);
  if (existing) return;

  const cards = getAllCards();
  if (cards.length === 0) return;

  let card = specific ? cards.find((c) => c.id === specific) : getWeightedRandomCard(cards);
  if (!card) card = getWeightedRandomCard(cards);
  if (!card) return;

  const spawnId = spawnCardInGroup(groupId, card.id);

  const caption = `✨ *A card has spawned!*\n\n${getTierEmoji(card.tier)} *${card.name}*\n📦 Series: ${card.series}\n🎖️ Tier: ${card.tier}\n\n📌 Card ID: \`${card.id}\`\n\nType *.get ${card.id}* to claim it!`;

  try {
    if (card.image_data) {
      const buf = Buffer.isBuffer(card.image_data)
        ? card.image_data
        : Buffer.from(card.image_data);
      await sendImage(sock as any, groupId, buf, caption);
    } else {
      await sendText(groupId, caption);
    }
  } catch (err) {
    logger.error({ err }, "Error spawning card");
    await sendText(groupId, caption);
  }
}

export async function handleGetCard(
  sock: WASocket,
  groupId: string,
  senderId: string,
  cardId: string
): Promise<void> {
  const spawn = getActiveSpawn(groupId);
  if (!spawn) {
    await sendText(groupId, "❌ There's no active card spawn right now.");
    return;
  }
  if (spawn.card_id !== cardId) {
    await sendText(groupId, `❌ That's not the right card ID. Check the spawn message!`);
    return;
  }

  ensureUser(senderId);
  claimSpawn(spawn.id, senderId);
  giveCard(senderId, cardId);

  const card = getCard(cardId);
  await sendText(
    groupId,
    `🎉 @${senderId.split("@")[0]} claimed *${card.name}* (${getTierEmoji(card.tier)} ${card.tier})!`,
    [senderId]
  );
}
