// Bookmark store: links the owner sends to the bot, with extracted content, summary and tags.
// Lives in brain.db alongside the agent's conversation history. FTS5 index for natural-language search.
import Database from "better-sqlite3";

export type Kind = "tweet" | "youtube" | "web";

export interface Bookmark {
  id: number;
  url: string;
  kind: Kind;
  title: string | null;
  author: string | null;
  content: string | null;
  summary: string | null;
  category: string | null;
  tags: string[];
  note: string | null;
  created_at: string;
}

export function openStore(path: string) {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      title TEXT,
      author TEXT,
      content TEXT,
      summary TEXT,
      category TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
      title, author, summary, content, tags, note, category,
      content='bookmarks', content_rowid='id', tokenize='porter unicode61'
    );
    CREATE TRIGGER IF NOT EXISTS bookmarks_ai AFTER INSERT ON bookmarks BEGIN
      INSERT INTO bookmarks_fts(rowid, title, author, summary, content, tags, note, category)
      VALUES (new.id, new.title, new.author, new.summary, new.content, new.tags, new.note, new.category);
    END;
    CREATE TRIGGER IF NOT EXISTS bookmarks_ad AFTER DELETE ON bookmarks BEGIN
      INSERT INTO bookmarks_fts(bookmarks_fts, rowid, title, author, summary, content, tags, note, category)
      VALUES ('delete', old.id, old.title, old.author, old.summary, old.content, old.tags, old.note, old.category);
    END;
    CREATE TRIGGER IF NOT EXISTS bookmarks_au AFTER UPDATE ON bookmarks BEGIN
      INSERT INTO bookmarks_fts(bookmarks_fts, rowid, title, author, summary, content, tags, note, category)
      VALUES ('delete', old.id, old.title, old.author, old.summary, old.content, old.tags, old.note, old.category);
      INSERT INTO bookmarks_fts(rowid, title, author, summary, content, tags, note, category)
      VALUES (new.id, new.title, new.author, new.summary, new.content, new.tags, new.note, new.category);
    END;
  `);

  const row = (r: any): Bookmark => ({ ...r, tags: JSON.parse(r.tags) });
  const COLS = "id, url, kind, title, author, content, summary, category, tags, note, created_at";

  return {
    db,
    get(id: number): Bookmark | undefined {
      const r = db.prepare(`SELECT ${COLS} FROM bookmarks WHERE id = ?`).get(id) as any;
      return r && row(r);
    },
    byUrl(url: string): Bookmark | undefined {
      const r = db.prepare(`SELECT ${COLS} FROM bookmarks WHERE url = ?`).get(url) as any;
      return r && row(r);
    },
    upsert(b: Omit<Bookmark, "id" | "created_at">): Bookmark {
      db.prepare(
        `INSERT INTO bookmarks (url, kind, title, author, content, summary, category, tags, note)
         VALUES (@url, @kind, @title, @author, @content, @summary, @category, @tags, @note)
         ON CONFLICT(url) DO UPDATE SET kind=excluded.kind, title=excluded.title, author=excluded.author,
           content=excluded.content, summary=excluded.summary, category=excluded.category, tags=excluded.tags,
           note=COALESCE(excluded.note, bookmarks.note)`,
      ).run({ ...b, tags: JSON.stringify(b.tags) });
      return this.byUrl(b.url)!;
    },
    /**
     * Full-text search. `query` is FTS5 syntax. If it fails to parse, or returns nothing, we retry
     * server-side with progressively looser forms (OR of quoted words, then OR of prefixes) so the
     * model doesn't burn a full API round per rephrase. `matched` says which form hit.
     */
    search(query: string, limit = 10): { rows: (Bookmark & { snippet: string })[]; matched: string } {
      const run = (q: string) =>
        db
          .prepare(
            `SELECT b.${COLS.replaceAll(", ", ", b.")}, snippet(bookmarks_fts, -1, '[', ']', '…', 24) snippet
             FROM bookmarks_fts f JOIN bookmarks b ON b.id = f.rowid
             WHERE bookmarks_fts MATCH ? ORDER BY bm25(bookmarks_fts, 10, 2, 6, 1, 8, 6, 6) LIMIT ?`,
          )
          .all(q, limit)
          .map((r: any) => ({ ...row(r), snippet: r.snippet }));
      const words = query.split(/\s+/).map((w) => w.replaceAll(/["*()]/g, "")).filter((w) => w.length > 1 && !/^(and|or|not)$/i.test(w));
      const attempts = [
        query,
        words.map((w) => `"${w}"`).join(" OR "),
        words.map((w) => `"${w}"*`).join(" OR "),
      ].filter((q, i, a) => q && a.indexOf(q) === i);
      for (const q of attempts) {
        try {
          const rows = run(q);
          if (rows.length) return { rows, matched: q };
        } catch {
          /* bad FTS syntax — try the next, looser form */
        }
      }
      return { rows: [], matched: query };
    },
    list(opts: { kind?: string; category?: string; tag?: string; since?: string; limit?: number }): Bookmark[] {
      const where: string[] = [];
      const args: unknown[] = [];
      if (opts.kind) { where.push("kind = ?"); args.push(opts.kind); }
      if (opts.category) { where.push("category = ? COLLATE NOCASE"); args.push(opts.category); }
      if (opts.tag) { where.push("EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ? COLLATE NOCASE)"); args.push(opts.tag); }
      if (opts.since) { where.push("created_at >= ?"); args.push(opts.since); }
      const sql = `SELECT ${COLS} FROM bookmarks ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`;
      return db.prepare(sql).all(...args, Math.min(opts.limit ?? 20, 100)).map(row);
    },
    stats(): { total: number; kinds: Record<string, number>; categories: Record<string, number>; tags: Record<string, number> } {
      const total = (db.prepare("SELECT count(*) c FROM bookmarks").get() as any).c;
      const kinds = Object.fromEntries((db.prepare("SELECT kind k, count(*) c FROM bookmarks GROUP BY kind").all() as any[]).map((r) => [r.k, r.c]));
      const categories = Object.fromEntries((db.prepare("SELECT category k, count(*) c FROM bookmarks GROUP BY category ORDER BY c DESC").all() as any[]).map((r) => [r.k ?? "(none)", r.c]));
      const tags = Object.fromEntries((db.prepare("SELECT value k, count(*) c FROM bookmarks, json_each(tags) GROUP BY value ORDER BY c DESC LIMIT 40").all() as any[]).map((r) => [r.k, r.c]));
      return { total, kinds, categories, tags };
    },
    remove(id: number): boolean {
      return db.prepare("DELETE FROM bookmarks WHERE id = ?").run(id).changes > 0;
    },
  };
}
export type Store = ReturnType<typeof openStore>;
