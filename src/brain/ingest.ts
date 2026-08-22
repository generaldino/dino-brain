// Save a link: fetch → summarise/tag with Claude → store. Used by the Telegram agent and bin/brain-add.
import Anthropic from "@anthropic-ai/sdk";
import { fetchContent } from "./fetch.ts";
import type { Bookmark, Store } from "./store.ts";

const MODEL = process.env.BRAIN_SUMMARY_MODEL ?? "claude-sonnet-5";
const client = new Anthropic();

export const CATEGORIES = ["tech", "ai", "crypto", "finance", "business", "productivity", "design", "health", "science", "culture", "politics", "humour", "tools", "tutorial", "other"];

const SUMMARY_TOOL: Anthropic.Tool = {
  name: "save",
  description: "Record the summary, category and tags for this bookmark.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "2-4 sentences: what it is and the key points / takeaway. Specific, no fluff." },
      category: { type: "string", enum: CATEGORIES },
      tags: { type: "array", items: { type: "string" }, description: "3-8 lowercase topic tags (single words or hyphenated), specific enough to search by later" },
      title: { type: "string", description: "Short descriptive title (<= 80 chars); improve the given one if it's generic" },
    },
    required: ["summary", "category", "tags", "title"],
    additionalProperties: false,
  },
  strict: true,
};

export async function ingest(store: Store, url: string, note: string | null): Promise<Bookmark> {
  const f = await fetchContent(url);
  const prompt = `Summarise and tag this saved ${f.kind} for a personal knowledge base.
URL: ${f.url}
Title: ${f.title ?? ""}
Author: ${f.author ?? ""}
${note ? `Owner's note when saving: ${note}\n` : ""}
Content:
${f.content.slice(0, 30_000)}`;
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    tools: [SUMMARY_TOOL],
    tool_choice: { type: "tool", name: "save" },
    messages: [{ role: "user", content: prompt }],
  });
  const tu = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const out = (tu?.input ?? {}) as { summary?: string; category?: string; tags?: string[]; title?: string };
  return store.upsert({
    url: f.url,
    kind: f.kind,
    title: out.title || f.title,
    author: f.author,
    content: f.content,
    summary: out.summary ?? null,
    category: out.category ?? null,
    tags: (out.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean),
    note,
  });
}

export function formatSaved(b: Bookmark): string {
  const tags = b.tags.map((t) => `#${t.replaceAll(/[^a-z0-9_]/gi, "_")}`).join(" ");
  return `💾 Saved #${b.id} (${b.kind}${b.category ? ", " + b.category : ""})\n${b.title}${b.author ? ` — ${b.author}` : ""}\n\n${b.summary ?? ""}\n\n${tags}`;
}
