import { test } from "node:test";
import assert from "node:assert/strict";
import { decode, normalize, topK } from "../src/vector.ts";

const blob = (v) => Array.from(new Uint8Array(normalize(v).buffer));

test("normalize yields unit length and survives a D1-style byte array", () => {
  const back = decode(blob([3, 4]));
  assert.ok(Math.abs(back[0] - 0.6) < 1e-6 && Math.abs(back[1] - 0.8) < 1e-6);
});

test("decode accepts ArrayBuffer and number[] identically", () => {
  const v = normalize([1, 2, 3]);
  assert.deepEqual(decode(v.buffer), decode(Array.from(new Uint8Array(v.buffer))));
});

test("normalize leaves a zero vector finite", () => {
  assert.deepEqual([...normalize([0, 0])], [0, 0]);
});

test("topK ranks by similarity and drops results below the threshold", () => {
  const q = normalize([1, 0]);
  const rows = [
    { id: 1, vec: blob([0, 1]) }, // orthogonal -> 0
    { id: 2, vec: blob([1, 0.1]) }, // close
    { id: 3, vec: blob([1, 1]) }, // 45deg ~ 0.707
  ];
  assert.deepEqual(topK(q, rows, 5, 0.4).map((r) => r.id), [2, 3]);
  assert.deepEqual(topK(q, rows, 1, 0.4).map((r) => r.id), [2]);
});
