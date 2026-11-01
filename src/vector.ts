// Embeddings are stored L2-normalized as float32 BLOBs, so cosine similarity is a plain dot product.
export function normalize(v: ArrayLike<number>): Float32Array {
  const out = Float32Array.from(v);
  let norm = 0;
  for (const x of out) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

// D1 returns BLOBs as number[] (one entry per byte); accept ArrayBuffer too.
export function decode(blob: ArrayBuffer | number[]): Float32Array {
  return new Float32Array(blob instanceof ArrayBuffer ? blob : Uint8Array.from(blob).buffer);
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function topK(
  query: Float32Array,
  rows: { id: number; vec: ArrayBuffer | number[] }[],
  k: number,
  minScore: number,
): { id: number; score: number }[] {
  return rows
    .map((r) => ({ id: r.id, score: dot(query, decode(r.vec)) }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
