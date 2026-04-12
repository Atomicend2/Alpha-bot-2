import type { WASocket } from "@whiskeysockets/baileys";
import { getAllCards, getActiveSpawn, claimSpawn, spawnCardInGroup, giveCard, getCard, ensureUser, getUser } from "../db/queries.js";
import { sendText, sendImage } from "../connection.js";
import { getTierEmoji, getWeightedRandomCard } from "../utils.js";
import { logger } from "../../lib/logger.js";
import sharp from "sharp";

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

  const caption = `✨ A card has spawned!\n\n*🎴 Name:* ${card.name}\n*🃏 Series:* ${card.series || "General"}\n*⭐ Tier:* ${card.tier}\n*🆔 ID:* \`${card.id}\`\n\n*💡Tip:* Type \`get ${card.id}\` to claim the card!`;

  try {
    const buf = await getCardImageBuffer(card);
    await sendImage(groupId, buf, caption);
  } catch (err) {
    logger.error({ err }, "Error spawning card");
    const fallback = await makeCardPlaceholder(card);
    await sendImage(groupId, fallback, caption);
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

async function getCardImageBuffer(card: any): Promise<Buffer> {
  if (card.image_data) {
    return Buffer.isBuffer(card.image_data) ? card.image_data : Buffer.from(card.image_data);
  }
  return makeCardPlaceholder(card);
}

async function makeCardPlaceholder(card: any): Promise<Buffer> {
  const name = escapeSvg(card.name || "Unknown Card");
  const series = escapeSvg(card.series || "General");
  const tier = escapeSvg(card.tier || "T?");
  const svg = `<svg width="900" height="1260" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#111827"/>
        <stop offset="55%" stop-color="#312e81"/>
        <stop offset="100%" stop-color="#020617"/>
      </linearGradient>
    </defs>
    <rect width="900" height="1260" rx="42" fill="url(#bg)"/>
    <rect x="54" y="54" width="792" height="1152" rx="32" fill="none" stroke="#eab308" stroke-width="10"/>
    <text x="450" y="210" fill="#f8fafc" font-size="64" font-family="Arial" font-weight="700" text-anchor="middle">ALPHA CARD</text>
    <text x="450" y="560" fill="#fde68a" font-size="82" font-family="Arial" font-weight="700" text-anchor="middle">${name}</text>
    <text x="450" y="680" fill="#dbeafe" font-size="48" font-family="Arial" text-anchor="middle">${series}</text>
    <text x="450" y="930" fill="#f8fafc" font-size="72" font-family="Arial" font-weight="700" text-anchor="middle">${tier}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

function escapeSvg(value: string): string {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch]!));
}
