import assert from "node:assert/strict";
import test from "node:test";
import { parseMd, toNote } from "../scripts/forge.mjs";

test("parses frontmatter lists, inline lists and dates", () => {
  const md = `---\ntitle: "Deep Work"\ntags:\n  - focus\n  - "#habits"\ndate: 2024-03-05T10:00\nkind: book\nsource: https://x.test\n---\n# Heading\nbody`;
  const n = toNote("/v/notes/a/deep.md", md, "/v/notes", "idea");
  assert.equal(n.title, "Deep Work");
  assert.deepEqual(n.tags, ["focus", "#habits"]);
  assert.equal(n.learned_at, "2024-03-05");
  assert.equal(n.kind, "book");
  assert.equal(n.source_url, "https://x.test");
  assert.equal(n.source_title, "md:a/deep.md");
  assert.equal(n.body, "# Heading\nbody");
});

test("falls back to H1, then filename; rejects unknown kind; handles no frontmatter", () => {
  assert.equal(toNote("/r/x.md", "# Hello\nhi", "/r", "idea").title, "Hello");
  const n = toNote("/r/untitled.md", "just text", "/r", "lesson");
  assert.equal(n.title, "untitled");
  assert.equal(n.kind, "lesson");
  assert.deepEqual(toNote("/r/x.md", "---\ntags: [a, b]\nkind: nope\n---\nx", "/r", "idea").tags, ["a", "b"]);
  assert.equal(parseMd("﻿---\ntitle: t\n---\nb").fm.title, "t");
});
