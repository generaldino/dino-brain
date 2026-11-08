# dino-brain — RETIRED (archived 2026-08-23), do not build on it

Legacy Telegram "second brain" + cron bot. Nothing runs from this repo: no crontab line, services
`dino-brain-agent` / `dino-brain-cron-bot` are no longer installed, old data sits in `~/dino-brain-data.archived/`.
Replaced by:
- `~/projects/cron-relay` — cron bot / Telegram relay (:8787), `bin/run-job`, nightly `bin/backup-dbs`.
- `~/projects/second-brain` — bookmarks store and `bin/brain` CLI.
- Hermes (`~/projects/hermes-config`, Clara) — replaces the conversational agent in `src/agent/`.
Make changes in those repos instead. History/design: README.md, PLAN.md.

Keep this file current: update it in the same change when layout, commands or deploy change.
