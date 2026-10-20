# Balisong-Bot — Claude Notes

A public Discord bot that any server can add: a general balisong resource powered by **Latch** (the BFC AI) plus non-AI catalog commands. discord.js v14, Node 22. It is **not** BFC app support — no site features, accounts, bug reports, or moderation. Part of the BFC project alongside `BalisongFlippingCenterServer` (Spring Boot), `BalisongFlippingCenterWeb` (React), and `BalisongFlippingCenterAIPython` (Latch).

## Commands (registered globally)
| Command | What it does |
|---|---|
| `/latch question:` or @mention | Ask Latch (streams the reply) |
| `/latch-reset` | Clears your Latch conversation in this channel (ephemeral). Calls the backend's `DELETE /ai/chat/session/{sessionId}`, which only lets a client clear sessions prefixed with its own client ID |
| `/knife name:` | Catalog lookup → embed (current version specs, variants + MSRP, other versions). Autocomplete via `/catalog/any/knives?search=` |
| `/maker name:` | Maker embed with their knives. Autocomplete from `/catalog/any/makers` |
| `/learn topic:` | Static explainers from `src/content/learnTopics.js`; topics with a `learnSlug` link to the site's `/learn/<slug>` page |
| `/help` | Ephemeral command list |

## Latch integration
- Calls the backend's `POST /ai/chat` with `X-Client-Id: discord` / `X-Client-Key: AI_CLIENT_KEY_DISCORD`. The backend forwards `client: "discord"` to the AI service, which then uses a separate Discord persona (general balisong expert, Discord markdown) with only the catalog tools plus a Brave-backed `web_search` tool — see the AI service README.
- `sessionId` = `discord-<channelId>-<userId>`: per-user conversation memory per channel (24h in Redis), and the backend's 10/min rate limit applies per session.
- Bot-side cost guard: `src/utils/latchLimiter.js`, in-memory sliding windows — per server per hour (`LATCH_LIMIT_PER_SERVER_PER_HOUR`, default 30; DMs keyed per user) and across all servers per day (`LATCH_LIMIT_GLOBAL_PER_DAY`, default 500). Resets on restart.
- Backend errors are logged; users only see a friendly message (429 gets a "slow down" message). Every event handler's rejections are caught and logged in `src/handlers/index.js`, so a failed reply (missing permissions, deleted message) can't crash the process.
- Replies stream by editing the message ~every 1.2s and split across messages at 2,000 chars. All output uses `allowedMentions: { parse: [] }` so Latch can never ping.
- Only `Guilds` + `GuildMessages` intents — **no privileged Message Content intent**. Discord still delivers content for messages that @mention the bot, which is all mention-to-ask needs, so the bot never needs Discord's privileged-intent verification as it grows.

## Running
- `npm install`, copy `.env.example` → `.env`, fill in values (`AI_CLIENT_KEY_DISCORD` must match the backend's)
- `npm run deploy-commands` — registers every command in `src/commands` globally (rerun after adding/changing a command's definition)
- `npm run dev` (nodemon) or `npm start`
- **Never run locally with the prod token while the hosted bot is up** — both connections receive every interaction and race to answer it. Use a separate dev application/token for local testing.
- Invite URL: Developer Portal → OAuth2 → URL Generator, scopes `bot` + `applications.commands`, permissions Send Messages, Embed Links, Read Message History. Turn on "Public Bot" so other servers can add it.

## Hosting
- Runs as a Docker container on the **prod backend EC2 instance** (`balisong-prod-server`), as its own compose project in `/home/ec2-user/discord-bot/` — separate from the backend's compose file, so deploys of one never restart the other. Reaches the backend at `http://host.docker.internal:8080/api` (the host's published 8080), not through CloudFront. `mem_limit: 256m`, json-file logs capped at 3×10 MB; `docker logs discord-bot` on the instance.
- **Deploy**: `.github/workflows/deploy.yml` on push to `main` (or manual dispatch): check (syntax + load every command definition) → build and push to ECR (`AWS_ECR_REPOSITORY_URL` repo var, tagged with the SHA and `latest`) via OIDC (`AWS_BOT_DEPLOY_ROLE_ARN`) → SSM `send-command` runs `deploy/remote-deploy.sh` on the instance, found by its `Name` tag (no stored instance ID to go stale). The script rewrites the compose file (pinned to the SHA tag) and `.env`, pulls, `up -d`, registers slash commands (`deploy-commands.js` in the new image), and fails the deploy unless the logs show "Logged in" within 60s. Because it writes everything itself, a rebuilt instance is set up again by the next deploy; the backend's `user_data` knows nothing about the bot.
- **Config/secrets**: `/balisong/prod/discord-bot/*` in SSM (CLIENT_ID, BFC_API_BASE_URL, BFC_SITE_URL, the two Latch limits — `infra/ssm_parameters.tf`; TOKEN — `secrets/`, value set with `aws ssm put-parameter`) plus the shared `/balisong/prod/AI_CLIENT_KEY_DISCORD`, re-read into `.env` on every deploy. Change a value → rerun the deploy workflow.
- In-memory state (Latch limits, quiz rounds, B.A.L.I. games, dare cooldowns) resets on every deploy/restart.
- Cost: shares the existing t3.small; ECR storage is cents/month. The real variable cost is Latch (Bedrock + Brave) — `LATCH_LIMIT_GLOBAL_PER_DAY` is the ceiling.

