// Tools the agent can call on this VPS. Each tool declares whether it needs the owner's
// confirmation (inline ✅/❌ button) before running.
import Anthropic from "@anthropic-ai/sdk";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { openStore } from "../brain/store.ts";

const sh = promisify(execFile);
const HOME = "/home/deploy";
const MAX_OUT = 12_000; // chars of tool output fed back to the model

export const DBS: Record<string, string> = {
  brain: `${HOME}/dino-brain-data/brain.db`,
  quotes: `${HOME}/quote-data/quotes.db`,
  events: `${HOME}/event-data/events.db`,
  dca: `${HOME}/dca-data/dca.db`,
  networth: `${HOME}/networth-data/networth.db`,
};

export const store = openStore(DBS.brain);

export const JOBS: Record<string, string[]> = {
  quote: [`${HOME}/projects/quote-of-the-day/bin/send-daily`],
  "events-daily": [`${HOME}/projects/event-reminder-bot/bin/daily`],
  "events-weekly": [`${HOME}/projects/event-reminder-bot/bin/weekly`],
  dca: [`${HOME}/projects/crypto-dca-bot/bin/execute`],
  "dca-dry-run": [`${HOME}/projects/crypto-dca-bot/bin/execute`, "--dry-run"],
  backup: [`${HOME}/projects/dino-brain/bin/backup-dbs`],
};

// Commands that change state, cost money, or are hard to undo → confirm first.
const DANGEROUS = /\b(rm|rmdir|mv|dd|mkfs|shred|truncate|kill|pkill|killall|reboot|shutdown|poweroff|systemctl\s+(?!status|is-active|list|show|cat)|crontab\s+(?!-l)|sudo|chmod|chown|apt|apt-get|dpkg|snap|npm\s+(install|uninstall|publish)|pip\s+install|git\s+(push|reset|rebase|checkout|clean|branch\s+-[dD]|stash)|curl[^|]*\|\s*(ba)?sh|wget[^|]*\|\s*(ba)?sh)\b|>\s*\S|\btee\b/;
const SECRET_PATH = /(^|\/)\.env(\.|$)|secret_key|\.ssh\/|id_rsa|\.gitconfig|\.claude\.json/;

export function isDangerous(command: string): boolean {
  return DANGEROUS.test(command);
}
export function touchesSecrets(s: string): boolean {
  return SECRET_PATH.test(s);
}

function clip(s: string): string {
  return s.length > MAX_OUT ? s.slice(0, MAX_OUT) + `\n…[truncated, ${s.length} chars total]` : s;
}

export const tools: Anthropic.Tool[] = [
  {
    name: "shell",
    description:
      "Run a bash command on the VPS as user deploy (cwd /home/deploy, 120s timeout). Destructive or state-changing commands ask the owner for confirmation first. Cannot read secret files (.env, ssh keys).",
    input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"], additionalProperties: false },
    strict: true,
  },
  {
    name: "read_file",
    description: "Read a text file (absolute path or ~/relative). Secret files are refused.",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false },
    strict: true,
  },
  {
    name: "write_file",
    description: "Write/overwrite a text file (creates parent dirs). Always asks for confirmation.",
    input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"], additionalProperties: false },
    strict: true,
  },
  {
    name: "query_sqlite",
    description: `Run SQL against one of the SQLite databases on this box: ${Object.keys(DBS).join(", ")}. SELECT/PRAGMA/EXPLAIN run immediately (read-only connection); anything else asks for confirmation. Returns rows as JSON (max 200 rows). Use "PRAGMA table_list" / "PRAGMA table_info(x)" to explore.`,
    input_schema: { type: "object", properties: { db: { type: "string", enum: Object.keys(DBS) }, sql: { type: "string" } }, required: ["db", "sql"], additionalProperties: false },
    strict: true,
  },
  {
    name: "run_job",
    description: `Run one of the cron jobs now via run-job (output also goes to the Telegram topics): ${Object.keys(JOBS).join(", ")}. Asks for confirmation (dca places real orders).`,
    input_schema: { type: "object", properties: { name: { type: "string", enum: Object.keys(JOBS) } }, required: ["name"], additionalProperties: false },
    strict: true,
  },
  {
    name: "tail_log",
    description: "Tail a cron job log from ~/dino-brain-data/logs/<name>.log, or a systemd unit's journal (name ending in .service).",
    input_schema: { type: "object", properties: { name: { type: "string" }, lines: { type: "integer" } }, required: ["name", "lines"], additionalProperties: false },
    strict: true,
  },
  {
    name: "search_brain",
    description:
      "Full-text search the owner's saved links (tweets, YouTube videos, articles) by keywords. FTS5 syntax: words are ANDed, use OR / \"quoted phrases\" / prefix* as needed. Searches title, summary, extracted content, tags, notes. Returns id, url, kind, title, summary, tags, date and a snippet. Try a couple of phrasings (synonyms, broader terms) before concluding something isn't saved.",
    input_schema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer" } }, required: ["query", "limit"], additionalProperties: false },
    strict: true,
  },
  {
    name: "list_brain",
    description: "List saved links newest-first, optionally filtered by kind (tweet|youtube|web), category, tag, or since (ISO date). Empty string = no filter.",
    input_schema: {
      type: "object",
      properties: { kind: { type: "string" }, category: { type: "string" }, tag: { type: "string" }, since: { type: "string" }, limit: { type: "integer" } },
      required: ["kind", "category", "tag", "since", "limit"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "get_bookmark",
    description: "Get one saved link by id including its full extracted content (article text / tweet / video transcript). Use when the summary isn't enough to answer.",
    input_schema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"], additionalProperties: false },
    strict: true,
  },
  {
    name: "brain_stats",
    description: "Counts of saved links by kind, category and top tags.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    name: "delete_bookmark",
    description: "Delete a saved link by id. Asks for confirmation.",
    input_schema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"], additionalProperties: false },
    strict: true,
  },
];

export type ToolInput = Record<string, unknown>;

/** Returns a human-readable description if this call needs confirmation, else null. */
export function needsConfirm(name: string, input: ToolInput): string | null {
  switch (name) {
    case "shell":
      return isDangerous(String(input.command)) ? `Run:\n${input.command}` : null;
    case "write_file":
      return `Write ${String(input.content).length} chars to ${input.path}`;
    case "query_sqlite":
      return /^\s*(select|pragma|explain|with)\b/i.test(String(input.sql)) ? null : `On ${input.db}:\n${input.sql}`;
    case "run_job":
      return `Run job "${input.name}"`;
    case "delete_bookmark": {
      const b = store.get(Number(input.id));
      return b ? `Delete bookmark #${b.id}: ${b.title}\n${b.url}` : null;
    }
    default:
      return null;
  }
}

export async function runTool(name: string, input: ToolInput): Promise<string> {
  switch (name) {
    case "shell": {
      const command = String(input.command);
      if (touchesSecrets(command)) return "refused: command references a secret file";
      try {
        const { stdout, stderr } = await sh("bash", ["-lc", command], { cwd: HOME, timeout: 120_000, maxBuffer: 8_000_000 });
        return clip((stdout + (stderr ? `\n[stderr]\n${stderr}` : "")).trim() || "(no output)");
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string; code?: number | string; message: string };
        return clip(`exit ${err.code ?? "?"}\n${err.stdout ?? ""}\n${err.stderr ?? err.message}`.trim());
      }
    }
    case "read_file": {
      const p = expand(String(input.path));
      if (touchesSecrets(p)) return "refused: secret file";
      return clip(await readFile(p, "utf8"));
    }
    case "write_file": {
      const p = expand(String(input.path));
      if (touchesSecrets(p)) return "refused: secret file";
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, String(input.content));
      return `wrote ${p}`;
    }
    case "query_sqlite": {
      const path = DBS[String(input.db)];
      if (!path) return `unknown db ${input.db}`;
      const sql = String(input.sql);
      const readonly = /^\s*(select|pragma|explain|with)\b/i.test(sql);
      const db = new Database(path, { readonly, fileMustExist: true });
      try {
        const stmt = db.prepare(sql);
        if (stmt.reader) {
          const rows = stmt.all();
          return clip(JSON.stringify(rows.slice(0, 200)) + (rows.length > 200 ? `\n…${rows.length} rows total` : ""));
        }
        return `ok: ${stmt.run().changes} rows changed`;
      } finally {
        db.close();
      }
    }
    case "run_job": {
      const cmd = JOBS[String(input.name)];
      if (!cmd) return `unknown job ${input.name}`;
      try {
        const { stdout } = await sh(`${HOME}/projects/dino-brain/bin/run-job`, [String(input.name), ...cmd], { timeout: 300_000 });
        return clip(stdout || "ok");
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string; code?: number };
        return clip(`job failed (exit ${err.code})\n${err.stdout ?? ""}${err.stderr ?? ""}`);
      }
    }
    case "tail_log": {
      const n = Math.min(Math.max(Number(input.lines) || 50, 1), 500);
      const name = String(input.name);
      const args = name.endsWith(".service")
        ? ["journalctl", "-u", name, "-n", String(n), "--no-pager", "-q"]
        : ["tail", "-n", String(n), `${HOME}/dino-brain-data/logs/${name}.log`];
      try {
        const { stdout } = await sh(args[0], args.slice(1));
        return clip(stdout || "(empty)");
      } catch (e) {
        return `error: ${(e as Error).message}`;
      }
    }
    case "search_brain": {
      const rows = store.search(String(input.query), Math.min(Number(input.limit) || 10, 30));
      if (!rows.length) return "no matches";
      return clip(JSON.stringify(rows.map(({ content, ...b }) => b)));
    }
    case "list_brain": {
      const o = (k: string) => (String(input[k] ?? "").trim() || undefined);
      const rows = store.list({ kind: o("kind"), category: o("category"), tag: o("tag"), since: o("since"), limit: Number(input.limit) || 20 });
      if (!rows.length) return "no bookmarks";
      return clip(JSON.stringify(rows.map(({ content, ...b }) => b)));
    }
    case "get_bookmark": {
      const b = store.get(Number(input.id));
      return b ? clip(JSON.stringify(b)) : `no bookmark #${input.id}`;
    }
    case "brain_stats":
      return JSON.stringify(store.stats());
    case "delete_bookmark":
      return store.remove(Number(input.id)) ? `deleted #${input.id}` : `no bookmark #${input.id}`;
    default:
      return `unknown tool ${name}`;
  }
}

function expand(p: string): string {
  return resolve(p.startsWith("~") ? HOME + p.slice(1) : p);
}
