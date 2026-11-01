import { api } from "./api";
import { KINDS } from "./messages";

const unquote = (s: string) => s.trim().replace(/^(["'])(.*)\1$/, "$2");
const asList = (v: unknown) =>
  (Array.isArray(v) ? v : String(v ?? "").replace(/^\[|\]$/g, "").split(","))
    .map((s) => unquote(String(s)))
    .filter(Boolean);

// Minimal frontmatter: `key: value`, `key: [a, b]`, or `key:` followed by `- item` lines.
export function parseMd(text: string) {
  const m = text.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const fm: Record<string, string | string[]> = {};
  if (m) {
    let key = "";
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([\w-]+):\s*(.*)$/);
      const li = line.match(/^\s*-\s+(.*)$/);
      if (kv) {
        key = kv[1].toLowerCase();
        fm[key] = kv[2].trim() === "" ? [] : unquote(kv[2]);
      } else if (li) {
        const cur = fm[key];
        if (Array.isArray(cur)) cur.push(unquote(li[1]));
      }
    }
  }
  return { fm, body: (m ? text.slice(m[0].length) : text).trim() };
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, "");

function mdNote(file: string, text: string) {
  const { fm, body } = parseMd(text);
  const h1 = body.match(/^#\s+(.+)$/m)?.[1].trim();
  const kind = Object.keys(KINDS.en).includes(String(fm.kind)) ? String(fm.kind) : "idea";
  const date = String(fm.date ?? fm.created ?? "").match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return {
    title: String(fm.title || h1 || baseName(file)).slice(0, 200),
    kind,
    body,
    tags: asList(fm.tags),
    source_url: String(fm.source ?? fm.url ?? ""),
    ...(date && { learned_at: date }),
  };
}

async function pdfNote(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const { items } = await (await pdf.getPage(i)).getTextContent();
    let page = "";
    for (const it of items) {
      if (!("str" in it)) continue;
      page += it.str + (it.hasEOL ? "\n" : "");
    }
    pages.push(page.trim());
  }
  const body = pages.filter(Boolean).join("\n\n").trim();
  if (!body) throw new Error("no_text");
  const info = (await pdf.getMetadata().catch(() => null))?.info as { Title?: string } | undefined;
  return { title: (info?.Title?.trim() || baseName(file.name)).slice(0, 200), kind: "idea", body, tags: [], source_url: "" };
}

export type ImportResult = { name: string; status: "ok" | "skipped" | "failed"; error?: string };

// One file = one inbox note; `source_title` ("md:<name>" / "pdf:<name>") is the dedupe key.
export async function importFiles(files: File[]): Promise<ImportResult[]> {
  const seen = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const { notes } = await api<{ notes: { source_title: string }[] }>(
      `/notes?include_archived=1&limit=500&offset=${offset}`,
    );
    for (const n of notes) seen.add(n.source_title);
    if (notes.length < 500) break;
  }
  const results: ImportResult[] = [];
  for (const file of files) {
    const isPdf = /\.pdf$/i.test(file.name);
    const key = `${isPdf ? "pdf" : "md"}:${file.name}`;
    if (seen.has(key)) {
      results.push({ name: file.name, status: "skipped" });
      continue;
    }
    try {
      const note = isPdf ? await pdfNote(file) : mdNote(file.name, await file.text());
      if (!note.body && !note.source_url) throw new Error("empty");
      await api("/notes", "POST", { ...note, source_title: key, stage: "inbox" });
      seen.add(key);
      results.push({ name: file.name, status: "ok" });
    } catch (e) {
      results.push({ name: file.name, status: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
