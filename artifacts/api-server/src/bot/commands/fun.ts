import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";

const CHARACTERS = [
  "Goku (Dragon Ball Z)","Naruto Uzumaki (Naruto)","Luffy (One Piece)",
  "Ichigo (Bleach)","Zoro (One Piece)","Sasuke (Naruto)","Vegeta (DBZ)",
  "Levi (Attack on Titan)","Todoroki (MHA)","Itachi (Naruto)",
  "Light Yagami (Death Note)","L (Death Note)","Natsu (Fairy Tail)",
  "Erza (Fairy Tail)","Rem (Re:Zero)","Zero Two (Darling in the FranXX)",
  "Kirito (SAO)","Asuna (SAO)","Mikasa (AoT)","Hinata (Naruto)",
];

const POVS = [
  "You just realized you're the villain of someone else's story.",
  "You wake up and your entire memory is gone.",
  "You find a note that says 'Don't look behind you.'",
  "Everyone can see your aura except you.",
  "The world ended last night and you slept through it.",
  "You discover you've been an NPC this whole time.",
];

const RELATIONS = [
  "Soulmates", "Rivals", "Best Friends", "Enemies", "Secret Lovers",
  "Childhood Friends", "Mentor & Student", "Twin Flames", "Frenemies",
];

const WYR = [
  "Fight 100 duck-sized horses or 1 horse-sized duck?",
  "Never eat your favorite food again OR eat only your favorite food forever?",
  "Be able to fly but only 1 inch off the ground OR run at 100mph?",
  "Know when you'll die OR how you'll die?",
  "Live without music OR live without TV/movies?",
  "Be able to speak all languages OR talk to animals?",
  "Have unlimited money but no friends OR be loved by everyone but be broke?",
];

const JOKES = [
  "Why don't scientists trust atoms?\nBecause they make up everything! 😂",
  "I told my wife she was drawing her eyebrows too high.\nShe looked surprised.",
  "Why did the scarecrow win an award?\nBecause he was outstanding in his field!",
  "Why can't you explain puns to kleptomaniacs?\nThey always take things literally.",
  "What do you call a fish without eyes?\nA fsh.",
  "I used to hate facial hair but then it grew on me.",
];

const SOCIALS = [
  "Instagram addict 📸","Twitter main character 🐦","TikTok dancer 💃",
  "Discord lurker 👁️","Twitch streamer 🎮","Reddit philosopher 🤔",
];

const DUALITIES = [
  "Soft-spoken but will fight you 🥊","Introvert online, extrovert with friends",
  "Says 'I don't care' but cares deeply","Looks mean, is actually soft","Quiet in real life, chaotic online",
];

const SKILLS = [
  "Professional overthinker","Master of saying 'I'll do it later'",
  "Expert at pretending to be busy","PhD in sleeping through alarms",
  "Certified snack locator","World champion at avoiding conflict",
];

const GENS = [
  "You were definitely a cat in a past life 🐱",
  "Your vibe screams main character energy ✨",
  "You have the energy of someone who's seen too much 👁️",
  "You're 90% internet and 10% real world",
  "Your personality is literally a mood board",
];

export async function handleFun(ctx: CommandContext): Promise<void> {
  const { from, sender, args, command: cmd, msg, sock } = ctx;
  const name = sender.split("@")[0];
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  await sendText(from, loadingText(cmd), [sender]);

  if (cmd === "gay") {
    const targetId = getFunTarget(ctx);
    const targetName = targetId.split("@")[0];
    const pct = Math.floor(Math.random() * 101);
    await sock.sendMessage(from, {
      text: analysisResult("𝗚𝗮𝘆", targetName, pct),
      mentions: [targetId],
    });
    return;
  }

  if (cmd === "lesbian") {
    const targetId = getFunTarget(ctx);
    const targetName = targetId.split("@")[0];
    const pct = Math.floor(Math.random() * 101);
    await sock.sendMessage(from, {
      text: analysisResult("𝗟𝗲𝘀𝗯𝗶𝗮𝗻", targetName, pct),
      mentions: [targetId],
    });
    return;
  }

  if (cmd === "simp") {
    const target = mentioned ? `@${mentioned.split("@")[0]}` : "someone";
    const pct = Math.floor(Math.random() * 101);
    await sock.sendMessage(from, {
      text: `😩 @${name} is *${pct}% simp* for ${target}!`,
      mentions: [sender, ...(mentioned ? [mentioned] : [])],
    });
    return;
  }

  if (cmd === "match") {
    if (!mentioned) { await sendText(from, "❌ Mention someone to match with!"); return; }
    const pct = Math.floor(Math.random() * 101);
    const rating = pct >= 80 ? "💍 Perfect match!" : pct >= 60 ? "💕 Good match!" : pct >= 40 ? "🤝 Decent match." : "💔 Not meant to be.";
    await sock.sendMessage(from, {
      text: `💘 @${name} + @${mentioned.split("@")[0]} = *${pct}%* match\n${rating}`,
      mentions: [sender, mentioned],
    });
    return;
  }

  if (cmd === "ship") {
    if (!mentioned) { await sendText(from, "❌ Mention someone to ship with!"); return; }
    const n1 = name;
    const n2 = mentioned.split("@")[0];
    const ship = n1.slice(0, Math.ceil(n1.length / 2)) + n2.slice(Math.floor(n2.length / 2));
    await sock.sendMessage(from, {
      text: `💑 Ship name: *${ship}* 💕`,
      mentions: [sender, mentioned],
    });
    return;
  }

  if (cmd === "character") {
    const char = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    await sendText(from, `🎭 @${name}'s anime character is:\n*${char}*`, [sender]);
    return;
  }

  if (cmd === "psize" || cmd === "pp") {
    const size = Math.floor(Math.random() * 25);
    const bar = "8" + "=".repeat(size) + "D";
    await sendText(from, `📏 @${name}'s size: ${size}cm\n${bar}`, [sender]);
    return;
  }

  if (cmd === "skill") {
    const s = SKILLS[Math.floor(Math.random() * SKILLS.length)];
    await sendText(from, `🎯 @${name}'s special skill:\n*${s}*`, [sender]);
    return;
  }

  if (cmd === "duality") {
    const d = DUALITIES[Math.floor(Math.random() * DUALITIES.length)];
    await sendText(from, `♎ @${name}'s duality:\n*${d}*`, [sender]);
    return;
  }

  if (cmd === "gen") {
    const g = GENS[Math.floor(Math.random() * GENS.length)];
    await sendText(from, `🔮 ${g}`, [sender]);
    return;
  }

  if (cmd === "pov") {
    const p = POVS[Math.floor(Math.random() * POVS.length)];
    await sendText(from, `📖 *POV:* ${p}`);
    return;
  }

  if (cmd === "social") {
    const s = SOCIALS[Math.floor(Math.random() * SOCIALS.length)];
    await sendText(from, `📱 @${name} gives off:\n*${s}* energy`, [sender]);
    return;
  }

  if (cmd === "relation") {
    if (!mentioned) { await sendText(from, "❌ Mention someone!"); return; }
    const r = RELATIONS[Math.floor(Math.random() * RELATIONS.length)];
    await sock.sendMessage(from, {
      text: `💫 @${name} and @${mentioned.split("@")[0]} are:\n*${r}*`,
      mentions: [sender, mentioned],
    });
    return;
  }

  if (cmd === "wouldyourather" || cmd === "wyr") {
    const q = WYR[Math.floor(Math.random() * WYR.length)];
    await sendText(from, `🤔 *Would You Rather...*\n\n${q}`);
    return;
  }

  if (cmd === "joke") {
    await sendText(from, `😂 ${JOKES[Math.floor(Math.random() * JOKES.length)]}`);
    return;
  }
}

function loadingText(command: string): string {
  return `┌─⟡ 『 𝗔𝗟𝗣𝗛𝗔 𝗟𝗢𝗔𝗗𝗜𝗡𝗚 』⟡\n║\n║ ➩ Command: .${command}\n║ ➩ Target: calculating...\n║\n└────────────────────`;
}

function getFunTarget(ctx: CommandContext): string {
  const info = getContextInfo(ctx.msg.message);
  const participant = info?.participant || info?.quotedMessage?.key?.participant || info?.quotedMessage?.participant;
  return info?.mentionedJid?.[0] || participant || ctx.sender;
}

function getContextInfo(message: any): any {
  return message?.extendedTextMessage?.contextInfo ||
    message?.imageMessage?.contextInfo ||
    message?.videoMessage?.contextInfo ||
    message?.documentMessage?.contextInfo ||
    message?.stickerMessage?.contextInfo ||
    message?.buttonsResponseMessage?.contextInfo ||
    message?.listResponseMessage?.contextInfo ||
    message?.templateButtonReplyMessage?.contextInfo ||
    {};
}

function analysisResult(label: string, targetName: string, pct: number): string {
  const filled = Math.max(0, Math.min(10, Math.round(pct / 10)));
  const bar = "■".repeat(filled) + "□".repeat(10 - filled);
  return `╔═ ❰ 🌈 𝗔𝗡𝗔𝗟𝗬𝗦𝗜𝗦 𝗥𝗘𝗦𝗨𝗟𝗧 🌈 ❱ ═╗\n` +
    `║\n` +
    `║ 👤 𝗨𝘀𝗲𝗿: @${targetName}\n` +
    `║ 💖 ${label} 𝗟𝗲𝘃𝗲𝗹: ${pct}%\n` +
    `║\n` +
    `║ 📊 𝗦𝘁𝗮𝘁𝘂𝘀: [${bar}]\n` +
    `║\n` +
    `╚═════════════════╝`;
}
