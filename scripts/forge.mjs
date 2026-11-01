#!/usr/bin/env node
// Agent-facing CLI for Idea Forge: bulk-import .md files as inbox notes.
// Usage: node scripts/forge.mjs import <file|dir>... [--dry-run] [--kind idea]
// Env: IDEA_FORGE_URL (default http://localhost:5173), IDEA_FORGE_TOKEN (default: API_TOKEN from .dev.vars)
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

const KINDS = ["quote", "link", "idea", "lesson", "book", "video", "observation"];
const USAGE = `idea-forge CLI
  import <file|dir>... [--dry-run] [--kind <kind>] [--exclude a.md,*.flowchart.md]   one .md = one inbox note; re-runs skip already imported files
  delete <id|a-b>... [--yes]                         PERMANENT; without --yes only lists what would go
  ping                                               check URL + token
kinds: ${KINDS.join(" | ")}`;

const fail = (msg, next) => {
  console.error(`error: ${msg}${next ? `\nnext: ${next}` : ""}`);
  process.exit(1);
};

async function token() {
  if (process.env.IDEA_FORGE_TOKEN) return process.env.IDEA_FORGE_TOKEN;
  try {
    const m = (await readFile(".dev.vars", "utf8")).match(/^API_TOKEN\s*=\s*"?([^"\n]+)"?/m);
    if (m) return m[1];
  } catch {}
  return fail("no API token", "set IDEA_FORGE_TOKEN or run from the repo root with .dev.vars");
}

const base = (process.env.IDEA_FORGE_URL ?? "http://localhost:5173").replace(/\/$/, "");
const headers = async () => ({ authorization: `Bearer ${await token()}`, "content-type": "application/json" });

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(base + path, { method, headers: await headers(), body: body && JSON.stringify(body) });
  } catch (e) {
    return fail(`cannot reach ${base} (${e.cause?.code ?? e.message})`, "start `npm run dev` or set IDEA_FORGE_URL");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return fail(`${method} ${path} -> ${res.status} ${data.error ?? ""}`, res.status === 401 ? "check IDEA_FORGE_TOKEN" : undefined);
  return data;
}

async function* walk(p) {
  if ((await stat(p)).isDirectory()) {
    for (const e of (await readdir(p, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      yield* walk(join(p, e.name));
    }
  } else if (extname(p).toLowerCase() === ".md") yield p;
}

const unquote = (s) => s.trim().replace(/^(["'])(.*)\1$/, "$2");

// Minimal frontmatter: `key: value`, `key: [a, b]`, or `key:` followed by `- item` lines.
export function parseMd(text) {
  const m = text.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const fm = {};
  if (m) {
    let key = null;
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([\w-]+):\s*(.*)$/);
      const li = line.match(/^\s*-\s+(.*)$/);
      if (kv) {
        key = kv[1].toLowerCase();
        fm[key] = kv[2].trim() === "" ? [] : unquote(kv[2]);
      } else if (li && Array.isArray(fm[key])) fm[key].push(unquote(li[1]));
    }
  }
  const body = (m ? text.slice(m[0].length) : text).trim();
  return { fm, body };
}

const asList = (v) =>
  Array.isArray(v) ? v : String(v ?? "").replace(/^\[|\]$/g, "").split(",").map(unquote).filter(Boolean);

export function toNote(file, text, root, defaultKind) {
  const { fm, body } = parseMd(text);
  const h1 = body.match(/^#\s+(.+)$/m)?.[1].trim();
  const kind = KINDS.includes(fm.kind) ? fm.kind : defaultKind;
  const date = String(fm.date ?? fm.created ?? "").match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return {
    title: String(fm.title || h1 || basename(file, extname(file))).slice(0, 200),
    kind,
    body,
    tags: asList(fm.tags),
    source_url: String(fm.source ?? fm.url ?? ""),
    source_title: `md:${relative(root, file)}`, // dedupe key for re-runs
    ...(date && { learned_at: date }),
    stage: "inbox",
  };
}

async function existingKeys() {
  const keys = new Set();
  for (let offset = 0; ; offset += 500) {
    const { notes } = await call("GET", `/api/notes?include_archived=1&limit=500&offset=${offset}`);
    for (const n of notes) keys.add(n.source_title);
    if (notes.length < 500) return keys;
  }
}

async function importCmd(args) {
  const dry = args.includes("--dry-run");
  const ki = args.indexOf("--kind");
  const kind = ki >= 0 ? args[ki + 1] : "idea";
  if (!KINDS.includes(kind)) fail(`bad --kind "${kind}"`, `use one of: ${KINDS.join(", ")}`);
  const ei = args.indexOf("--exclude");
  const excl = ei >= 0 ? args[ei + 1].split(",") : [];
  const skip = (rel) => excl.some((x) => (x.startsWith("*") ? rel.endsWith(x.slice(1)) : rel === x || basename(rel) === x));
  const paths = args.filter((a, i) => !a.startsWith("--") && (ki < 0 || i !== ki + 1) && (ei < 0 || i !== ei + 1));
  if (!paths.length) fail("no path given", "idea-forge import ./notes --dry-run");

  const seen = dry ? new Set() : await existingKeys();
  const done = [], skipped = [], failed = [];
  for (const p of paths) {
    const root = (await stat(p).catch(() => fail(`not found: ${p}`))).isDirectory() ? resolve(p) : resolve(p, "..");
    for await (const file of walk(resolve(p))) {
      const note = toNote(file, await readFile(file, "utf8"), root, kind);
      if (skip(relative(root, file))) { skipped.push(`${note.source_title} (excluded)`); continue; }
      if (!note.body && !note.source_url) { skipped.push(`${note.source_title} (empty)`); continue; }
      if (seen.has(note.source_title)) { skipped.push(`${note.source_title} (already imported)`); continue; }
      if (dry) { done.push(`${note.source_title} -> "${note.title}" [${note.tags.join(",")}]`); continue; }
      const r = await fetch(base + "/api/notes", { method: "POST", headers: await headers(), body: JSON.stringify(note) });
      if (r.ok) { seen.add(note.source_title); done.push(`${note.source_title} -> #${(await r.json()).id}`); }
      else failed.push(`${note.source_title} (${r.status})`);
    }
  }
  console.log(`${dry ? "would import" : "imported"} ${done.length}, skipped ${skipped.length}, failed ${failed.length}`);
  for (const [label, list] of [["ok", done], ["skip", skipped], ["fail", failed]])
    for (const l of list) console.log(`  ${label}: ${l}`);
  if (failed.length) { console.log("next: re-run the same command; imported files are skipped"); process.exit(1); }
  console.log(dry ? "next: re-run without --dry-run" : "next: open the Inbox page to distill, or `idea-forge ping`");
}

async function deleteCmd(args) {
  const ids = args.filter((a) => !a.startsWith("--")).flatMap((a) => {
    const [lo, hi = lo] = a.split("-").map(Number);
    return Number.isInteger(lo) && Number.isInteger(hi) && lo > 0 && hi >= lo ? Array.from({ length: hi - lo + 1 }, (_, i) => lo + i) : fail(`bad id "${a}"`, "use 5 or 52-62");
  });
  if (!ids.length) fail("no ids given", "idea-forge delete 52-62 63");
  const yes = args.includes("--yes");
  for (const id of ids) {
    const { note } = await call("GET", `/api/notes/${id}`);
    if (yes) await call("DELETE", `/api/notes/${id}`);
    console.log(`  ${yes ? "deleted" : "would delete"} #${id} ${note.title} (${note.source_title})`);
  }
  console.log(yes ? `deleted ${ids.length}` : "next: re-run with --yes to delete permanently");
}

const [cmd, ...rest] = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  if (cmd === "import") await importCmd(rest);
  else if (cmd === "delete") await deleteCmd(rest);
  else if (cmd === "ping") { await call("GET", "/api/ping"); console.log(`ok ${base}`); }
  else console.log(USAGE);
}
