# dino-brain

Telegram-driven "second brain" for this VPS. See `PLAN.md` for the full design.

## Components
- `src/agent/main.ts` + `src/agent/tools.ts` — @Agend_dino_bot. DM-only, owner-only. Claude Sonnet (`claude-sonnet-5`) with tools:
  `shell`, `read_file`, `write_file`, `query_sqlite` (brain/quotes/events/dca/networth), `run_job`, `tail_log`.
  Destructive shell commands, file writes, non-SELECT SQL and job runs get an inline ✅/❌ confirmation first.
  Secret files (`.env`, ssh keys) are refused. History persisted in `~/dino-brain-data/brain.db`; `/reset` starts a new conversation.
- `src/cron-bot.ts` — @Dino_cron_bot. Long-polls Telegram, exposes a localhost API on `:8787`
  so any script can post into a forum topic without holding credentials, and forwards inbound
  topic messages to the owning project (`config/routes.json`).
- `bin/run-job <name> <cmd…>` — cron wrapper: logs to `~/dino-brain-data/logs/`, posts ✅/❌ to topics.
- `bin/backup-dbs` — nightly `.backup` snapshot of all SQLite DBs to `~/backups/<date>/` (14-day retention), via `deploy/crontab`.
- `deploy/` — systemd units + crontab line.

## API (127.0.0.1:8787)
```
GET  /health
POST /notify       {"topic":"quote","text":"<b>hi</b>"}          # HTML parse mode by default
POST /tg/<method>  any Bot API method; "topic" expands to chat_id + message_thread_id
```
Topics: `quote` `events` `dca` `alerts` `cronlog`.

## Setup
1. Fill `~/dino-brain-data/.env` (see PLAN.md).
2. `npm install`
3. `sudo cp deploy/dino-brain-cron-bot.service deploy/dino-brain-agent.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now dino-brain-cron-bot dino-brain-agent`
3b. (old) `sudo cp deploy/dino-brain-cron-bot.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now dino-brain-cron-bot`
4. In the forum group (Topics enabled, bot is admin) send `/topics` — creates the topics and writes `~/dino-brain-data/telegram.json`.
