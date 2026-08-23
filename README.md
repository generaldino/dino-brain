# dino-brain — ARCHIVED 2026-08-23

Superseded. Split into:
- `~/projects/cron-relay` — cron bot + run-job + backups (`~/cron-relay-data/`)
- `~/projects/second-brain` — bookmarks store + `bin/brain` CLI (`~/brain-data/`)
- `~/projects/hermes-config` + `~/.hermes` — Hermes Agent replaces `src/agent/` (conversational AI)

Old data dir kept at `~/dino-brain-data.archived/`. Services `dino-brain-agent` / `dino-brain-cron-bot` are disabled.

---

# dino-brain

Telegram-driven "second brain" for this VPS. See `PLAN.md` for the full design.

## Components
- `src/agent/main.ts` + `src/agent/tools.ts` — @Agend_dino_bot. DM-only, owner-only. Claude Sonnet (`claude-sonnet-5`) with tools:
  `shell`, `read_file`, `write_file`, `query_sqlite` (brain/quotes/events/dca/networth), `run_job`, `tail_log`.
  Destructive shell commands, file writes, non-SELECT SQL and job runs get an inline ✅/❌ confirmation first.
  Secret files (`.env`, ssh keys) are refused. History persisted in `~/dino-brain-data/brain.db`; `/reset` starts a new conversation.
- `src/brain/` — **second brain**. Any DM to the agent containing a URL is saved: content fetched
  (tweets via fxtwitter API, YouTube via `~/.local/bin/yt-dlp` incl. auto-captions, pages via Readability),
  summarised + categorised + tagged by Claude, stored in `bookmarks` (+ FTS5 index) in `brain.db`.
  Extra text in the message is kept as a note. Ask the agent in plain language ("that tweet about…",
  "what did I save on crypto last month?") — it uses `search_brain` / `list_brain` / `get_bookmark`.
  `/stats` shows counts. `bin/brain-add <url>... [-n note]` and `bin/brain-add search <q>` from the shell.
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
0. `curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ~/.local/bin/yt-dlp && chmod +x ~/.local/bin/yt-dlp` (YouTube transcripts; update occasionally with `yt-dlp -U`)
1. Fill `~/dino-brain-data/.env` (see PLAN.md).
2. `npm install`
3. `sudo cp deploy/dino-brain-cron-bot.service deploy/dino-brain-agent.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now dino-brain-cron-bot dino-brain-agent`
3b. (old) `sudo cp deploy/dino-brain-cron-bot.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now dino-brain-cron-bot`
4. In the forum group (Topics enabled, bot is admin) send `/topics` — creates the topics and writes `~/dino-brain-data/telegram.json`.
