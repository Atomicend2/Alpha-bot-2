import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";
import { logger } from "../../lib/logger.js";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const DEFAULT_STICKER_NAME = "Atomic";
const DEFAULT_STICKER_PACK = "𝐒𝐇𝚫𝐃𝐎𝐖 𝐆𝚫𝐑𝐃𝚵𝐍";

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
      const target = msg.message?.imageMessage
        ? msg
        : {
            key: {
              remoteJid: from,
              fromMe: false,
              id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || "",
              participant: msg.message?.extendedTextMessage?.contextInfo?.participant,
            },
            message: quoted,
          };
      const downloaded = await downloadMediaMessage(target as any, "buffer", {}, { reuploadRequest: (sock as any).updateMediaMessage });
      const input = Buffer.isBuffer(downloaded) ? downloaded : Buffer.from(downloaded as any);
      const webp = await sharp(input, { animated: true })
        .resize(512, 512, { fit: "cover", position: "centre" })
        .webp({ quality: 85 })
        .toBuffer();
      const buf = addWebpExif(webp, DEFAULT_STICKER_PACK, DEFAULT_STICKER_NAME);
      await sock.sendMessage(from, {
        sticker: buf,
        packname: DEFAULT_STICKER_PACK,
        author: DEFAULT_STICKER_NAME,
      });
    } catch (err) {
      logger.error({ err }, "Failed to create sticker");
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
      const target = {
        key: {
          remoteJid: from,
          fromMe: false,
          id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || "",
          participant: msg.message?.extendedTextMessage?.contextInfo?.participant,
        },
        message: quoted,
      };
      const downloaded = await downloadMediaMessage(target as any, "buffer", {}, { reuploadRequest: (sock as any).updateMediaMessage });
      const buf = Buffer.isBuffer(downloaded) ? downloaded : Buffer.from(downloaded as any);
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
    await sendText(from, `🔎 Searching YouTube for: *${song}*`);
    try {
      const play = await import("play-dl");
      const results = await play.search(song, { limit: 1 });
      const video = results[0];
      if (!video?.url) {
        await sendText(from, "❌ Song not found on YouTube.");
        return;
      }
      const title = video.title || song;
      const duration = video.durationRaw || "Unknown";
      const channel = video.channel?.name || "Unknown channel";
      const thumbnail = video.thumbnails?.[0]?.url;
      const info = `🎵 *${title}*\n\n👤 Channel: ${channel}\n⏱️ Duration: ${duration}\n🔗 ${video.url}\n\n⬇️ Converting to audio...`;
      if (thumbnail) {
        await sock.sendMessage(from, { image: { url: thumbnail }, caption: info });
      } else {
        await sendText(from, info);
      }
      let mp3: Buffer;
      try {
        const streamInfo = await play.stream(video.url, { quality: 2 });
        const sourceBuffer = await readStream(streamInfo.stream as any);
        mp3 = await convertToMp3(sourceBuffer);
      } catch (streamErr) {
        logger.warn({ err: streamErr, url: video.url }, "play-dl stream failed; trying yt-dlp fallback");
        mp3 = await downloadAudioWithYtDlp(video.url);
      }
      await sock.sendMessage(from, {
        audio: mp3,
        mimetype: "audio/mpeg",
        fileName: `${sanitizeFileName(title)}.mp3`,
      });
    } catch (err: any) {
      logger.error({ err, song }, "Failed to play YouTube audio");
      await sendText(from, `❌ Failed to fetch audio: ${err?.message || "YouTube request failed"}`);
    }
    return;
  }
}

async function readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function convertToMp3(input: Buffer): Promise<Buffer> {
  const dir = path.join(process.cwd(), "data", "tmp");
  await fs.mkdir(dir, { recursive: true });
  const id = randomUUID();
  const inputPath = path.join(dir, `${id}.input`);
  const outputPath = path.join(dir, `${id}.mp3`);
  await fs.writeFile(inputPath, input);
  try {
    await runFfmpeg(["-y", "-i", inputPath, "-vn", "-ar", "44100", "-ac", "2", "-b:a", "128k", outputPath]);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(inputPath, { force: true }).catch(() => {});
    await fs.rm(outputPath, { force: true }).catch(() => {});
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-500) || `ffmpeg exited with ${code}`));
    });
  });
}

async function downloadAudioWithYtDlp(url: string): Promise<Buffer> {
  const dir = path.join(process.cwd(), "data", "tmp");
  await fs.mkdir(dir, { recursive: true });
  const id = randomUUID();
  const outputPath = path.join(dir, `${id}.mp3`);
  try {
    await runCommand("yt-dlp", [
      "--no-playlist",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "128K",
      "-o",
      outputPath,
      url,
    ]);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(outputPath, { force: true }).catch(() => {});
  }
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-800) || `${command} exited with ${code}`));
    });
  });
}

function addWebpExif(webp: Buffer, packName: string, stickerName: string): Buffer {
  if (webp.length < 12 || webp.toString("ascii", 0, 4) !== "RIFF" || webp.toString("ascii", 8, 12) !== "WEBP") {
    return webp;
  }
  const exif = buildStickerExif(packName, stickerName);
  const exifSize = Buffer.alloc(4);
  exifSize.writeUInt32LE(exif.length, 0);
  const exifChunk = Buffer.concat([
    Buffer.from("EXIF", "ascii"),
    exifSize,
    exif,
    exif.length % 2 ? Buffer.from([0]) : Buffer.alloc(0),
  ]);
  const chunks: Buffer[] = [];
  let offset = 12;
  while (offset + 8 <= webp.length) {
    const type = webp.toString("ascii", offset, offset + 4);
    const size = webp.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (end > webp.length) break;
    if (type !== "EXIF") chunks.push(webp.subarray(offset, end));
    offset = end;
  }
  const output = Buffer.concat([webp.subarray(0, 12), ...chunks, exifChunk]);
  output.writeUInt32LE(output.length - 8, 4);
  return output;
}

function buildStickerExif(packName: string, stickerName: string): Buffer {
  const json = Buffer.from(JSON.stringify({
    "sticker-pack-id": "atomic-shadow-garden",
    "sticker-pack-name": packName,
    "sticker-pack-publisher": stickerName,
    emojis: [""],
  }), "utf-8");
  const header = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);
  header.writeUInt32LE(json.length, 14);
  return Buffer.concat([header, json]);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "").slice(0, 80) || "audio";
}
