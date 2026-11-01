import { readFileSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute } from "node:path";

// Wrangler redirects to Vite's output. Check that exact artifact before any remote operation.
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
  const database = config.d1_databases?.find(
    (database) => database.binding === "DB",
  );
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
  console.log("Deployment config validated.");
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
