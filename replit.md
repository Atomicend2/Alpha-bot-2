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
- Saved WhatsApp auth lives under the API server's `data/auth` directory and is reused across workflow restarts.

## Staff and Bans

- `.addmod`, `.addguardian`, and `.recruit` create global staff records shown by `.modlist`.
- Mods and guardians can use `.ban <number>`, `.unban <number>`, `.ban <group link>`, `.unban <group link>`, and `.banlist`.
- SQLite startup migrations add missing bot columns/tables in place so older `bot.db` files do not lose existing data.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
