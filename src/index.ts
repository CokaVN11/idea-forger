/**
 * Idea Forge — Cloudflare Worker API
 * Pipeline: Capture → Distill → Connect → Spark → Ship
 */
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  API_TOKEN: string;
  INBOX_LIMIT?: string;
  TZ_OFFSET_HOURS?: string;
}

type Json = Record<string, any>;

const NOTE_FIELDS = [
  "kind", "title", "body", "summary", "why_matters", "source_url", "source_title",
  "stage", "para", "para_ref", "next_action", "learned_at", "review_due",
] as const;
const OUTPUT_FIELDS = ["title", "kind", "status", "url", "notes_text", "deadline"] as const;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const err = (message: string, status = 400) => json({ error: message }, status);

function today(env: Env, plusDays = 0): string {
  const off = Number(env.TZ_OFFSET_HOURS ?? "7");
  const d = new Date(Date.now() + off * 3600_000 + plusDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

async function body(req: Request): Promise<Json> {
  try { return (await req.json()) as Json; } catch { return {}; }
}

// ---------- tags ----------
async function setTags(db: D1Database, noteId: number, tags: unknown) {
  if (!Array.isArray(tags)) return;
  const clean = [...new Set(tags.map((t) => String(t).trim().replace(/^#/, "")).filter(Boolean))].slice(0, 20);
  const stmts: D1PreparedStatement[] = [db.prepare("DELETE FROM note_tags WHERE note_id = ?").bind(noteId)];
  for (const name of clean) {
    stmts.push(db.prepare("INSERT OR IGNORE INTO tags(name) VALUES (?)").bind(name));
    stmts.push(
      db.prepare("INSERT OR IGNORE INTO note_tags(note_id, tag_id) SELECT ?, id FROM tags WHERE name = ?").bind(noteId, name),
    );
  }
  await db.batch(stmts);
}

async function attachTags(db: D1Database, notes: Json[]) {
  if (!notes.length) return notes;
  const ids = notes.map((n) => n.id);
  const ph = ids.map(() => "?").join(",");
  const { results } = await db
    .prepare(`SELECT nt.note_id, t.name FROM note_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.note_id IN (${ph})`)
    .bind(...ids)
    .all<{ note_id: number; name: string }>();
  const map = new Map<number, string[]>();
  for (const r of results) (map.get(r.note_id) ?? map.set(r.note_id, []).get(r.note_id)!).push(r.name);
  for (const n of notes) n.tags = map.get(n.id) ?? [];
  return notes;
}

// FTS query builder: tokens → "tok"* OR ...
function ftsQuery(q: string, mode: "AND" | "OR" = "AND"): string | null {
  const toks = q
    .toLowerCase()
    .normalize("NFC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1)
    .slice(0, 12);
  if (!toks.length) return null;
  return toks.map((t) => `"${t.replace(/"/g, "")}"*`).join(` ${mode} `);
}

const LIST_COLS =
  "n.id, n.kind, n.title, n.summary, n.body, n.stage, n.para, n.para_ref, n.next_action, n.learned_at, n.review_due, n.source_url, n.source_title, n.created_at";

// ---------- handlers ----------
async function listNotes(env: Env, url: URL) {
  const p = url.searchParams;
  const where: string[] = [];
  const args: unknown[] = [];
  let from = "notes n";
  const q = p.get("q")?.trim();
  if (q) {
    const fq = ftsQuery(q);
    if (fq) {
      from = "notes_fts f JOIN notes n ON n.id = f.rowid";
      where.push("notes_fts MATCH ?");
      args.push(fq);
    }
  }
  for (const k of ["stage", "kind", "para"] as const) {
    const v = p.get(k);
    if (v) { where.push(`n.${k} = ?`); args.push(v); }
  }
  if (!p.get("stage") && p.get("include_archived") !== "1") where.push("n.stage != 'archived'");
  const tag = p.get("tag");
  if (tag) {
    where.push("n.id IN (SELECT nt.note_id FROM note_tags nt JOIN tags t ON t.id = nt.tag_id WHERE t.name = ?)");
    args.push(tag);
  }
  if (p.get("has_action") === "1") where.push("n.next_action != ''");
  const order = p.get("order") === "learned" ? "n.learned_at DESC, n.id DESC" : "n.updated_at DESC, n.id DESC";
  const limit = Math.min(Number(p.get("limit") ?? 50), 500);
  const offset = Number(p.get("offset") ?? 0);
  const sql = `SELECT ${LIST_COLS} FROM ${from} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${order} LIMIT ? OFFSET ?`;
  const { results } = await env.DB.prepare(sql).bind(...args, limit, offset).all<Json>();
  return json({ notes: await attachTags(env.DB, results) });
}

async function getNote(env: Env, id: number) {
  const db = env.DB;
  const note = await db.prepare("SELECT * FROM notes WHERE id = ?").bind(id).first<Json>();
  if (!note) return err("not found", 404);
  const [links, backlinks, outputs] = await db.batch([
    db.prepare(
      "SELECT l.id AS link_id, l.reason, n.id, n.title, n.summary, n.kind FROM links l JOIN notes n ON n.id = l.to_id WHERE l.from_id = ? ORDER BY l.id DESC",
    ).bind(id),
    db.prepare(
      "SELECT l.id AS link_id, l.reason, n.id, n.title, n.summary, n.kind FROM links l JOIN notes n ON n.id = l.from_id WHERE l.to_id = ? ORDER BY l.id DESC",
    ).bind(id),
    db.prepare(
      "SELECT o.id, o.title, o.status, o.kind FROM output_notes onn JOIN outputs o ON o.id = onn.output_id WHERE onn.note_id = ?",
    ).bind(id),
  ]);
  await attachTags(db, [note]);
  return json({ note, links: links.results, backlinks: backlinks.results, outputs: outputs.results });
}

async function createNote(env: Env, b: Json) {
  if (!String(b.body ?? "").trim() && !String(b.title ?? "").trim() && !String(b.source_url ?? "").trim())
    return err("empty note");
  const title = String(b.title ?? "").trim() || String(b.body ?? "").trim().split("\n")[0].slice(0, 120) || String(b.source_url);
  const r = await env.DB.prepare(
    `INSERT INTO notes (kind, title, body, source_url, source_title, learned_at, para, para_ref, summary, why_matters, next_action, stage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      b.kind ?? "idea", title, b.body ?? "", b.source_url ?? "", b.source_title ?? "",
      b.learned_at || today(env), b.para ?? "resource", b.para_ref ?? "",
      b.summary ?? "", b.why_matters ?? "", b.next_action ?? "", b.stage === "distilled" ? "distilled" : "inbox",
    )
    .first<{ id: number }>();
  const id = r!.id;
  await setTags(env.DB, id, b.tags);
  if (b.stage === "distilled")
    await env.DB.prepare("UPDATE notes SET distilled_at = datetime('now'), review_due = ? WHERE id = ?").bind(today(env, 1), id).run();
  return json({ id }, 201);
}

async function updateNote(env: Env, id: number, b: Json) {
  const cur = await env.DB.prepare("SELECT stage, review_due FROM notes WHERE id = ?").bind(id).first<Json>();
  if (!cur) return err("not found", 404);
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const f of NOTE_FIELDS) if (f in b) { sets.push(`${f} = ?`); args.push(b[f]); }
  if (b.stage === "distilled" && cur.stage !== "distilled") {
    sets.push("distilled_at = datetime('now')");
    if (!cur.review_due && !("review_due" in b)) { sets.push("review_due = ?"); args.push(today(env, 1)); }
  }
  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    await env.DB.prepare(`UPDATE notes SET ${sets.join(", ")} WHERE id = ?`).bind(...args, id).run();
  }
  if ("tags" in b) await setTags(env.DB, id, b.tags);
  return json({ ok: true });
}

// SM-2 rút gọn: grade 0=again 1=hard 2=good 3=easy
async function reviewNote(env: Env, id: number, grade: number) {
  const n = await env.DB.prepare("SELECT review_interval, review_ease, review_count FROM notes WHERE id = ?").bind(id).first<Json>();
  if (!n) return err("not found", 404);
  let { review_interval: iv, review_ease: ease } = n as { review_interval: number; review_ease: number };
  if (grade <= 0) { iv = 1; ease = Math.max(1.3, ease - 0.2); }
  else if (grade === 1) { iv = Math.max(1, Math.round(iv * 1.2) || 1); ease = Math.max(1.3, ease - 0.15); }
  else if (grade === 2) { iv = iv < 1 ? 1 : iv < 3 ? 3 : Math.round(iv * ease); }
  else { iv = iv < 1 ? 4 : Math.round(iv * ease * 1.3); ease = ease + 0.15; }
  iv = Math.min(iv, 365);
  const due = today(env, iv);
  await env.DB.prepare(
    "UPDATE notes SET review_interval = ?, review_ease = ?, review_count = review_count + 1, review_due = ? WHERE id = ?",
  ).bind(iv, ease, due, id).run();
  return json({ interval: iv, due });
}

async function suggest(env: Env, id: number) {
  const n = await env.DB.prepare("SELECT title, summary, why_matters FROM notes WHERE id = ?").bind(id).first<Json>();
  if (!n) return err("not found", 404);
  const text = `${n.title} ${n.summary} ${n.why_matters}`;
  const stop = new Set(["the", "and", "for", "with", "that", "this", "của", "và", "là", "có", "cho", "những", "các", "một", "được", "không", "trong", "khi", "thì", "mà", "để", "với", "này"]);
  const words = [...new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !stop.has(w)))].slice(0, 10);
  const tagRows = await env.DB.prepare(
    `SELECT DISTINCT n.id, n.title, n.summary, n.kind FROM note_tags a JOIN note_tags b ON a.tag_id = b.tag_id AND b.note_id != a.note_id
     JOIN notes n ON n.id = b.note_id WHERE a.note_id = ? AND n.stage != 'archived'
     AND n.id NOT IN (SELECT to_id FROM links WHERE from_id = ?) AND n.id NOT IN (SELECT from_id FROM links WHERE to_id = ?) LIMIT 6`,
  ).bind(id, id, id).all<Json>();
  let textRows: Json[] = [];
  const fq = ftsQuery(words.join(" "), "OR");
  if (fq) {
    textRows = (
      await env.DB.prepare(
        `SELECT n.id, n.title, n.summary, n.kind FROM notes_fts f JOIN notes n ON n.id = f.rowid
         WHERE notes_fts MATCH ? AND n.id != ? AND n.stage != 'archived'
         AND n.id NOT IN (SELECT to_id FROM links WHERE from_id = ?) AND n.id NOT IN (SELECT from_id FROM links WHERE to_id = ?)
         ORDER BY rank LIMIT 6`,
      ).bind(fq, id, id, id).all<Json>()
    ).results;
  }
  const seen = new Set<number>();
  const out: Json[] = [];
  for (const r of [...tagRows.results.map((r) => ({ ...r, via: "tag" }) as Json), ...textRows.map((r) => ({ ...r, via: "text" }) as Json)])
    if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
  return json({ suggestions: out.slice(0, 8) });
}

async function spark(env: Env, url: URL) {
  const mode = url.searchParams.get("mode") ?? "random";
  const tag = url.searchParams.get("tag");
  const base = "SELECT id, kind, title, summary, body, learned_at FROM notes WHERE stage != 'archived'";
  let a: Json | null;
  if (tag) {
    a = await env.DB.prepare(
      `${base} AND id IN (SELECT nt.note_id FROM note_tags nt JOIN tags t ON t.id = nt.tag_id WHERE t.name = ?) ORDER BY random() LIMIT 1`,
    ).bind(tag).first<Json>();
  } else if (url.searchParams.get("old") === "1") {
    // "gặp lại ý cũ": ưu tiên note > 14 ngày, lâu không chạm tới
    a = await env.DB.prepare(`${base} AND updated_at < datetime('now', '-14 days') ORDER BY random() LIMIT 1`).first<Json>();
    a ??= await env.DB.prepare(`${base} ORDER BY updated_at ASC LIMIT 1`).first<Json>();
    return json({ notes: a ? await attachTags(env.DB, [a]) : [] });
  } else {
    a = await env.DB.prepare(`${base} ORDER BY random() LIMIT 1`).first<Json>();
  }
  if (!a) return json({ notes: [] });
  let b: Json | null = null;
  if (mode === "distant") {
    // xa nhau: không chung tag, không có link, ưu tiên khác kind
    b = await env.DB.prepare(
      `${base} AND id != ?1
       AND id NOT IN (SELECT b.note_id FROM note_tags a JOIN note_tags b ON a.tag_id = b.tag_id WHERE a.note_id = ?1)
       AND id NOT IN (SELECT to_id FROM links WHERE from_id = ?1) AND id NOT IN (SELECT from_id FROM links WHERE to_id = ?1)
       ORDER BY (kind = ?2), random() LIMIT 1`,
    ).bind(a.id, a.kind).first<Json>();
  }
  if (!b) b = await env.DB.prepare(`${base} AND id != ? ORDER BY random() LIMIT 1`).bind(a.id).first<Json>();
  return json({ notes: await attachTags(env.DB, b ? [a, b] : [a]) });
}

async function saveSpark(env: Env, b: Json) {
  const idea = String(b.idea ?? "").trim();
  if (!idea) return err("empty idea");
  const r = await env.DB.prepare(
    `INSERT INTO notes (kind, title, body, summary, next_action, stage, distilled_at, review_due, learned_at)
     VALUES ('idea', ?, ?, ?, ?, 'distilled', datetime('now'), ?, ?) RETURNING id`,
  ).bind(String(b.title || idea.split("\n")[0]).slice(0, 140), idea, idea.split("\n")[0].slice(0, 280), b.next_action ?? "", today(env, 1), today(env))
    .first<{ id: number }>();
  const id = r!.id;
  const stmts = [
    env.DB.prepare("INSERT INTO sparks (note_a, note_b, prompt, idea_note_id) VALUES (?, ?, ?, ?)").bind(b.note_a ?? null, b.note_b ?? null, b.prompt ?? "", id),
  ];
  for (const src of [b.note_a, b.note_b].filter(Boolean))
    stmts.push(env.DB.prepare("INSERT OR IGNORE INTO links (from_id, to_id, reason) VALUES (?, ?, ?)").bind(id, src, `spark: ${b.prompt ?? ""}`.slice(0, 200)));
  await env.DB.batch(stmts);
  await setTags(env.DB, id, b.tags ?? ["spark"]);
  return json({ id }, 201);
}

async function stats(env: Env) {
  const db = env.DB;
  const t = today(env);
  const [stages, due, cap30, ship30, links, sparks30, weekly, weeklyShip, actions, outs] = await db.batch([
    db.prepare("SELECT stage, COUNT(*) c FROM notes GROUP BY stage"),
    db.prepare("SELECT COUNT(*) c FROM notes WHERE review_due IS NOT NULL AND review_due <= ? AND stage != 'archived'").bind(t),
    db.prepare("SELECT COUNT(*) c FROM notes WHERE created_at >= datetime('now', '-30 days')"),
    db.prepare("SELECT COUNT(*) c FROM outputs WHERE status = 'shipped' AND shipped_at >= datetime('now', '-30 days')"),
    db.prepare("SELECT COUNT(*) c FROM links"),
    db.prepare("SELECT COUNT(*) c FROM sparks WHERE created_at >= datetime('now', '-30 days')"),
    db.prepare("SELECT strftime('%Y-%W', created_at) wk, COUNT(*) c FROM notes WHERE created_at >= datetime('now', '-56 days') GROUP BY wk"),
    db.prepare("SELECT strftime('%Y-%W', shipped_at) wk, COUNT(*) c FROM outputs WHERE status='shipped' AND shipped_at >= datetime('now', '-56 days') GROUP BY wk"),
    db.prepare("SELECT id, title, next_action, para_ref FROM notes WHERE next_action != '' AND stage = 'distilled' ORDER BY updated_at DESC LIMIT 8"),
    db.prepare("SELECT status, COUNT(*) c FROM outputs GROUP BY status"),
  ]);
  const byStage: Record<string, number> = { inbox: 0, distilled: 0, archived: 0 };
  for (const r of stages.results as Json[]) byStage[r.stage] = r.c;
  const byOut: Record<string, number> = { planned: 0, doing: 0, shipped: 0 };
  for (const r of outs.results as Json[]) byOut[r.status] = r.c;
  const captured = (cap30.results[0] as Json).c as number;
  const shipped = (ship30.results[0] as Json).c as number;
  return json({
    today: t,
    stages: byStage,
    inbox_limit: Number(env.INBOX_LIMIT ?? 20),
    reviews_due: (due.results[0] as Json).c,
    captured_30d: captured,
    shipped_30d: shipped,
    ship_ratio: captured ? shipped / captured : 0,
    links: (links.results[0] as Json).c,
    sparks_30d: (sparks30.results[0] as Json).c,
    weekly_capture: weekly.results,
    weekly_ship: weeklyShip.results,
    next_actions: actions.results,
    outputs: byOut,
  });
}

async function listOutputs(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT o.*, (SELECT COUNT(*) FROM output_notes x WHERE x.output_id = o.id) note_count FROM outputs o
     ORDER BY CASE status WHEN 'doing' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END, COALESCE(o.deadline, '9999'), o.id DESC`,
  ).all<Json>();
  const { results: links } = await env.DB.prepare(
    "SELECT x.output_id, n.id, n.title FROM output_notes x JOIN notes n ON n.id = x.note_id",
  ).all<Json>();
  for (const o of results) o.notes = links.filter((l) => l.output_id === o.id).map((l) => ({ id: l.id, title: l.title }));
  return json({ outputs: results });
}

async function upsertOutput(env: Env, id: number | null, b: Json) {
  if (id === null) {
    if (!String(b.title ?? "").trim()) return err("title required");
    const r = await env.DB.prepare(
      "INSERT INTO outputs (title, kind, status, url, notes_text, deadline) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
    ).bind(b.title, b.kind ?? "prototype", b.status ?? "planned", b.url ?? "", b.notes_text ?? "", b.deadline || null).first<{ id: number }>();
    for (const nid of Array.isArray(b.note_ids) ? b.note_ids : [])
      await env.DB.prepare("INSERT OR IGNORE INTO output_notes VALUES (?, ?)").bind(r!.id, nid).run();
    return json({ id: r!.id }, 201);
  }
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const f of OUTPUT_FIELDS) if (f in b) { sets.push(`${f} = ?`); args.push(f === "deadline" ? b[f] || null : b[f]); }
  if (b.status === "shipped") sets.push("shipped_at = COALESCE(shipped_at, datetime('now'))");
  else if ("status" in b) sets.push("shipped_at = NULL");
  if (sets.length) await env.DB.prepare(`UPDATE outputs SET ${sets.join(", ")} WHERE id = ?`).bind(...args, id).run();
  return json({ ok: true });
}

async function exportAll(env: Env) {
  const db = env.DB;
  const tables = ["notes", "tags", "note_tags", "links", "outputs", "output_notes", "sparks"];
  const res = await db.batch(tables.map((t) => db.prepare(`SELECT * FROM ${t}`)));
  const out: Json = { app: "idea-forge", version: 1, exported_at: new Date().toISOString() };
  tables.forEach((t, i) => (out[t] = res[i].results));
  return new Response(JSON.stringify(out, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="idea-forge-${today(env)}.json"`,
    },
  });
}

async function importAll(env: Env, b: Json) {
  if (b.app !== "idea-forge") return err("not an idea-forge export");
  const count = await env.DB.prepare("SELECT COUNT(*) c FROM notes").first<{ c: number }>();
  if ((count?.c ?? 0) > 0 && b.replace !== true) return err("database not empty — pass replace:true to overwrite", 409);
  const db = env.DB;
  const order = ["notes", "tags", "note_tags", "links", "outputs", "output_notes", "sparks"];
  const stmts: D1PreparedStatement[] = [...order].reverse().map((t) => db.prepare(`DELETE FROM ${t}`));
  for (const t of order)
    for (const row of (b[t] ?? []) as Json[]) {
      const cols = Object.keys(row).filter((c) => /^[a-z_]+$/.test(c));
      stmts.push(db.prepare(`INSERT INTO ${t} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).bind(...cols.map((c) => row[c])));
    }
  for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
  return json({ ok: true, rows: stmts.length - order.length });
}

// ---------- router ----------
async function api(req: Request, env: Env, url: URL): Promise<Response> {
  if (!env.API_TOKEN) return err("API_TOKEN secret is not set (wrangler secret put API_TOKEN)", 500);
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.API_TOKEN}`) return err("unauthorized", 401);

  const path = url.pathname.replace(/^\/api/, "").replace(/\/$/, "");
  const m = req.method;
  const seg = path.split("/").filter(Boolean);
  const id = seg[1] ? Number(seg[1]) : NaN;

  if (path === "/ping") return json({ ok: true });
  if (path === "/stats" && m === "GET") return stats(env);
  if (path === "/tags" && m === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT t.name, COUNT(nt.note_id) c FROM tags t LEFT JOIN note_tags nt ON nt.tag_id = t.id GROUP BY t.id HAVING c > 0 ORDER BY c DESC, t.name",
    ).all();
    return json({ tags: results });
  }
  if (path === "/export" && m === "GET") return exportAll(env);
  if (path === "/import" && m === "POST") return importAll(env, await body(req));

  if (seg[0] === "notes") {
    if (seg.length === 1 && m === "GET") return listNotes(env, url);
    if (seg.length === 1 && m === "POST") return createNote(env, await body(req));
    if (!Number.isFinite(id)) return err("bad id");
    if (seg.length === 2 && m === "GET") return getNote(env, id);
    if (seg.length === 2 && m === "PATCH") return updateNote(env, id, await body(req));
    if (seg.length === 2 && m === "DELETE") {
      await env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }
    if (seg[2] === "links" && m === "POST") {
      const b = await body(req);
      const to = Number(b.to_id);
      if (!to || to === id) return err("bad to_id");
      await env.DB.prepare("INSERT OR REPLACE INTO links (from_id, to_id, reason) VALUES (?, ?, ?)").bind(id, to, b.reason ?? "").run();
      await env.DB.prepare("UPDATE notes SET updated_at = datetime('now') WHERE id IN (?, ?)").bind(id, to).run();
      return json({ ok: true }, 201);
    }
    if (seg[2] === "review" && m === "POST") return reviewNote(env, id, Number((await body(req)).grade ?? 2));
    if (seg[2] === "suggest" && m === "GET") return suggest(env, id);
  }
  if (seg[0] === "links" && m === "DELETE" && Number.isFinite(id)) {
    await env.DB.prepare("DELETE FROM links WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }
  if (path === "/review" && m === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT ${LIST_COLS}, n.why_matters, n.review_interval, n.review_count FROM notes n
       WHERE n.review_due IS NOT NULL AND n.review_due <= ? AND n.stage != 'archived' ORDER BY n.review_due, random() LIMIT 30`,
    ).bind(today(env)).all<Json>();
    return json({ notes: await attachTags(env.DB, results) });
  }
  if (path === "/spark" && m === "GET") return spark(env, url);
  if (path === "/sparks" && m === "POST") return saveSpark(env, await body(req));

  if (seg[0] === "outputs") {
    if (seg.length === 1 && m === "GET") return listOutputs(env);
    if (seg.length === 1 && m === "POST") return upsertOutput(env, null, await body(req));
    if (!Number.isFinite(id)) return err("bad id");
    if (seg.length === 2 && m === "PATCH") return upsertOutput(env, id, await body(req));
    if (seg.length === 2 && m === "DELETE") {
      await env.DB.prepare("DELETE FROM outputs WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }
    if (seg[2] === "notes" && m === "POST") {
      await env.DB.prepare("INSERT OR IGNORE INTO output_notes VALUES (?, ?)").bind(id, Number((await body(req)).note_id)).run();
      return json({ ok: true }, 201);
    }
    if (seg[2] === "notes" && seg[3] && m === "DELETE") {
      await env.DB.prepare("DELETE FROM output_notes WHERE output_id = ? AND note_id = ?").bind(id, Number(seg[3])).run();
      return json({ ok: true });
    }
  }
  return err("not found", 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(req, env, url);
      } catch (e: any) {
        return err(String(e?.message ?? e), 500);
      }
    }
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
