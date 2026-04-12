import type { CommandContext } from "./index.js";
import { sendText } from "../connection.js";

const ACTIONS: Record<string, { with: string[]; self: string[] }> = {
  hug: {
    with: ["hugs {target} tightly! 🤗", "wraps {target} in a warm hug 💕"],
    self: ["wants a hug... 🥺"],
  },
  kiss: {
    with: ["kisses {target}! 💋", "gives {target} a little kiss 😘"],
    self: ["kissed the mirror again 😚"],
  },
  slap: {
    with: ["slaps {target}! SMACK! 👋", "gave {target} a reality check 🖐️"],
    self: ["slapped themselves... are you okay? 🤔"],
  },
  pat: {
    with: ["pats {target} on the head 🥰", "gives {target} a gentle pat 👋"],
    self: ["pats themselves... hang in there 💪"],
  },
  punch: {
    with: ["punches {target}! POW! 👊", "sends a punch flying at {target} 🥊"],
    self: ["punched themselves. Ouch?"],
  },
  kill: {
    with: ["eliminated {target}! 💀", "got rid of {target}. RIP 🪦"],
    self: ["tried self-deletion but respawned 😂"],
  },
  hit: {
    with: ["hits {target}! 💢", "smacks {target} 🏏"],
    self: ["hit themselves... 😬"],
  },
  kidnap: {
    with: ["kidnapped {target}! 🎭", "snatched {target} away! 😈"],
    self: ["tried to kidnap themselves. Failed 🕵️"],
  },
  lick: {
    with: ["licked {target}! 😛", "gives {target} a lick for some reason... 👅"],
    self: ["licked themselves 😂"],
  },
  bonk: {
    with: ["bonks {target} on the head! 🔨", "sends {target} to horny jail 🚔"],
    self: ["self-bonked 💥"],
  },
  tickle: {
    with: ["tickles {target}! Hehehe! 😂", "attacks {target}'s weak spot 🤣"],
    self: ["tried to tickle themselves 🤷"],
  },
};

const SOLO_ACTIONS: Record<string, string[]> = {
  wave: ["waves hello! 👋", "waves at everyone~ 🌊"],
  dance: ["is dancing! 💃", "starts busting moves! 🕺"],
  sad: ["is feeling sad right now... 😢", "needs some comfort 🥺"],
  smile: ["smiles brightly! 😊", "gives you a warm smile ☺️"],
  laugh: ["bursts out laughing! 😂", "can't stop laughing 🤣"],
  shrug: ["shrugs. ¯\\_(ツ)_/¯", "doesn't know either 🤷"],
};

export async function handleInteraction(ctx: CommandContext): Promise<void> {
  const { from, sender, command: cmd, msg, sock } = ctx;
  const name = sender.split("@")[0];
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  await sendText(from, `┌─⟡ 『 𝗔𝗟𝗣𝗛𝗔 𝗟𝗢𝗔𝗗𝗜𝗡𝗚 』⟡\n║\n║ ➩ Action: .${cmd}\n║ ➩ Target: preparing...\n║\n└────────────────────`, [sender, ...(mentioned ? [mentioned] : [])]);

  if (SOLO_ACTIONS[cmd]) {
    const actions = SOLO_ACTIONS[cmd];
    const action = actions[Math.floor(Math.random() * actions.length)];
    await sendText(from, `@${name} ${action}`, [sender]);
    return;
  }

  if (ACTIONS[cmd]) {
    const actions = ACTIONS[cmd];
    if (mentioned) {
      const templates = actions.with;
      const tmpl = templates[Math.floor(Math.random() * templates.length)];
      const text = `@${name} ${tmpl.replace("{target}", `@${mentioned.split("@")[0]}`)}`;
      await sock.sendMessage(from, { text, mentions: [sender, mentioned] });
    } else {
      const texts = actions.self;
      await sendText(from, `@${name} ${texts[Math.floor(Math.random() * texts.length)]}`, [sender]);
    }
    return;
  }
}
