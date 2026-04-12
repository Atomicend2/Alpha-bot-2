# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Bot Pairing

- On startup, the WhatsApp bot prompts in the server console for a phone number when no saved auth session exists and `BOT_PHONE_NUMBER` is not set.
- API-triggered bot starts do not prompt for console input; pass a phone number in the request body or use the console startup prompt.
- Pairing uses Baileys' latest fetched WhatsApp Web version and advertises the login device as Chrome on Ubuntu so WhatsApp can show the expected linked-device notification.
- Saved WhatsApp auth lives under the workspace `data/auth` directory and is reused across workflow restarts.
- Restart validation on 2026-04-12 confirmed the bot reconnected from the saved session without requesting a new pairing code.

## Staff and Bans

- `.addmod`, `.addguardian`, and `.recruit` create global staff records shown by `.modlist`.
- Mods and guardians can use `.ban <number>`, `.unban <number>`, `.ban <group link>`, `.unban <group link>`, and `.banlist`.
- SQLite startup migrations add missing bot columns/tables in place so older `bot.db` files do not lose existing data.
- Bot command responses are quoted to the command message where possible so the user can see who the reply is for.
- Card uploads use `.upload T<tier> <name>. <series>` while replying to an image/sticker.
- The menu sends the uploaded image as its header image with the Shadow Garden command styling.
- Card spawns and `.card`/`.cardinfo` always send an image; old cards without stored images get a generated Alpha card placeholder.
- Spawned cards can be claimed with either `.get <card_id>` or plain `get <card_id>`.
- `.s` converts image replies/captions to 512×512 cropped WebP stickers with sticker name `Atomic` and pack name `𝐒𝐇𝚫𝐃𝐎𝐖 𝐆𝚫𝐑𝐃𝚵𝐍`.
- `.setms` saves a replied-to sticker as the mention sticker. When someone tags a staff member or active premium member, the bot replies with that saved sticker.
- AFK messages use the red dot (`🔴`) indicator.
- `.play <song>` searches YouTube, sends song details with thumbnail, tries the normal audio stream first, then falls back to `yt-dlp` for bot-check failures before sending MP3 audio.
- Dig/fish rewards are capped at 376 coins, have 2-minute cooldowns, and are limited to 20 uses per day. Gambling has a 20-use daily limit and per-command cooldowns up to 7 minutes for casino.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
