// CLI: node src/brain/cli.ts <url>... [-n "note"]   |   node src/brain/cli.ts search <query>
import { openStore } from "./store.ts";
import { ingest, formatSaved } from "./ingest.ts";

const DATA_DIR = process.env.DINO_DATA_DIR ?? "/home/deploy/dino-brain-data";
const store = openStore(`${DATA_DIR}/brain.db`);
const args = process.argv.slice(2);

if (args[0] === "search") {
  for (const b of store.search(args.slice(1).join(" "))) console.log(`#${b.id} [${b.kind}] ${b.title}\n   ${b.url}\n   ${b.snippet.replace(/\n/g, " ")}\n`);
} else {
  const ni = args.indexOf("-n");
  const note = ni >= 0 ? args[ni + 1] : null;
  const urls = args.filter((a, i) => a !== "-n" && i !== ni + 1);
  if (!urls.length) { console.error("usage: brain-add <url>... [-n note] | brain-add search <query>"); process.exit(1); }
  for (const u of urls) {
    try { console.log(formatSaved(await ingest(store, u, note)), "\n"); }
    catch (e) { console.error(`failed ${u}: ${(e as Error).message}`); process.exitCode = 1; }
  }
}
