import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const deploy = mode === "deploy";
  const env = deploy ? loadEnv(mode, process.cwd(), "CLOUDFLARE_") : {};
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = env.CLOUDFLARE_D1_DATABASE_ID;

  if (deploy) {
    if (!/^[a-f0-9]{32}$/i.test(accountId ?? "") || /^0+$/.test(accountId)) {
      throw new Error(
        "Set CLOUDFLARE_ACCOUNT_ID in .env.local or Cloudflare build variables.",
      );
    }
    if (
      !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(databaseId ?? "") ||
      databaseId === "00000000-0000-0000-0000-000000000000"
    ) {
      throw new Error(
        "Set CLOUDFLARE_D1_DATABASE_ID in .env.local or Cloudflare build variables.",
      );
    }
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      cloudflare({
        config: deploy
          ? (config) => {
              // Returning an array override concatenates bindings. Edit the existing binding instead.
              config.account_id = accountId;
              for (const database of config.d1_databases ?? []) {
                if (database.binding === "DB")
                  database.database_id = databaseId;
              }
            }
          : undefined,
      }),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src/client", import.meta.url)) },
    },
  };
});
