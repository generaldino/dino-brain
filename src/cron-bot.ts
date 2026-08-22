// @Dino_cron_bot — single Telegram bot for all scheduled output on this VPS.
//
//  * Long-polls Telegram. Only the allowlisted user is listened to.
//  * Exposes a localhost HTTP API so any script on the box can post without
//    holding Telegram credentials:
//      POST /notify        {topic, text, parse_mode?, reply_markup?}  -> sendMessage into that forum topic
//      POST /tg/<method>   any Bot API method; if body has "topic" it is replaced by chat_id + message_thread_id
//      GET  /health
//  * Forwards inbound messages/callbacks from a forum topic to the project that
//    owns it (config/routes.json), as a raw Telegram Update JSON POST.
//  * `/topics` (from the owner, inside the forum group) creates any missing
//    topics and saves ids to ~/dino-brain-data/telegram.json.

import { Bot, type Context } from "grammy";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = process.env.DINO_DATA_DIR ?? "/home/deploy/dino-brain-data";
const STATE_FILE = join(DATA_DIR, "telegram.json");
const PORT = Number(process.env.CRON_BOT_PORT ?? 8787);

const TOKEN = must("CRON_BOT_TOKEN");
const OWNER_ID = Number(must("TELEGRAM_USER_ID"));

const TOPICS: Record<string, string> = {
  quote: "💬 Quote",
  events: "🎂 Events",
  dca: "₿ DCA",
  alerts: "⚠️ Alerts",
  cronlog: "📋 Cron log",
};

type State = { group_id: number; topics: Record<string, number> };
let state: State | null = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : null;
const routes: Record<string, string> = JSON.parse(readFileSync(join(ROOT, "config/routes.json"), "utf8"));

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
function log(...a: unknown[]) {
  console.log(new Date().toISOString(), ...a);
}
function topicKeyFor(threadId: number | undefined): string | undefined {
  if (!state || threadId === undefined) return undefined;
  return Object.entries(state.topics).find(([, id]) => id === threadId)?.[0];
}

// ---------------------------------------------------------------- Telegram
const bot = new Bot(TOKEN);

bot.use(async (ctx, next) => {
  const from = ctx.from?.id;
  if (from !== OWNER_ID) return; // ignore everyone else silently
  await next();
});

bot.command("topics", async (ctx) => {
  const chat = ctx.chat;
  if (chat.type !== "supergroup" || !("is_forum" in chat && chat.is_forum)) {
    await ctx.reply("Run this inside the forum group (Topics must be enabled).");
    return;
  }
  const topics: Record<string, number> = state?.group_id === chat.id ? { ...state.topics } : {};
  const created: string[] = [];
  for (const [key, name] of Object.entries(TOPICS)) {
    if (topics[key]) continue;
    const t = await ctx.api.createForumTopic(chat.id, name);
    topics[key] = t.message_thread_id;
    created.push(name);
  }
  state = { group_id: chat.id, topics };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
  const lines = Object.entries(topics).map(([k, id]) => `${TOPICS[k]} → ${k} (${id})`);
  await ctx.reply(
    `group_id: ${chat.id}\n${lines.join("\n")}\n\n${created.length ? `created: ${created.join(", ")}` : "all topics already existed"}\nsaved to ${STATE_FILE}`,
  );
});

bot.command("ping", (ctx) => ctx.reply("pong"));

// Forward anything posted in a routed topic to its project.
async function forward(ctx: Context) {
  if (!state || ctx.chat?.id !== state.group_id) return;
  const threadId = ctx.msg?.message_thread_id ?? ctx.callbackQuery?.message?.message_thread_id;
  const key = topicKeyFor(threadId);
  const url = key && routes[key];
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ctx.update),
    });
    if (!res.ok) log(`forward ${key} -> ${url}: HTTP ${res.status}`);
  } catch (e) {
    log(`forward ${key} -> ${url} failed:`, (e as Error).message);
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: `${key} service is down` }).catch(() => {});
    else await ctx.reply(`⚠️ ${key} service is not running`).catch(() => {});
  }
}
bot.on("message", forward);
bot.on("callback_query", forward);

bot.catch((err) => log("bot error:", err.error));

// ---------------------------------------------------------------- HTTP API
async function callTelegram(method: string, body: Record<string, unknown>) {
  if (typeof body.topic === "string") {
    if (!state) throw new Error("topics not initialised — run /topics in the group first");
    const id = state.topics[body.topic];
    if (!id) throw new Error(`unknown topic "${body.topic}" (known: ${Object.keys(state.topics).join(", ")})`);
    const { topic: _t, ...rest } = body;
    body = { ...rest, chat_id: state.group_id, message_thread_id: id };
  }
  // @ts-expect-error dynamic method name
  return bot.api.raw[method](body);
}

const server = createServer(async (req, res) => {
  const send = (code: number, obj: unknown) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/health") {
      return send(200, { ok: true, topics: state?.topics ?? null, bot: bot.botInfo?.username });
    }
    if (req.method !== "POST") return send(405, { ok: false, error: "POST only" });
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};

    if (url.pathname === "/notify") {
      if (!body.topic || !body.text) return send(400, { ok: false, error: "need topic and text" });
      const r = await callTelegram("sendMessage", { parse_mode: "HTML", ...body });
      return send(200, { ok: true, message_id: r.message_id });
    }
    const m = url.pathname.match(/^\/tg\/(\w+)$/);
    if (m) return send(200, { ok: true, result: await callTelegram(m[1], body) });
    send(404, { ok: false, error: "unknown route" });
  } catch (e) {
    send(500, { ok: false, error: (e as Error).message });
  }
});

// ---------------------------------------------------------------- start
server.listen(PORT, "127.0.0.1", () => log(`http api on 127.0.0.1:${PORT}`));
bot.start({
  onStart: (me) => log(`polling as @${me.username}; topics ${state ? "loaded" : "NOT initialised (run /topics)"}`),
});
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => { log(sig); bot.stop(); server.close(); process.exit(0); });
}
