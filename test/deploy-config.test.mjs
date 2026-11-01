import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const script = resolve("scripts/check-deploy-config.mjs");
const accountId = "a".repeat(32);
const databaseId = "11111111-1111-4111-8111-111111111111";
const valid = {
  account_id: accountId,
  d1_databases: [{ binding: "DB", database_id: databaseId }],
};

function check(
  config,
  { redirect = "../../dist/worker/wrangler.json", missing = false } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), "idea-forge-deploy-test-"));
  try {
    if (!missing) {
      mkdirSync(join(directory, ".wrangler/deploy"), { recursive: true });
      mkdirSync(join(directory, "dist/worker"), { recursive: true });
      writeFileSync(
        join(directory, ".wrangler/deploy/config.json"),
        JSON.stringify({ configPath: redirect }),
      );
      writeFileSync(
        join(directory, "dist/worker/wrangler.json"),
        typeof config === "string" ? config : JSON.stringify(config),
      );
    }
    return spawnSync(process.execPath, [script], {
      cwd: directory,
      encoding: "utf8",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("accepts generated production configuration without logging identifiers", () => {
  const result = check(valid);
  assert.equal(result.status, 0, result.stderr);
  assert(!result.stdout.includes(accountId));
  assert(!result.stdout.includes(databaseId));
});

test("rejects template/local builds", () => {
  const result = check({
    d1_databases: [
      { binding: "DB", database_id: "00000000-0000-0000-0000-000000000000" },
    ],
  });
  assert.equal(result.status, 1);
});

test("rejects placeholder D1 even with a valid account", () => {
  const result = check({
    ...valid,
    d1_databases: [
      { binding: "DB", database_id: "00000000-0000-0000-0000-000000000000" },
    ],
  });
  assert.equal(result.status, 1);
});

test("rejects missing build output", () => {
  assert.equal(check(valid, { missing: true }).status, 1);
});

test("rejects redirects outside generated dist output", () => {
  assert.equal(check(valid, { redirect: "../../wrangler.jsonc" }).status, 1);
});

test("does not echo malformed config contents into logs", () => {
  const result = check('{"account_id":"private-value", invalid}');
  assert.equal(result.status, 1);
  assert(!result.stderr.includes("private-value"));
});
