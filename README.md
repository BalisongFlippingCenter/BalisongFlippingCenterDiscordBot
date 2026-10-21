# 🗡 Balisong Bot

A public Discord bot for balisong (butterfly knife) flippers — ask **Latch**, the Balisong Flipping Center AI, anything about balisongs, look up knives from the BFC catalog, and challenge your server with combos, dares, quizzes, and games.

**[➕ Add it to your server](https://discord.com/oauth2/authorize?client_id=1511180293107617853&permissions=309237762048&scope=bot%20applications.commands)** · Part of [Balisong Flipping Center](https://github.com/BalisongFlippingCenter) · 🌐 [balisongflippingcenter.com](https://www.balisongflippingcenter.com)

It's a general balisong resource for any server — not support for the BFC website, and it doesn't do moderation.

---

## Commands

| | Command | What it does |
|---|---|---|
| **Latch AI** | `/latch question:` or @mention | Ask Latch anything — answers stream in a thread, and it remembers the conversation there. Rate answers 👍/👎; ratings export as eval cases |
| | `/latch-reset` | Make Latch forget your conversation in this channel/thread |
| **Catalog** | `/knife name:` | Specs, versions, variants, and MSRP for a balisong |
| | `/maker name:` | A maker and their knives |
| | `/compare knife1: knife2:` | Two knives side by side |
| | `/recommend [budget] [pivot] [handle]` | Find knives that match what you want |
| **Learning** | `/learn topic:` | Quick explainers — anatomy, pivot systems, pin systems, latches, first knife |
| | `/trick info` · `/trick random` | A trick's level, variants, and an **Ask Latch how** button |
| | `/trick-of-the-day [level]` | The same trick for everyone, everywhere, each day — post your landing clip |
| **Challenges** | `/combo level:` | A random combo for your skill level; land it and upload your clip as proof |
| | `/balidare combo\|video user:` | Dare someone to land a combo — or match your clip. They answer with a video |
| **Games** | `/bali` | B.A.L.I. — H.O.R.S.E. for flipping: miss a trick, earn a letter |
| | `/quiz [questions]` | A timed multiple-choice quiz from the knife catalog, with a leaderboard |
| **Admin** | `/setup` | Post the trick of the day in a channel every day, and keep Latch and games to their own channels |
| | `/help` | Everything above |

**Server admins:** `/setup` (Manage Server) covers the daily trick post and Latch/games channels. For roles or finer per-command control, use *Server Settings → Integrations → Balisong Flipping Center Bot*.

---

## How it works

```
 Discord ◀──── gateway (Guilds + GuildMessages intents) ────▶ Bot container
                                                               │  discord.js v14 · Node 22
                                                               │  http://host.docker.internal:8080
                                          ┌────────────────────▼───────────────────┐
                                          │  Spring Boot API  (same EC2 instance)    │
                                          │  /catalog/any/**   ·   /ai/chat (relay)  │
                                          └────────────────────┬───────────────────┘
                                                               │ X-Client-Id: discord
                                          ┌────────────────────▼───────────────────┐
                                          │  Latch AI service — FastAPI             │──▶ Claude (AWS Bedrock)
                                          │  Discord persona: catalog tools +       │──▶ Brave web search
                                          │  web search, Redis conversation memory  │
                                          └─────────────────────────────────────────┘
```

- **One AI service, two clients.** The website and this bot both talk to the same Latch service through the backend, which checks a per-client key and rate-limits each session. The client ID picks the persona: on Discord, Latch is a general balisong expert with the catalog tools plus web search, and none of the site-only tools.
- **No privileged intents.** The bot never requests Message Content — Discord still delivers messages that @mention it, which is all mention-to-ask needs — so it can grow without privileged-intent verification. Every reply uses `allowedMentions: { parse: [] }`, so Latch can never ping; balidares and B.A.L.I. ping only the specific players who need to act.
- **Streaming in threads.** Latch answers in a thread opened on the question, streamed by editing the message every ~1.2s and split at Discord's 2,000-character limit. Memory is keyed per thread and user, so follow-ups just work.
- **Cost guards.** In-memory sliding-window limits per server per hour and across all servers per day put a ceiling on model spend, on top of the backend's per-session rate limit.
- **State lives in the message.** Combo and balidare cards are Components V2 messages; owners, targets, and levels ride in button custom IDs, and landing clips are re-uploaded into the card's media gallery (modal-upload URLs expire). Restarting the bot loses nothing for them. Quiz rounds and B.A.L.I. games are short-lived and kept in memory.
- **Combo generation.** A curated trick list with levels, opener/mid/closer roles, finger variants that carry their own level, and families (so a combo never repeats a Chaplin). Every combo stays at or below the chosen level and always includes a trick at it.

## Hosting & deploys

- Runs as a **Docker container on the existing production backend EC2 instance**, as its own Compose project — no extra servers, and bot deploys never restart the backend.
- **GitHub Actions** on every push to `main`: syntax check + load every command definition + unit tests → build and push the image to **ECR** → **SSM Run Command** writes the Compose file and settings, pulls, restarts, re-registers slash commands, and fails the deploy unless the bot logs in within 60s.
- AWS access is via **GitHub OIDC** — no long-lived keys. The deploy role is scoped to this repo's `main` branch, this repo's ECR repository, and the one instance, which the workflow finds by its `Name` tag.
- Secrets (the bot token, the shared Latch client key) live in **SSM Parameter Store** and are re-read on every deploy. Infrastructure is in Terraform in the org's infra repo.

## Running locally

```bash
npm install
cp .env.example .env        # fill in values; AI_CLIENT_KEY_DISCORD must match the backend's
npm run deploy-commands     # register slash commands (rerun after changing a command's definition)
npm run dev                 # or: npm start
npm test                    # unit tests (node:test, no extra dependencies)
npm run export-feedback     # rated Latch answers as stub eval cases
```

Use a **separate Discord application/token** for local development — running locally with the production token while the hosted bot is up makes both answer every interaction.

## Project layout

```
index.js                 client setup and login
deploy-commands.js       registers every command globally
src/commands/            one file per slash command (plus its button/modal handlers)
src/events/              interactionCreate (routes commands, buttons, modals) · messageCreate (@mentions) · guildDelete
src/utils/               Latch streaming + limits, catalog client, combo generator, cards, threads
src/db.js                SQLite (node:sqlite) — per-server settings, Latch answers and ratings
src/content/             trick list and /learn explainers
scripts/backup-db.js     consistent snapshot for the nightly S3 backup
scripts/export-feedback.js  rated Latch answers as stub eval cases
deploy/remote-deploy.sh  runs on the instance during a deploy
```
