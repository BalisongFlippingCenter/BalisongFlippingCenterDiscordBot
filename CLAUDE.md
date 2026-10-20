# Balisong-Bot — Claude Notes

A public Discord bot that any server can add: a general balisong resource powered by **Latch** (the BFC AI) plus non-AI catalog commands. discord.js v14, Node 22. It is **not** BFC app support — no site features, accounts, bug reports, or moderation. Part of the BFC project alongside `BalisongFlippingCenterServer` (Spring Boot), `BalisongFlippingCenterWeb` (React), and `BalisongFlippingCenterAIPython` (Latch).

## Commands (registered globally)
| Command | What it does |
|---|---|
| `/latch question:` or @mention | Ask Latch (streams the reply) |
| `/latch-reset` | Clears your Latch conversation in this channel (ephemeral). Calls the backend's `DELETE /ai/chat/session/{sessionId}`, which only lets a client clear sessions prefixed with its own client ID |
| `/knife name:` | Catalog lookup → embed (current version specs, variants + MSRP, other versions). Autocomplete via `/catalog/any/knives?search=` |
| `/maker name:` | Maker embed with their knives. Autocomplete from `/catalog/any/makers` |
| `/compare knife1: knife2:` | Current versions side by side (inline embed fields). Same autocomplete as `/knife` |
| `/recommend [budget] [pivot] [handle]` | Catalog filter: `maxPrice`/`pivotSystem` go to the API; `handle` is a group (e.g. "Plastic (any type)") matched bot-side against `handleMaterialSummary` keywords, since the API only matches exact enums. Up to 10, cheapest first |
| `/quiz [questions:3–10]` | Multi-question quiz (default 5) on one card edited in place: 20s per question, then a ~4s reveal (answer + who got it), then the next; ends with a leaderboard (1 point per correct, no speed bonus). Questions come from distinct random catalog knives, spreading question types (pivot, handles, price, maker, weight, length). Everyone answers once per question with ephemeral feedback; stale clicks are refused via the question index in the custom ID. The starter can End quiz early. Answer order uses a Fisher–Yates shuffle — `sort(() => Math.random() - 0.5)` put the answer on A ~36% of the time. Games held in memory |
| `/trick info name:` / `/trick random [level]` | Trick card from `tricks.js` (level, roles, variants by level, aliases) with an 🤖 Ask Latch how button (goes through `latch.js`'s `ask`, so Latch limits apply) |
| `/trick-of-the-day [level]` | Same move for everyone per UTC day (per level). Seeded shuffle per cycle, so every move at a level appears once before repeats. Card where **anyone** can add a landing clip (max 10; landers derived from `landing-<userId>.*` attachment names) |
| `/bali` | B.A.L.I. (H.O.R.S.E. for flipping): lobby → host starts → setter types or rolls a trick → others self-report ✅/❌ → misses earn letters, B-A-L-I is out, last standing wins. Host can skip a setter / skip pending players (counted as missed) / end. Guild-only, max 8 players. When threads are allowed (same check as Latch) the game opens a thread on its card (1h auto-archive) and pings go there; when the game ends (winner or host ended) the thread gets a closing note and is archived immediately, and locked too if the bot has Manage Threads (optional — without it, anyone posting un-archives it); otherwise they're channel follow-ups. Card edits can't notify, so each turn change posts a message that pings only whoever must act (the setter, then the players still to respond, then the winner), deduped by phase/setter/trick. **Games live in memory** (a restart expires them; idle 2h games are swept) |
| `/learn topic:` | Static explainers from `src/content/learnTopics.js`; topics with a `learnSlug` link to the site's `/learn/<slug>` page |
| `/combo level:` | Random combo at or below the level (always includes at least one trick at it); number of tricks is random and grows with level. Requester-only 🎲 Reroll and 📹 I landed it buttons |
| `/balidare combo user: [level:] [combo:]` | Dare a user with a generated (by level) or typed combo. Pings only the dared user |
| `/balidare video user: video: [note:]` | Dare a user with your own clip. Guild-only; 5 dares per user per 10 min (in-memory) |
| `/help` | Ephemeral command list |

## Combos & Balidares
- Tricks live in `src/content/tricks.js` (the user's curated list): `name`, `level` (beginner/intermediate/advanced/expert, matching the backend's `DifficultyTag`), `roles` (any of opener/mid/closer), optional `aliases`, `variants` (`'ring:intermediate'` = variant name + optional level override, e.g. fingers for Chaplins), and `family` (at most one trick per family per combo — the three Chaplins share `chaplin`).
- `src/utils/comboGenerator.js`: combo = one opener + random mids + one closer, all distinct tricks; a trick only qualifies if one of its variants is at or below the level, and the variant is picked from those. Retries (up to 20) until at least one move is at the chosen level. Flow between tricks (direction, fingers, grip, orientation) is deliberately **not** modelled — a combo is a list of tricks to hit in order and the flipper adds whatever transitions they need (the card says so). If some pairs prove too awkward, the cheap fix is tagging direction-locked tricks `cw`/`ccw`, not a full flow model. Mid counts per level are in `MID_COUNTS`, whose keys are also the selectable levels — Expert is left out until the list has expert tricks (only the thumb variants are expert today).
- Cards are Components V2 messages built by `src/utils/challengeCard.js`. Landing videos are uploaded through a modal file-upload, then **re-uploaded by the bot** into the card's media gallery (Discord's modal/option attachment URLs expire). The bot's upload limit follows the server's boost tier (10 MB unboosted, 50 MB tier 2, 100 MB tier 3); bigger clips get a "trim it" message.
- No database: all state lives in the message. The card body is read back from the first text display, kept videos from `message.attachments`, and owner/target IDs (+ level for reroll) from button custom IDs (`combo:<action>:<ownerId>[:level]`, `balidare:<action>:<targetId>`). `interactionCreate` routes buttons and modal submits to the command named by the custom ID's first segment (`button` / `modalSubmit` exports).

## Latch integration
- Calls the backend's `POST /ai/chat` with `X-Client-Id: discord` / `X-Client-Key: AI_CLIENT_KEY_DISCORD`. The backend forwards `client: "discord"` to the AI service, which then uses a separate Discord persona (general balisong expert, Discord markdown) with only the catalog tools plus a Brave-backed `web_search` tool — see the AI service README.
- `sessionId` = `discord-<channelId>-<userId>`: per-user conversation memory per channel (24h in Redis), and the backend's 10/min rate limit applies per session.
- **Threads** (`src/utils/latchThread.js`): in a text/announcement channel where the bot has Create Public Threads + Send Messages in Threads, `/latch` (and the trick card's Ask Latch button) posts "@user asked Latch: …" and opens a thread on it; an @mention opens the thread on the user's own message. The answer streams in the thread, the asker is added, and the session is keyed to the thread ID — so @mentioning the bot inside the thread continues the conversation, and `/latch-reset` there clears just that thread. Inside threads, in DMs, or without the permissions, answers stay inline. `canStartThread` in `src/utils/threads.js` is the single check.
- Channel placement is left to server admins via Discord's built-in per-command permissions (Server Settings → Integrations → the bot), which `/help` points out — deliberately no hardcoded channel names (servers name channels differently and renames would break it). A per-server `/setup` would need persistence.
- Bot-side cost guard: `src/utils/latchLimiter.js`, in-memory sliding windows — per server per hour (`LATCH_LIMIT_PER_SERVER_PER_HOUR`, default 30; DMs keyed per user) and across all servers per day (`LATCH_LIMIT_GLOBAL_PER_DAY`, default 500). Resets on restart.
- Backend errors are logged; users only see a friendly message (429 gets a "slow down" message). Every event handler's rejections are caught and logged in `src/handlers/index.js`, so a failed reply (missing permissions, deleted message) can't crash the process.
- Replies stream by editing the message ~every 1.2s and split across messages at 2,000 chars. All output uses `allowedMentions: { parse: [] }` so Latch can never ping.
- Only `Guilds` + `GuildMessages` intents — **no privileged Message Content intent**. Discord still delivers content for messages that @mention the bot, which is all mention-to-ask needs, so the bot never needs Discord's privileged-intent verification as it grows.

## Running
- `npm install`, copy `.env.example` → `.env`, fill in values (`AI_CLIENT_KEY_DISCORD` must match the backend's)
- `npm run deploy-commands` — registers every command in `src/commands` globally (rerun after adding/changing a command's definition)
- `npm run dev` (nodemon) or `npm start`
- Invite URL: Developer Portal → OAuth2 → URL Generator, scopes `bot` + `applications.commands`, permissions Send Messages, Embed Links, Attach Files, Read Message History, Create Public Threads, Send Messages in Threads. Turn on "Public Bot" so other servers can add it.

## Hosting
Local only for now. A public bot must be always-on before it's shared. Planned: container alongside the backend on the prod EC2 (compose network → `http://server:8080`), secrets via SSM in `BalisongFlippingCenterTerraformProd`.

## Known Gaps / To Do
- Hosting (above)
- Add expert tricks, then add `expert` back to `MID_COUNTS` in `comboGenerator.js`
- Balidare/combo stats (dares landed, streaks, leaderboards) — needs persistence
- Fun ideas: `/trick-of-the-day` (same trick per server per day), `/compare knife1 knife2`, `/knife random`, one-click "ask Latch how to do this trick" from a combo