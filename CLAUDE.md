# Balisong-Bot — Claude Notes

Discord bot for **Balisong Flipping Center** (discord.js v14, Node 22). Part of the BFC project alongside `BalisongFlippingCenterServer` (Spring Boot), `BalisongFlippingCenterWeb` (React), and `BalisongFlippingCenterAIPython` (Latch).

## Features
- **Latch (AI)** — `/latch question:<text>`, @mentioning the bot, or any message in `LATCH_CHANNEL_ID`. Calls the backend's `POST /ai/chat` with client credentials `X-Client-Id: discord` / `X-Client-Key: AI_CLIENT_KEY_DISCORD` (must match the backend's `AI_CLIENT_KEY_DISCORD`). `sessionId` is `discord-<channelId>-<userId>`, so each user's conversation history and the backend's 10/min rate limit are per channel. The streamed reply is rendered by editing the message ~every 1.2s and split across messages at Discord's 2000-char limit. All bot output uses `allowedMentions: { parse: [] }` so Latch can never ping users/roles.
- **Bug reports** — on startup the bot reposts a "Start Submit" button in `BUG_REPORTS_CHANNEL_ID`; `/submit` starts the same flow. User uploads a screenshot (downloaded, then their message is deleted) → clicks "Add Description" → modal → posted to `BUG_SUBMISSIONS_CHANNEL_ID`. Pending state is in-memory (`src/utils/pendingSubmissions.js`), lost on restart.

## Running
- `npm install`, copy `.env.example` → `.env`, fill in values
- `node deploy-commands.js` — registers every command in `src/commands` to `GUILD_ID` (rerun after adding/changing commands)
- `npm run dev` (nodemon) or `node index.js`
- Requires the **Message Content** privileged intent enabled in the Discord developer portal

## Hosting
Local only for now. Planned: container alongside the backend on the prod EC2 (compose network → `http://server:8080`), secrets via SSM in `BalisongFlippingCenterTerraformProd`.

## Known Gaps / To Do
- Backend bug-report / flagged-post endpoints with bot API-key auth (see backend `CLAUDE.md` Known Gaps) — bug reports currently only go to a Discord channel
- `pg` dependency is unused
