// Fetch readable content for a URL: tweets via fxtwitter, YouTube via yt-dlp (metadata + auto-captions),
// everything else via Readability. Returns plain text capped to MAX_CONTENT chars.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { Kind } from "./store.ts";

const sh = promisify(execFile);
const YTDLP = process.env.YTDLP ?? "/home/deploy/.local/bin/yt-dlp";
const MAX_CONTENT = 40_000;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface Fetched {
  url: string;
  kind: Kind;
  title: string | null;
  author: string | null;
  content: string;
}

export const URL_RE = /https?:\/\/[^\s<>()\]]+/g;

export function classify(u: URL): Kind {
  const h = u.hostname.replace(/^(www|mobile|m)\./, "");
  if (["twitter.com", "x.com", "fxtwitter.com", "vxtwitter.com", "fixupx.com"].includes(h) && /\/status\/\d+/.test(u.pathname)) return "tweet";
  if (["youtube.com", "youtu.be", "music.youtube.com"].includes(h)) return "youtube";
  return "web";
}

/** Strip tracking params, normalise twitter mirrors and youtube forms. */
export function canonical(raw: string): URL {
  const u = new URL(raw);
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref_src|ref_url|s$|t$|si$|feature$)/.test(k)) u.searchParams.delete(k);
  const h = u.hostname.replace(/^(www|mobile|m)\./, "");
  if (["twitter.com", "fxtwitter.com", "vxtwitter.com", "fixupx.com"].includes(h)) u.hostname = "x.com";
  if (h === "youtu.be") { const id = u.pathname.slice(1); u.hostname = "www.youtube.com"; u.pathname = "/watch"; u.search = `?v=${id}`; }
  if (h === "youtube.com" && u.pathname.startsWith("/shorts/")) { const id = u.pathname.split("/")[2]; u.pathname = "/watch"; u.search = `?v=${id}`; }
  u.hash = "";
  return u;
}

export async function fetchContent(raw: string): Promise<Fetched> {
  const u = canonical(raw);
  const kind = classify(u);
  const f = kind === "tweet" ? await fetchTweet(u) : kind === "youtube" ? await fetchYoutube(u) : await fetchWeb(u);
  return { ...f, url: u.toString(), kind, content: f.content.slice(0, MAX_CONTENT) };
}

async function fetchTweet(u: URL) {
  const m = u.pathname.match(/^\/([^/]+)\/status\/(\d+)/)!;
  const r = await fetch(`https://api.fxtwitter.com/${m[1]}/status/${m[2]}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`fxtwitter ${r.status}`);
  const t = (await r.json()).tweet;
  if (!t) throw new Error("tweet not found");
  const parts = [t.text];
  for (const m of t.media?.all ?? []) if (m.alt_text) parts.push(`[media: ${m.alt_text}]`);
  if (t.article?.content?.blocks?.length) parts.push("\n--- article ---\n" + t.article.content.blocks.map((b: any) => b.text).join("\n"));
  if (t.quote) parts.push(`\n--- quoting @${t.quote.author?.screen_name} ---\n${t.quote.text}`);
  const author = t.author ? `${t.author.name} (@${t.author.screen_name})` : null;
  return { title: t.article?.title ?? `Tweet by ${author ?? m[1]}: ${String(t.text).slice(0, 80)}`, author, content: parts.join("\n") };
}

async function fetchYoutube(u: URL) {
  const dir = await mkdtemp(join(tmpdir(), "yt-"));
  try {
    const { stdout } = await sh(
      YTDLP,
      ["--skip-download", "--no-warnings", "--no-playlist", "--write-auto-subs", "--write-subs", "--sub-langs", "en,en-orig,en.*", "--sub-format", "vtt/best",
       "-o", "s.%(ext)s", "--print", "%(title)s\n%(channel)s\n%(duration_string)s\n%(upload_date)s\n%(description)s", u.toString()],
      { cwd: dir, timeout: 120_000, maxBuffer: 8_000_000 },
    );
    const [title, channel, duration, date, ...desc] = stdout.split("\n");
    const vtt = (await readdir(dir)).find((f) => f.endsWith(".vtt"));
    const transcript = vtt ? vttToText(await readFile(join(dir, vtt), "utf8")) : "";
    const content = [`Channel: ${channel}`, `Duration: ${duration}`, `Uploaded: ${date}`, "", "Description:", desc.join("\n").trim(), "",
      transcript ? "Transcript:\n" + transcript : "(no English captions available)"].join("\n");
    return { title, author: channel, content };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function vttToText(vtt: string): string {
  const out: string[] = [];
  for (let line of vtt.split("\n")) {
    line = line.replace(/<[^>]+>/g, "").trim();
    if (!line || line === "WEBVTT" || /^\d+$/.test(line) || /-->/.test(line) || /^(Kind|Language):/.test(line)) continue;
    if (out[out.length - 1] !== line) out.push(line); // auto-subs repeat lines as they scroll
  }
  return out.join(" ");
}

async function fetchWeb(u: URL) {
  const r = await fetch(u, { headers: { "user-agent": UA, accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const type = r.headers.get("content-type") ?? "";
  const body = await r.text();
  if (!/html/.test(type)) return { title: u.pathname.split("/").pop() || u.hostname, author: null, content: body };
  const { document } = parseHTML(body);
  const article = new Readability(document as any, { charThreshold: 200 }).parse();
  const text = (article?.textContent ?? document.body?.textContent ?? "").replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
  const meta = (n: string) => document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.getAttribute("content") ?? null;
  return {
    title: article?.title || meta("og:title") || document.title || u.hostname,
    author: article?.byline || meta("author") || article?.siteName || meta("og:site_name") || u.hostname,
    content: text,
  };
}
