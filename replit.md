# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Bot data store**: SQLite (`data/bot.db`) via `better-sqlite3`
- **WhatsApp client**: Baileys
- **Image processing**: Sharp
- **Audio fallback**: `yt-dlp` + ffmpeg
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Bot Pairing

- On startup, the WhatsApp bot prompts in the server console for a phone number when no saved auth session exists and `BOT_PHONE_NUMBER` is not set.
- API-triggered bot starts do not prompt for console input; pass a phone number in the request body or use the console startup prompt.
- Pairing uses Baileys' latest fetched WhatsApp Web version and advertises the login device as Chrome on Ubuntu so WhatsApp can show the expected linked-device notification.
- Saved WhatsApp auth lives under the workspace `data/auth` directory and is reused across workflow restarts.
- Restart validation on 2026-04-12 confirmed the bot reconnected from the saved session without requesting a new pairing code.
- On each fresh connection/reconnect, WhatsApp messages with timestamps before the bot came online are ignored so commands sent while the bot was offline are not processed later.
- Restarts keep using the saved paired number in `data/auth`; pairing is only requested again when there is no saved WhatsApp auth session.

## Staff, Economy, and Stickers

- `.addmod`, `.addguardian`, and `.recruit` create global staff records shown by `.mods` in the Shadow Garden mods/guardians layout.
- Mods and guardians can use `.ban <number>`, `.unban <number>`, `.ban <group link>`, `.unban <group link>`, and `.banlist`.
- `.ac <amount> @user` and `.rc <amount> @user` can be used by owner, mods, guardians, and active premium users. They also work while replying to a user's message, auto-create missing users, store wallet/bank, and never reduce wallet below zero.
- SQLite startup migrations add missing bot columns/tables in place so older `bot.db` files do not lose existing data.
- Bot command responses are quoted to the command message where possible so the user can see who the reply is for.
- Card uploads use `.upload T<tier> <name>. <series>` while replying to an image/sticker.
- The menu sends the uploaded image as its header image with the Shadow Garden command styling.
- Card spawns and `.card`/`.cardinfo` always send an image; old cards without stored images get a generated Alpha card placeholder.
- Spawned cards can be claimed with either `.get <card_id>` or plain `get <card_id>`.
- `.s` converts image replies/captions to 512×512 cropped WebP stickers with sticker name `Atomic` and pack name `𝐒𝐇𝚫𝐃𝐎𝐖 𝐆𝚫𝐑𝐃𝚵𝐍`, embedding WebP sticker metadata for sharing/favorites.
- `.setms` saves a replied-to sticker as the sender's personal mention sticker. `.delms` removes the sender's mention sticker.
- `.setpp` and `.setbg` save a player's profile-card picture/background from a replied image or image caption; they do not change the paired WhatsApp account profile. Owner, guardians, mods, group mods, and active premium users can also set video media as the profile picture/background, and `.profile`/`.p` sends an animated GIF-style profile when either saved profile media is video.
- `.register` gives a $45,000 starter bonus.
- When someone tags an owner, mod, guardian, or active premium user who has a saved personal mention sticker, the bot replies with that specific user's sticker. Replies without an explicit tag do not trigger mention stickers, and tags sent by the bot/paired account itself do not trigger mention stickers.
- Interaction commands (`.hug`, `.kiss`, `.slap`, etc.) support staff GIF uploads by replying to a GIF/video/image with `.<interaction> upload`; saved GIFs persist in SQLite bot settings and are sent when that interaction is used.
- Existing RPG databases are migrated with `last_dungeon` so `.dungeon` cooldown updates do not fail after reconnects/restarts. `.dungeon` has a 6-minute cooldown, supports multiple moves (`attack`, `guard`, `skill`, `rush`, `sneak`, `loot`, `scout`, `heal`, `focus`, `ambush`, `retreat`), and `.quest` has a 4-minute cooldown.
- AFK messages use the red dot (`🔴`) indicator.
- `.play <song>` searches YouTube, sends song details with thumbnail, tries the normal audio stream first, then falls back to `yt-dlp` for bot-check failures before sending MP3 audio.
- Dig/fish rewards are capped at 376 coins, have 2-minute cooldowns, and are limited to 20 uses per day. Gambling has a 20-use daily limit and every gambling command has its own independent cooldown column, so using `.casino` does not block `.slots`.

## Profile System

- `.profile` and `.p` support self, mention, and reply targets.
- The profile command sends a styled image generated with Sharp using the latest provided Shadow Garden character background asset (`IMG-20260410-WA0424(1)_1776008329836.jpg`), circular WhatsApp profile picture, wallet/bank, name, role/class, rank/level, XP progress, and bio.
- The profile image caption sends the requested no-emoji text profile format with name, age, bio, registered date, role, guild, and banned status.
- Users gain XP from message activity. XP required is `level × 100`; users level up automatically when XP reaches the current level requirement.
- Rank is calculated globally by level and XP.
- Non-staff DMs are ignored. Group commands are always processed before anti-spam/anti-link filters so reconnects or repeated command usage do not make the bot snub group commands.
- The WhatsApp message handler unwraps ephemeral/view-once/document-with-caption command messages and processes all message upsert types, including paired-phone/from-me group commands after reconnects.
- Bot admin detection compares all known paired-number identities, including device and LID forms, against group participants so admin-only commands work when the paired bot number is a group admin.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
