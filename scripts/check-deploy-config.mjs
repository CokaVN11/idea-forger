import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve, relative, isAbsolute } from "node:path";

// Resolve Vite's output once and pass the validated config to every remote command.
try {
  const redirectPath = resolve(".wrangler/deploy/config.json");
  const redirect = JSON.parse(readFileSync(redirectPath, "utf8"));
  if (typeof redirect.configPath !== "string")
    throw new Error("Missing deployment config path.");
  const configPath = resolve(dirname(redirectPath), redirect.configPath);
  const artifact = relative(resolve("dist"), configPath);
  if (artifact.startsWith("..") || isAbsolute(artifact))
    throw new Error("Deployment must use a generated config inside dist/.");

  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const databases =
    config.d1_databases?.filter((database) => database.binding === "DB") ?? [];
  if (databases.length !== 1)
    throw new Error("The build must contain exactly one DB binding.");
  const database = databases[0];
  if (
    !/^[a-f0-9]{32}$/i.test(config.account_id ?? "") ||
    /^0+$/.test(config.account_id)
  ) {
    throw new Error("The build has no valid CLOUDFLARE_ACCOUNT_ID.");
  }
  if (
    !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
      database?.database_id ?? "",
    ) ||
    database.database_id === "00000000-0000-0000-0000-000000000000"
  ) {
    throw new Error("The build has no valid CLOUDFLARE_D1_DATABASE_ID.");
  }
  const commands = {
    "--migrate": ["d1", "migrations", "apply", "DB", "--remote"],
    "--deploy": ["deploy"],
    "--dry-run": ["deploy", "--dry-run"],
  };
  const action = process.argv[2];
  if (process.argv.length > 3 || (action && !Object.hasOwn(commands, action))) {
    throw new Error("Unknown production command.");
  }
  console.log("Deployment config validated.");
  if (action) {
    const result = spawnSync(
      process.execPath,
      [
        resolve("node_modules/wrangler/bin/wrangler.js"),
        ...commands[action],
        "--config",
        configPath,
      ],
      { stdio: "inherit" },
    );
    if (result.error) throw new Error("Unable to start Wrangler.");
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  // Do not echo config contents, resource IDs, or secret values into CI logs.
  const reason =
    error.code || error instanceof SyntaxError
      ? "Deployment output is missing or unreadable."
      : error.message;
  console.error(
    `${reason} Set deployment variables and run npm run build:production first.`,
  );
  process.exitCode = 1;
}
