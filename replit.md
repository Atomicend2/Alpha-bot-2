# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Recent Changes (2026-04-15)

### Role System
- Users have 5 roles: `owner`, `guardian`, `mod`, `recruit`, `premium`, `normal`
- Owner is identified by `BOT_OWNER_LID` constant in `connection.ts`
- Staff roles stored in `staff` table; premium in `users.premium`
- Role and `canUseAnimatedBg` flag returned in `/api/v1/user/stats` response
- Animated/video backgrounds restricted to owner, guardian, mod, and premium users

### Rank Inconsistency Fix
- `getUserRank` now filters bots (`COALESCE(is_bot, 0) = 0`) and uses correct comparison
- Rank is now consistent across leaderboard page, profile view, and WhatsApp commands

### Lottery System Fix
- Fixed critical bug: `INSERT INTO lottery_entries` had mismatched parameter count
- `.lottery` command now works without error
- Web "Join Lottery" button added to shop page (requires auth + having tickets)
- Web join calls `POST /api/v1/lottery/join`

### Keep-Alive System
- Server pings its own `/api/healthz` every 4 minutes to prevent Render from sleeping

### Profile Customization
- `profile_frame TEXT` column added to `users` table
- `bg_type TEXT` column added to `users` table (values: `static`, `animated`, `video`)
- `profile_frames` table added for future frame management

### Multi-Bot Support
- `bots` table added to database for storing multiple bot profiles
- CRUD endpoints: `GET/POST /api/bot/bots`, `DELETE /api/bot/bots/:id`
- Bot menu (`.menu` command) dynamically shows registered bots with online/offline status
- Admin panel at `/admin` shows registered bots and allows adding/removing them

### Admin Panel
- Password-protected with password "Admin" (configurable via `ADMIN_PASSWORD` env var)
- All sensitive bot routes require `x-admin-password` header
- Multi-bot management UI with add/remove/view functionality
- Bot menu preview shows in real-time

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
- Only the bot owner can add/remove global mods and guardians with `.addmod`, `.removemod`, `.addguardian`, and `.removeguardian`.
- Banned users are silently ignored by the bot; banned groups are left automatically and blocked from `.join` invite usage.
- `.mute @user <time>` or replying with `.mute <time>` stores a per-user group mute and deletes that user's messages until `.unmute @user`/reply removes it or the timer expires.
- `.kick` works by mention or by replying to a user's message.
- `.resetbal` globally resets all users' wallet and bank balances to zero for the owner.
- `.ac <amount> @user` and `.rc <amount> @user` can be used by the owner, mods, and guardians only. Premium users cannot use them. They also work while replying to a user's message, auto-create missing users, store wallet/bank, and never reduce wallet below zero.
- SQLite startup migrations add missing bot columns/tables in place so older `bot.db` files do not lose existing data.
- Bot command responses are quoted to the command message where possible so the user can see who the reply is for.
- Card uploads use `.upload T<tier> <name>. <series>` while replying to an image/sticker.
- The menu sends the uploaded image as its header image with the Shadow Garden command styling.
- Card spawns and `.card`/`.cardinfo` always send an image; old cards without stored images get a generated Alpha card placeholder.
- Card auto-spawn activity now treats 2,000 messages per 20-minute window as 100%, so the 30% threshold requires 600 messages; `.cards available` reports card totals by tier and top series.
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
- Dig/fish rewards have 2-minute cooldowns, no daily use cap, and always pay between $180 and $383. Gambling has a 20-use daily limit and every gambling command has its own independent cooldown column, so using `.casino` does not block `.slots`.
- `.gay` and `.lesbian` target a mentioned user first, then the replied-to message sender, then the command sender.
- `.stats` uses a compact Shadow Garden small-caps panel with economy, level/rank, RPG, guild, and inventory details.
- Card Pack, Premium Card Pack, VIP Pass, and VIP Access are removed from shops and filtered/deleted from inventories on startup.
- XP leaderboard ranking sorts by level first, then the remaining XP available on that level.

## Profile System

- `.profile` and `.p` support self, mention, and reply targets.
- The profile command sends a styled image generated with Sharp using the latest provided Shadow Garden character background asset (`IMG-20260410-WA0424(1)_1776008329836.jpg`), circular WhatsApp profile picture, wallet/bank, name, role/class, rank/level, XP progress, and bio.
- The profile image caption sends the requested no-emoji text profile format with name, age, bio, registered date, role, guild, and banned status.
- Users gain XP from message activity. XP required is `level × 100`; users level up automatically when XP reaches the current level requirement.
- Rank is calculated globally by level and XP.
- Non-staff DMs are ignored. Group commands are always processed before anti-spam/anti-link filters so reconnects or repeated command usage do not make the bot snub group commands.
- The WhatsApp message handler unwraps ephemeral/view-once/document-with-caption command messages and processes all message upsert types, including paired-phone/from-me group commands after reconnects.
- Bot admin detection compares all known paired-number identities, including device and LID forms, against group participants so admin-only commands work when the paired bot number is a group admin.
- WhatsApp connection startup prevents overlapping socket starts, logs close reasons, and only resets reconnect backoff after a stable connection window, keeping the saved paired session active during workflow restarts without rapid reconnect loops.

## Customization Guide (Where to Edit Things)

### Changing the Bot Name (e.g. from "Alpha" to your own bot name)
Edit these files:
- `artifacts/api-server/src/bot/commands/menu.ts` — Line 16: change `Alpha` in the menu banner; Line 317: change the bot info line
- `artifacts/api-server/src/bot/commands/ai.ts` — Line 80: change the system prompt where it says "You are Alpha..."
- `artifacts/api-server/src/bot/handlers/message.ts` — Line 250: change `.ping` response (e.g. "Alpha's here!")

### Website Link (the URL the bot sends when someone types `.website`)
Set `WEBSITE_URL` in Render. The bot sends only that URL with the Shadow Garden link image.

### Shop Link (the URL the bot sends when someone types `.shop`)
Set `SHOP_URL` in Render. If `SHOP_URL` is not set, the bot uses `WEBSITE_URL` plus `/shop`. The bot sends only that URL with the Shadow Garden link image.

### Hero & World Map Images (shown on the website)
Place image files in `artifacts/shadow-garden/public/images/`:
- `hero-bg.png` — the background image on the home landing page
- `world-map.png` — the background for the World/map page
- `opengraph.jpg` — the preview image shown when sharing links on WhatsApp/Discord (1200x630px recommended)

### Community WhatsApp Link
The WhatsApp group invite link (`https://chat.whatsapp.com/...`) appears in:
- `artifacts/shadow-garden/src/pages/home.tsx` (the "Join Shadow Garden" button)
- `artifacts/shadow-garden/src/pages/login.tsx` (the footer link)
- `artifacts/api-server/src/bot/handlers/message.ts` (the `.community` command response)

### Bot Avatar / Profile Picture
The bot's own profile picture on WhatsApp is set via the paired WhatsApp account, not by code.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
