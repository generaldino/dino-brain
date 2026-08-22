# dino-brain — plan

Personal "second brain" on this VPS, driven from Telegram. Decided 2026-08-22.

## Decisions
- **Telegram**, two bots:
  - `@…BrainBot` — conversational agent (Claude Sonnet, tool use). DM only, allowlisted to user id `7366387849`.
  - `@…CronBot` — single bot for all scheduled output. Posts into a **forum group** (Topics enabled), one topic per feed:
    `💬 Quote` · `🎂 Events` · `₿ DCA` · `⚠️ Alerts` · `📋 Cron log`.
    Inbound messages in a topic are forwarded to the owning project (routing by `message_thread_id`), so each project keeps its own `/add`-style command flows. No LLM tokens for CRUD.
- **One repo per project, one SQLite DB per project**, data outside the repo (`~/<name>-data/`), same pattern as networth:

  | repo (`~/projects/`) | data dir | role |
  |---|---|---|
  | `dino-brain` | `~/dino-brain-data/` | agent + cron-bot + `run-job` wrapper |
  | `quote-of-the-day` | `~/quote-data/quotes.db` | daily quote + quote CRUD bot |
  | `event-reminder-bot` | `~/event-data/events.db` | birthdays/anniversaries reminders + CRUD bot |
  | `crypto-dca-bot` | `~/dca-data/dca.db` | daily OKX market buys |
- Node 24 / TypeScript everywhere (matches the existing code). `better-sqlite3`, `grammY` for Telegram, Anthropic SDK.
- Timezone **Asia/Dubai** for the agent and for human-facing times; crontab stays UTC (`0 2 * * *` = 06:00 Dubai, same as today).
- Agent may read **everything** on the box (all four DBs read-only via `query_sqlite`, shell, files). Anything destructive, any DB write, any `git push`/`systemctl`/`rm`, anything under `*-data/` → **inline ✅/❌ confirm button** first. `.env` files are on a denied-read list.
- Start basic: conversation history persisted in `brain.db`, `/reset`. No long-term memory/skills yet (can add Hermes/OpenClaw-style layer later; `/notify` API keeps that door open).

## Migration per project
### quote-of-the-day — port
- Source: github.com/generaldino/quote-of-the-day (Cloudflare Worker + D1). Drop `share.ts` (image share page).
- D1 → better-sqlite3, same schema (`quotes`, `conversation_state`). `scheduled()` → `bin/send-daily`. `fetch()` → localhost HTTP listener receiving forwarded updates from cron-bot.
- Keep all commands: `/add /list /edit /delete /random /search /stats` with multi-step flows.
- Import `daily-quote.sql` (153 quotes, 45 already sent — cycle state preserved).

### event-reminder-bot — port
- Source: github.com/generaldino/event-reminder-bot. Same treatment. Keep `/add /list /upcoming /edit /delete` flows.
- Crons: daily today/tomorrow (`0 2 * * *`), Friday 2-week lookahead (`0 2 * * 5`).
- Import `key-dates.sql` (68 events).

### crypto-dca-bot — rewrite small (≤ ~400 lines)
- Current code is bloated (two variants, Kraken client, sandbox, scheduler matrix, YAML-vs-DB duality). New scope: **buy fixed AED amounts daily on OKX**.
- `config.yaml` seeded from the live DB export, NOT the stale YAML in the old repo: **BTC 65 AED, ETH 15 AED, SOL 15 AED, daily**.
- `okx.ts`: HMAC auth, `POST /api/v5/trade/order` (market, `tgtCcy=quote_ccy`), then `GET /api/v5/trade/order` to record fill price/qty immediately. One retry on network error, then alert.
- `transactions` table keeps the existing columns so history imports 1:1. Note: 495/540 imported rows are `SUBMITTED` with no price/qty (old bot never reconciled). Optional one-off backfill from OKX order history.
- Telegram: daily summary into `₿ DCA`; `/config`, `/history` read-only commands. Changing amounts = edit `config.yaml` (agent can do it with confirm).
- `--dry-run` flag for testing; cutover is same-day: disable the Cloudflare cron trigger the day the VPS cron goes live (avoid double-buy). Reuse existing production OKX API key.

### dino-brain
- `cron-bot/`: long-polls CronBot; `POST 127.0.0.1:8787/notify {topic, text, keyboard?}` for any script on the box; forwards topic messages/callbacks to the owning project's localhost port; posts `run-job` failures to `⚠️ Alerts`.
- `bin/run-job <name> <cmd…>`: timestamps, log to `~/dino-brain-data/logs/<name>.log`, alert on non-zero exit.
- `agent/`: long-polls BrainBot; tools `shell`, `read_file`, `write_file`, `query_sqlite(db, sql)`, `run_job`, `tail_log`; confirm gating as above; replies chunked at 4096 chars.
- systemd: `dino-brain-agent.service`, `dino-brain-cron-bot.service`, plus one small service per project for their Telegram listeners.

## Crontab (UTC)
```
0  2 * * *  run-job quote          ~/projects/quote-of-the-day/bin/send-daily
0  2 * * *  run-job events-daily   ~/projects/event-reminder-bot/bin/daily
0  2 * * 5  run-job events-weekly  ~/projects/event-reminder-bot/bin/weekly
5  2 * * *  run-job dca            ~/projects/crypto-dca-bot/bin/execute
30 3 * * *  run-job backup         ~/projects/dino-brain/bin/backup-dbs
```

## Secrets (never in git)
- `~/dino-brain-data/.env` — `ANTHROPIC_API_KEY`, `AGENT_BOT_TOKEN`, `CRON_BOT_TOKEN`, `TELEGRAM_USER_ID`, `TELEGRAM_GROUP_ID`, topic ids
- `~/quote-data/.env`, `~/event-data/.env` — `CRON_BOT_TOKEN`, `TELEGRAM_GROUP_ID`, own topic id
- `~/dca-data/.env` — the above + `OKX_API_KEY`, `OKX_API_SECRET`, `OKX_API_PASSPHRASE`

## Build order
1. `dino-brain`: cron-bot + `/notify` + `run-job` + systemd. Create forum group, topics, `/topics` helper to print ids.
2. `quote-of-the-day` port + import + cron; disable CF worker cron.
3. `event-reminder-bot` port + import + cron; disable CF worker cron.
4. `dino-brain/agent`.
5. `crypto-dca-bot` rewrite; same-day cutover from Cloudflare.
6. `bin/backup-dbs` nightly `.backup` of all four DBs to `~/backups/`.
