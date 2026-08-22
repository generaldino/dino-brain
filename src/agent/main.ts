// @Agend_dino_bot — conversational agent over this VPS (Claude Sonnet + tools).
// DM-only, owner-only. Conversation history persisted in ~/dino-brain-data/brain.db.
import Anthropic from "@anthropic-ai/sdk";
import { Bot, InlineKeyboard, type Context } from "grammy";
import Database from "better-sqlite3";
import { tools, runTool, needsConfirm, DBS, JOBS, type ToolInput } from "./tools.ts";

const TOKEN = must("AGENT_BOT_TOKEN");
const OWNER_ID = Number(must("TELEGRAM_USER_ID"));
const MODEL = process.env.AGENT_MODEL ?? "claude-sonnet-5";
const DATA_DIR = process.env.DINO_DATA_DIR ?? "/home/deploy/dino-brain-data";
const MAX_HISTORY = 60; // messages kept in context (oldest trimmed)
const CONFIRM_TIMEOUT_MS = 10 * 60 * 1000;
const TG_LIMIT = 4000;

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

// ---------------------------------------------------------------- persistence
const db = new Database(`${DATA_DIR}/brain.db`);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation, id);
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);
const currentConversation = (): number =>
  (db.prepare("SELECT COALESCE(MAX(conversation), 1) c FROM messages").get() as { c: number }).c;
let conversation = currentConversation();

function loadHistory(): Anthropic.MessageParam[] {
  const rows = db
    .prepare("SELECT role, content FROM messages WHERE conversation = ? ORDER BY id DESC LIMIT ?")
    .all(conversation, MAX_HISTORY) as { role: "user" | "assistant"; content: string }[];
  const msgs = rows.reverse().map((r) => ({ role: r.role, content: JSON.parse(r.content) }) as Anthropic.MessageParam);
  // History must start with a user turn whose content is not a dangling tool_result.
  while (msgs.length && (msgs[0].role !== "user" || isToolResult(msgs[0]))) msgs.shift();
  return msgs;
}
function isToolResult(m: Anthropic.MessageParam): boolean {
  return Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result");
}
const insert = db.prepare("INSERT INTO messages (conversation, role, content) VALUES (?, ?, ?)");
function save(m: Anthropic.MessageParam) {
  insert.run(conversation, m.role, JSON.stringify(m.content));
}

// ---------------------------------------------------------------- Claude
const client = new Anthropic();
const SYSTEM = `You are Dino's personal assistant ("dino-brain"), running on his Ubuntu VPS and reachable via Telegram. You can run commands, read/write files, query SQLite databases and trigger cron jobs on this machine.

## The box
- User: deploy. Home: /home/deploy. Timezone for the owner: Asia/Dubai (cron runs in UTC; 02:00 UTC = 06:00 Dubai).
- Projects in ~/projects/<name> (git repos, main checkout on main; edits happen in worktrees under <repo>/.claude/worktrees/ — prefer not to edit main checkouts directly):
  - dino-brain: this agent + the cron-bot (@Dino_cron_bot) that posts to the "Cronies" Telegram forum group. Local API on 127.0.0.1:8787 (POST /notify {topic,text}). run-job wrapper: ~/projects/dino-brain/bin/run-job. Logs: ~/dino-brain-data/logs/<job>.log
  - quote-of-the-day: daily quote at 06:00 Dubai; db "quotes" (table quotes: text, author, source, note, sent, sent_at)
  - event-reminder-bot: birthdays/anniversaries; db "events" (table events: name, type, day, month, year, notes); daily + Friday 2-week lookahead
  - crypto-dca-bot: daily OKX market buys; db "dca" (tables purchases, transactions); config at ~/projects/crypto-dca-bot/config.yaml
  - networth: net worth & spending tracker (systemd service "networth", FastAPI on :8000); db "networth" at ~/networth-data/networth.db (read-only unless asked)
- SQLite DBs available to query_sqlite: ${Object.keys(DBS).join(", ")}. Cron jobs available to run_job: ${Object.keys(JOBS).join(", ")}.
- systemd units: dino-brain-cron-bot, dino-brain-agent, quote-bot, event-bot, networth.
- Secrets live in ~/*-data/.env and are off-limits; never try to read or print them.

## How to behave
- Be terse. Telegram replies: plain text, short lines, no markdown tables. Lead with the answer.
- Use tools freely for read-only work; destructive/financial actions will prompt the owner for a ✅/❌ confirmation automatically — don't ask in prose, just call the tool.
- When asked about "today"/"tomorrow" use Dubai time: ${"${NOW}"}.
- If something fails, say what failed and what you tried; don't speculate.`;

function systemPrompt(): Anthropic.TextBlockParam[] {
  const now = new Date().toLocaleString("en-GB", { timeZone: "Asia/Dubai", dateStyle: "full", timeStyle: "short" });
  const [stable, volatile] = SYSTEM.split("${NOW}");
  return [
    { type: "text", text: stable, cache_control: { type: "ephemeral" } },
    { type: "text", text: now + volatile },
  ];
}

// ---------------------------------------------------------------- Telegram
const bot = new Bot(TOKEN);
bot.use(async (ctx, next) => {
  if (ctx.from?.id !== OWNER_ID || ctx.chat?.type !== "private") return;
  await next();
});

// Pending confirmations: id -> resolver
const pending = new Map<string, (ok: boolean) => void>();
let confirmSeq = 0;

async function askConfirm(ctx: Context, what: string): Promise<boolean> {
  const id = `c${++confirmSeq}`;
  const kb = new InlineKeyboard().text("✅ Yes", `${id}:y`).text("❌ No", `${id}:n`);
  const msg = await ctx.reply(`Confirm?\n\n${what}`.slice(0, TG_LIMIT), { reply_markup: kb });
  return new Promise<boolean>((resolve) => {
    const t = setTimeout(() => { pending.delete(id); resolve(false); }, CONFIRM_TIMEOUT_MS);
    pending.set(id, (ok) => {
      clearTimeout(t);
      pending.delete(id);
      ctx.api.editMessageText(msg.chat.id, msg.message_id, `${ok ? "✅ Confirmed" : "❌ Declined"}\n\n${what}`.slice(0, TG_LIMIT)).catch(() => {});
      resolve(ok);
    });
  });
}

bot.on("callback_query:data", async (ctx) => {
  const [id, ans] = ctx.callbackQuery.data.split(":");
  const r = pending.get(id);
  await ctx.answerCallbackQuery();
  if (r) r(ans === "y");
});

bot.command("reset", async (ctx) => {
  conversation = currentConversation() + 1;
  await ctx.reply(`🧹 New conversation #${conversation}.`);
});
bot.command("start", (ctx) => ctx.reply("Hi. I'm your VPS brain. Ask me anything about the box, the data, or the cron jobs. /reset clears context."));
bot.command("ping", (ctx) => ctx.reply("pong"));

// Serialize turns: one at a time.
let chain: Promise<unknown> = Promise.resolve();
bot.on("message:text", (ctx) => {
  if (ctx.message.text.startsWith("/")) return;
  chain = chain.then(() => handleTurn(ctx)).catch((e) => log("turn failed:", e));
});

async function handleTurn(ctx: Context) {
  const text = ctx.message!.text!;
  const messages = loadHistory();
  const userMsg: Anthropic.MessageParam = { role: "user", content: text };
  messages.push(userMsg);
  save(userMsg);

  const typing = setInterval(() => ctx.replyWithChatAction("typing").catch(() => {}), 4000);
  ctx.replyWithChatAction("typing").catch(() => {});
  try {
    for (let i = 0; i < 25; i++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: systemPrompt(),
        tools,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        messages,
      });
      const assistantMsg: Anthropic.MessageParam = { role: "assistant", content: response.content };
      messages.push(assistantMsg);
      save(assistantMsg);

      const texts = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

      if (response.stop_reason === "refusal") { await reply(ctx, "I can't help with that one."); return; }
      if (!toolUses.length || response.stop_reason === "end_turn") {
        await reply(ctx, texts || "(done)");
        if (response.stop_reason === "max_tokens") await reply(ctx, "…(output truncated)");
        return;
      }
      if (texts) await reply(ctx, texts); // interim narration before tools

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const input = tu.input as ToolInput;
        const why = needsConfirm(tu.name, input);
        let out: string;
        let isError = false;
        if (why && !(await askConfirm(ctx, why))) {
          out = "Owner declined this action.";
          isError = true;
        } else {
          try {
            out = await runTool(tu.name, input);
          } catch (e) {
            out = `error: ${(e as Error).message}`;
            isError = true;
          }
        }
        log(`tool ${tu.name}`, JSON.stringify(input).slice(0, 200), "->", out.slice(0, 120).replace(/\n/g, " "));
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out, is_error: isError || undefined });
      }
      const resultMsg: Anthropic.MessageParam = { role: "user", content: results };
      messages.push(resultMsg);
      save(resultMsg);
    }
    await reply(ctx, "Stopped after 25 tool rounds — ask me to continue if needed.");
  } catch (e) {
    const err = e as Error & { status?: number };
    log("claude error:", err.message);
    await reply(ctx, `⚠️ ${err.status ? `API ${err.status}: ` : ""}${err.message}`.slice(0, 500));
  } finally {
    clearInterval(typing);
  }
}

async function reply(ctx: Context, text: string) {
  for (let i = 0; i < text.length; i += TG_LIMIT) {
    await ctx.reply(text.slice(i, i + TG_LIMIT), { link_preview_options: { is_disabled: true } });
  }
}

bot.catch((err) => log("bot error:", err.error));
bot.start({ onStart: (me) => log(`agent polling as @${me.username}, model ${MODEL}, conversation #${conversation}`) });
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { bot.stop(); process.exit(0); });
