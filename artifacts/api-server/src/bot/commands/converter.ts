import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";
import { logger } from "../../lib/logger.js";

export async function handleConverter(ctx: CommandContext): Promise<void> {
  const { from, sender, args, command: cmd, msg, sock } = ctx;

  if (cmd === "sticker" || cmd === "s") {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      || msg.message?.imageMessage;
    if (!quoted?.imageMessage && !msg.message?.imageMessage) {
      await sendText(from, "❌ Reply to an image or send an image with .s caption to make a sticker.");
      return;
    }
    try {
      const target = msg.message?.imageMessage ? msg : { message: quoted };
      const stream = await sock.downloadMediaMessage(target as any);
      const chunks: Buffer[] = [];
      for await (const chunk of stream as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buf = Buffer.concat(chunks);
      await sock.sendMessage(from, {
        sticker: buf,
      });
    } catch (err) {
      await sendText(from, "❌ Failed to create sticker.");
    }
    return;
  }

  if (cmd === "toimg" || cmd === "turnimg") {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted?.stickerMessage) {
      await sendText(from, "❌ Reply to a sticker with .toimg to convert it.");
      return;
    }
    try {
      const stream = await sock.downloadMediaMessage({ message: quoted, key: { id: "", remoteJid: from, fromMe: false } } as any);
      const chunks: Buffer[] = [];
      for await (const chunk of stream as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buf = Buffer.concat(chunks);
      await sock.sendMessage(from, { image: buf, caption: "Here's your image! 🖼️" });
    } catch {
      await sendText(from, "❌ Failed to convert sticker.");
    }
    return;
  }

  if (cmd === "take") {
    const parts = args.join(" ").split(",").map((s) => s.trim());
    const packName = parts[0] || "My Pack";
    const stickerName = parts[1] || "Sticker";
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted?.stickerMessage) {
      await sendText(from, "❌ Reply to a sticker with .take <pack>, <name>");
      return;
    }
    await sendText(from, `✅ Sticker rename to: Pack="${packName}", Name="${stickerName}" (full metadata editing not available via Baileys directly).`);
    return;
  }

  if (cmd === "speech") {
    const text = args.join(" ");
    if (!text) { await sendText(from, "❌ Usage: .speech <text> (reply to image/sticker)"); return; }
    await sendText(from, `🗣️ Speech overlay: "${text}" — Image editing feature coming soon!`);
    return;
  }

  if (cmd === "mood") {
    const tag = args[0];
    if (!tag) { await sendText(from, "❌ Usage: .mood <tag>"); return; }
    await sendText(from, `🎭 Mood sticker for "#${tag}" — Mood sticker feature coming soon!`);
    return;
  }

  if (cmd === "pintimg") {
    const query = args.join(" ");
    if (!query) { await sendText(from, "❌ Usage: .pintimg <query>"); return; }
    await sendText(from, `🖼️ Pinterest search for "${query}" — Image search feature coming soon!`);
    return;
  }

  if (cmd === "play") {
    const song = args.join(" ");
    if (!song) { await sendText(from, "❌ Usage: .play <song name>"); return; }
    await sendText(from, `🎵 Audio download for "${song}" — Audio feature coming soon!`);
    return;
  }
}
